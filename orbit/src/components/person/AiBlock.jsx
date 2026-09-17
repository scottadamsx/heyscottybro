import { useState } from 'react'
import { useOrbit } from '../../state/OrbitContext.jsx'
import Button from '../ui/Button.jsx'
import { Sparkles } from '../ui/icons.js'
import { formatDate } from '../../lib/dates.js'

/** Shared shell for AI-written sections: the action, the busy state and errors. */
export default function AiBlock({ title, has, at, run, children, emptyText, disabledReason }) {
  const { ai, reload } = useOrbit()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  if (!ai.available && !has) return null

  const go = async () => {
    setBusy(true)
    setError('')
    try {
      await run(ai)
      await reload()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="section">
      <div className="section-head">
        <h3 className="section-title">{title}</h3>
        {ai.available && (
          <Button size="sm" variant="ghost" onClick={go} disabled={busy || !!disabledReason} title={disabledReason}>
            <Sparkles size={14} aria-hidden />
            {busy ? 'Writing…' : has ? 'Rewrite' : 'Write it'}
          </Button>
        )}
      </div>
      {has ? children : <p className="muted">{disabledReason || emptyText}</p>}
      {has && at && <p className="field-hint">Written {formatDate(at.slice(0, 10))} by Claude from your notes.</p>}
      {error && <p className="field-error" role="alert">{error}</p>}
    </section>
  )
}

/** Enough stored to ask Claude about? Mirrors the server's check. */
export function hasSubstance(p, id, events) {
  if (p.notes?.trim() || p.how?.trim() || p.facts?.length) return true
  return Object.values(events).some((e) => e.updates?.[id] || (e.people?.includes(id) && e.notes?.trim()))
}
