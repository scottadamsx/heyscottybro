import { useOrbit } from '../../state/OrbitContext.jsx'
import { useDerived } from '../../state/useDerived.js'
import { RINGS } from '../../lib/constants.js'
import { relStats, workOn } from '../../lib/derive/stats.js'
import { TrendMark } from '../person/StatsTab.jsx'
import Empty from '../ui/Empty.jsx'
import PersonRow from './PersonRow.jsx'

export default function ClosestView() {
  const { people } = useOrbit()
  const { everyone, byPerson, done, asOf } = useDerived()
  const close = everyone.filter((id) => byPerson[id].ring <= 2)
  if (!close.length) return <Empty>Nobody in your inner, close or regular rings yet. Log some hangouts.</Empty>
  return (
    <ul className="rows">
      {close.map((id) => {
        const s = relStats(id, done, asOf)
        const top = workOn(people[id], byPerson[id], s)[0]
        return (
          <PersonRow
            key={id}
            id={id}
            sub={
              <>
                {RINGS[byPerson[id].ring]} · {s.this90} this 90d
                {s.avgGap != null && ` · every ~${s.avgGap}d`}
                {s.topKind && ` · usually ${s.topKind}`}
                {top && <span className="work-hint"> · {top.text}</span>}
              </>
            }
            badge={<TrendMark trend={s.trend} label={`Seeing them ${s.trend === 'flat' ? 'about the same' : s.trend === 'up' ? 'more' : 'less'} than the 90 days before`} />}
          />
        )
      })}
    </ul>
  )
}
