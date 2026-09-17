import { useOrbit } from '../../state/OrbitContext.jsx'
import { useDerived } from '../../state/useDerived.js'
import { RINGS } from '../../lib/constants.js'
import { relStats, workOn } from '../../lib/derive/stats.js'
import { TREND_ICON } from '../ui/icons.js'
import { giftBudget } from '../../lib/derive/birthdays.js'
import { formatCents } from '../../lib/money.js'
import { DaysBadge } from '../ui/Badge.jsx'

const TREND_LABEL = { up: 'more than', down: 'less than', flat: 'same as' }

export function TrendMark({ trend, label }) {
  const Icon = TREND_ICON[trend]
  return (
    <span className={`trend trend-${trend}`} aria-label={label} aria-hidden={label ? undefined : true}>
      <Icon size={16} />
    </span>
  )
}

export default function StatsTab({ id }) {
  const { people, settings } = useOrbit()
  const { done, asOf, byPerson, clusterOf } = useDerived()
  const p = people[id]
  const a = byPerson[id]
  const s = relStats(id, done, asOf)
  const todo = workOn(p, a, s)
  const tiles = [
    ['Closeness, 90d', `${a.score90} pts`],
    ['In person', s.inPerson],
    ['Avg between', s.avgGap == null ? '—' : `${s.avgGap}d`],
    ['This / last 90d', `${s.this90} / ${s.prev90}`],
    ['One-on-one', s.oneOnOne],
    ['Calls, texts, chats', s.remote],
  ]

  return (
    <div className="stack-lg">
      <dl className="tiles">
        {tiles.map(([label, value]) => (
          <div key={label} className="tile">
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
      <p className="meta-line">
        <TrendMark trend={s.trend} />
        Seeing them {TREND_LABEL[s.trend]} the 90 days before · <DaysBadge a={a} />
      </p>
      <dl className="facts-dl">
        <dt>Usually</dt>
        <dd>{s.topKind ? `${s.topKind} (${s.topKindCount} of ${s.inPerson})` : '—'}</dd>
        <dt>Ring</dt>
        <dd>
          {RINGS[a.ring]}
          {a.cadence && ` · aim for every ~${a.cadence} days`}
          {clusterOf[id] && ` · ${clusterOf[id].name} (${clusterOf[id].strengthLabel})`}
        </dd>
        <dt>Gift budget</dt>
        <dd>
          {a.ring > 2
            ? 'None at this ring'
            : `${formatCents(giftBudget(settings, 'xmas', a.ring))} Christmas · ${formatCents(giftBudget(settings, 'bday', a.ring))} birthday`}
        </dd>
      </dl>
      <section className="section">
        <h3 className="section-title">Work on</h3>
        {todo.length ? (
          <ul className="plain-list work-on">
            {todo.map((w) => (
              <li key={w.key}>{w.text}</li>
            ))}
          </ul>
        ) : (
          <p className="muted">Nothing. This one's in good shape.</p>
        )}
      </section>
    </div>
  )
}
