import { useOrbit } from '../state/OrbitContext.jsx'
import { formatDate } from '../lib/dates.js'
import { KIND_ICON } from './ui/icons.js'
import Badge from './ui/Badge.jsx'
import { firstName } from './ui/PersonChip.jsx'

const STATUS_TONE = { planned: 'warn', skipped: 'neutral' }

export function KindIcon({ kind }) {
  const Icon = KIND_ICON[kind]
  return <span className="kind-icon" aria-hidden>{Icon && <Icon size={16} />}</span>
}

/** One event as a clickable row. */
export default function EventRow({ event: e, onOpen, showStatus = false, children }) {
  const { people } = useOrbit()
  const who = e.people.map((p) => firstName(people[p]?.name || '?'))
  return (
    <li className="row">
      <button type="button" className="row-button" onClick={onOpen}>
        <KindIcon kind={e.kind} />
        <span className="row-main">
          <span className="row-title">{e.title || e.kind}</span>
          <span className="row-sub">
            {formatDate(e.date)}
            {e.place && ` · ${e.place}`} · {who.slice(0, 4).join(', ')}
            {who.length > 4 && ` +${who.length - 4}`}
          </span>
        </span>
        {showStatus && STATUS_TONE[e.status] && <Badge tone={STATUS_TONE[e.status]}>{e.status}</Badge>}
      </button>
      {children}
    </li>
  )
}
