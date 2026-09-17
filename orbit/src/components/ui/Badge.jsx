import { pillTone } from '../../lib/derive/analyze.js'

const TONE = {
  ok: ['success', 'on track'],
  warn: ['warn', 'due soon'],
  late: ['danger', 'overdue'],
  none: ['neutral', 'not logged'],
}

export default function Badge({ tone = 'neutral', children, ...rest }) {
  return (
    <span className={`badge badge-${tone}`} {...rest}>
      {children}
    </span>
  )
}

/** Days since in person: green, amber at 70% of cadence, red when overdue, grey when never. */
export function DaysBadge({ a }) {
  const [tone, label] = TONE[pillTone(a)]
  return (
    <Badge
      tone={tone}
      title={a.last ? `Last contact ${a.last} (${label})` : 'Nothing logged'}
      aria-label={a.days == null ? 'not logged' : `${a.days} days since last contact, ${label}`}
    >
      {tone === 'danger' && <span className="shape-dot" aria-hidden />}
      {a.days == null ? '—' : `${a.days}d`}
    </Badge>
  )
}
