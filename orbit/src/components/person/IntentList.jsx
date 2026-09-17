import { useOrbit } from '../../state/OrbitContext.jsx'
import { useUI } from '../../state/UIContext.jsx'
import { formatCents } from '../../lib/money.js'
import { formatDate, today } from '../../lib/dates.js'
import { Gift } from '../ui/icons.js'
import { IconButton } from '../ui/Button.jsx'
import { X } from '../ui/icons.js'

/** Checkbox list of a person's intents. Removing one offers Undo. */
export default function IntentList({ id, intents, showOwner = false }) {
  const { people, savePerson, peek } = useOrbit()
  const { notify } = useUI()

  const change = (pid, intentId, fn) => {
    const p = people[pid]
    return savePerson(pid, { ...p, intents: fn(p.intents || [], intentId) })
  }
  const toggle = (pid, iid) => change(pid, iid, (list) => list.map((i) => (i.id === iid ? { ...i, done: !i.done } : i))).catch(() => {})
  const remove = (pid, iid) => {
    const p = people[pid]
    const index = p.intents.findIndex((i) => i.id === iid)
    const removed = p.intents[index]
    change(pid, iid, (list) => list.filter((i) => i.id !== iid))
      .then(() =>
        notify(`Removed "${removed.text}"`, {
          action: {
            label: 'Undo',
            run: () => {
              const now = peek().people[pid]
              if (!now) return
              const list = (now.intents || []).filter((x) => x.id !== removed.id)
              list.splice(index, 0, removed)
              savePerson(pid, { ...now, intents: list }).catch(() => {})
            },
          },
        }),
      )
      .catch(() => {})
  }

  return (
    <ul className="checklist">
      {intents.map(({ pid = id, ...i }) => (
        <li key={`${pid}-${i.id}`} className={i.done ? 'is-done' : ''}>
          <label className="check">
            <input type="checkbox" checked={!!i.done} onChange={() => toggle(pid, i.id)} />
            <span>
              {i.kind === 'gift' && <Gift size={14} className="inline-icon" aria-label="Gift idea:" />}
              {i.text}
              {i.amount ? <span className="muted"> · {formatCents(i.amount)}</span> : null}
              {i.due && !i.done ? (
                <span className={i.due < today() ? 'overdue-text' : 'muted'}> · {i.due < today() ? 'overdue, ' : 'by '}{formatDate(i.due, { month: 'short', day: 'numeric' })}</span>
              ) : null}
              {showOwner && <span className="muted"> · {people[pid]?.name}</span>}
            </span>
          </label>
          {!showOwner && (
            <IconButton label={`Remove ${i.text}`} onClick={() => remove(pid, i.id)} className="icon-sm">
              <X size={14} />
            </IconButton>
          )}
        </li>
      ))}
    </ul>
  )
}
