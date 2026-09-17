import { useUI } from '../../state/UIContext.jsx'
import { useDerived } from '../../state/useDerived.js'
import Button from '../ui/Button.jsx'
import Badge from '../ui/Badge.jsx'
import Empty from '../ui/Empty.jsx'
import PersonChip from '../ui/PersonChip.jsx'

const TONE = { tight: 'success', solid: 'warn', loose: 'neutral' }

export default function GroupsView() {
  const { clusters } = useDerived()
  const { open } = useUI()
  if (!clusters.length) {
    return <Empty>No groups yet. Groups appear when you log hangouts with two or more people.</Empty>
  }
  return (
    <div className="cluster-grid">
      {clusters.map((c) => (
        <article key={c.id} className="cluster-card">
          <div className="section-head">
            <h3 className="cluster-name">
              <span className={`dot group-${c.group}`} aria-hidden /> {c.name}
            </h3>
            <Badge tone={TONE[c.strengthLabel]}>{c.strengthLabel}</Badge>
          </div>
          <div className="chips">
            {c.members.map((id) => (
              <PersonChip key={id} id={id} />
            ))}
          </div>
          <Button size="sm" variant="secondary" onClick={() => open('log', { people: c.members, plan: true })}>
            Plan something with them
          </Button>
        </article>
      ))}
    </div>
  )
}
