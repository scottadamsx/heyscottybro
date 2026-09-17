import { formatDate } from '../../lib/dates.js'

const agoText = (d) => (d === 0 ? 'today' : d === 1 ? 'yesterday' : `${d} days ago`)

/** "Last seen Sep 3 for Hike at Signal Hill, 13 days ago" (in person), plus the last call or text if newer. */
export default function LastSeen({ a }) {
  if (!a?.lastEvent) {
    return <p className="meta-line">{a?.last ? `Not seen in person yet. Last call or text ${agoText(a.days)}.` : 'Nothing logged yet.'}</p>
  }
  const e = a.lastEvent
  const ago = agoText(a.seenDays)
  return (
    <p className="meta-line">
      Last seen {formatDate(e.date)} for {e.title || e.kind}
      {e.place && ` at ${e.place}`}, {ago}
      {a.last > e.date && `. Last call or text ${agoText(a.days)}`}
    </p>
  )
}
