import { useSearchParams } from 'react-router-dom'
import { useOrbit } from '../../state/OrbitContext.jsx'
import { useUI } from '../../state/UIContext.jsx'
import { useDerived } from '../../state/useDerived.js'
import { RINGS, groupOf } from '../../lib/constants.js'
import Modal from '../ui/Modal.jsx'
import Button from '../ui/Button.jsx'
import Tabs from '../ui/Tabs.jsx'
import Empty from '../ui/Empty.jsx'
import { DaysBadge } from '../ui/Badge.jsx'
import LastSeen from './LastSeen.jsx'
import Avatar from '../ui/Avatar.jsx'
import { Sparkles } from '../ui/icons.js'
import ProfileTab from './ProfileTab.jsx'
import InfoTab from './InfoTab.jsx'
import AskTab from './AskTab.jsx'
import StatsTab from './StatsTab.jsx'

const TABS = [
  { id: 'profile', label: 'Profile' },
  { id: 'info', label: 'Info' },
  { id: 'ask', label: 'Ask them' },
  { id: 'stats', label: 'Stats' },
]
const PANES = { profile: ProfileTab, info: InfoTab, ask: AskTab, stats: StatsTab }

export default function PersonDrawer({ id }) {
  const { people, ai } = useOrbit()
  const { back, open } = useUI()
  const { byPerson, clusterOf } = useDerived()
  const [params, setParams] = useSearchParams()
  const p = people[id]

  if (!p) {
    return (
      <Modal variant="drawer" title="Not found" onClose={back}>
        <Empty>This person isn't in Orbit any more.</Empty>
      </Modal>
    )
  }

  const tab = PANES[params.get('tab')] ? params.get('tab') : 'profile'
  const Pane = PANES[tab]
  const a = byPerson[id]
  const cluster = clusterOf[id]

  return (
    <Modal
      variant="drawer"
      labelledBy="person-name"
      onClose={back}
    >
      <div className="person-head">
        <Avatar person={p} size="lg" />
        <div>
          <h2 id="person-name">{p.name}</h2>
          <p className="row-sub">
            <span className={`dot group-${groupOf(p.group).id}`} aria-hidden />
            {groupOf(p.group).label} · {RINGS[a.ring]}
            {cluster && ` · ${cluster.name}`}
          </p>
        </div>
        <DaysBadge a={a} />
      </div>
      <LastSeen a={a} />
      <div className="action-row">
        <Button size="sm" variant="primary" onClick={() => open('log', { people: [id] })}>
          Log hangout
        </Button>
        <Button size="sm" variant="secondary" onClick={() => open('log', { people: [id], plan: true })}>
          Plan
        </Button>
        <Button size="sm" onClick={() => open('sayHi', { id })}>
          Say hi
        </Button>
        {ai.available && (
          <Button size="sm" onClick={() => open('interview', { about: id })}>
            <Sparkles size={14} aria-hidden /> Interview
          </Button>
        )}
        <Button size="sm" variant="ghost" className="push-right" onClick={() => open('removePerson', { id })}>
          Remove
        </Button>
      </div>
      <Tabs
        label={`${p.name} sections`}
        tabs={TABS}
        value={tab}
        onChange={(t) => setParams(t === 'profile' ? {} : { tab: t }, { replace: true })}
      />
      <div role="tabpanel" aria-labelledby={`tab-${tab}`} className="tabpanel">
        <Pane id={id} />
      </div>
    </Modal>
  )
}
