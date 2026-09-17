import { useCallback, useEffect, useState } from 'react'
import { useOrbit } from '../../state/OrbitContext.jsx'
import { useUI } from '../../state/UIContext.jsx'
import { formatDate } from '../../lib/dates.js'
import { findSimilarIntent, mergeFacts } from '../../lib/dedupe.js'
import Button from '../ui/Button.jsx'
import Badge from '../ui/Badge.jsx'

/** Finds possible duplicates and broken references, and fixes them on request. */
export default function DataCheck() {
  const { storage, people, events, merge, savePerson, saveEvent, deleteEvent } = useOrbit()
  const { open, notify } = useUI()
  const [audit, setAudit] = useState(null)
  const [error, setError] = useState('')

  const run = useCallback(async () => {
    try {
      setAudit(await storage.audit())
      setError('')
    } catch (err) {
      setError(err.message)
    }
  }, [storage])

  useEffect(() => {
    run()
  }, [run, people, events])

  if (error) return <p className="field-error">{error}</p>
  if (!audit) return <p className="muted">Checking…</p>

  const clean = !audit.people.length && !audit.events.length && !audit.facts.length && !audit.intents.length && !audit.dangling.length
  if (clean) return <p><Badge tone="success">Clean</Badge> No duplicates or broken references.</p>

  const mergeGroup = (kind, ids, label) =>
    open('confirm', {
      title: `Merge ${ids.length} ${kind === 'people' ? 'records' : 'events'}?`,
      confirmLabel: 'Merge',
      body: <p>{label} will become one record. Everything is combined, nothing is thrown away, and a backup is kept.</p>,
      onConfirm: async () => {
        for (const drop of ids.slice(1)) await merge(kind, ids[0], drop)
        notify('Merged')
      },
    })

  // Collapse reworded repeats too, keeping the more detailed version.
  const tidy = async (pid) => {
    const p = people[pid]
    const intents = (p.intents || []).filter((i, n, all) => i.done || !findSimilarIntent(all.slice(0, n), i))
    await savePerson(pid, { ...p, facts: mergeFacts([], p.facts || []).facts, intents }).catch(() => {})
    notify('Cleaned up')
  }

  const fixDangling = async () => {
    const ids = [...new Set(audit.dangling.map((d) => d.event))]
    for (const eid of ids) {
      const e = events[eid]
      if (!e) continue
      const kept = e.people.filter((p) => people[p])
      if (kept.length) await saveEvent(eid, { ...e, people: kept }).catch(() => {})
      else await deleteEvent(eid).catch(() => {})
    }
    notify('Fixed broken references')
  }

  return (
    <div className="stack">
      {audit.people.map((ids) => (
        <div key={ids.join()} className="notice notice-warn">
          <span>Same name: {ids.map((id) => people[id]?.name).join(', ')}</span>
          <Button size="sm" variant="secondary" onClick={() => mergeGroup('people', ids, `${people[ids[0]]?.name} (×${ids.length})`)}>
            Merge
          </Button>
          <span className="muted">or rename one if they're different people.</span>
        </div>
      ))}
      {audit.events.map((ids) => {
        const e = events[ids[0]]
        return (
          <div key={ids.join()} className="notice notice-warn">
            <span>
              Same occasion ×{ids.length}: {e?.title} on {e && formatDate(e.date)}
            </span>
            <Button size="sm" variant="secondary" onClick={() => mergeGroup('events', ids, `${e?.title} on ${e && formatDate(e.date)}`)}>
              Merge
            </Button>
          </div>
        )
      })}
      {[...audit.facts, ...audit.intents].map((f) => (
        <div key={`${f.person}-${f.count}`} className="notice notice-warn">
          <span>
            {people[f.person]?.name} has {f.count} repeated item{f.count === 1 ? '' : 's'}.
          </span>
          <Button size="sm" variant="secondary" onClick={() => tidy(f.person)}>
            Clean up
          </Button>
        </div>
      ))}
      {audit.dangling.length > 0 && (
        <div className="notice notice-warn">
          <span>{audit.dangling.length} event reference{audit.dangling.length === 1 ? '' : 's'} point at people who no longer exist.</span>
          <Button size="sm" variant="secondary" onClick={fixDangling}>
            Fix
          </Button>
        </div>
      )}
    </div>
  )
}
