import { useState } from 'react'
import Tabs from '../ui/Tabs.jsx'
import RecentView from './RecentView.jsx'
import LeastSeenView from './LeastSeenView.jsx'
import ClosestView from './ClosestView.jsx'
import PlanView from './PlanView.jsx'
import GiftsView from './GiftsView.jsx'
import GroupsView from './GroupsView.jsx'

const VIEWS = [
  { id: 'recent', label: 'Recent', Pane: RecentView },
  { id: 'least', label: 'Least seen', Pane: LeastSeenView },
  { id: 'closest', label: 'Closest', Pane: ClosestView },
  { id: 'plan', label: 'Plan', Pane: PlanView },
  { id: 'gifts', label: 'Gifts', Pane: GiftsView },
  { id: 'groups', label: 'Groups', Pane: GroupsView },
]
const KEY = 'orbit-view'

const remembered = () => {
  try {
    return localStorage.getItem(KEY)
  } catch {
    return null
  }
}

export default function ViewsCard() {
  const [view, setView] = useState(() => (VIEWS.some((v) => v.id === remembered()) ? remembered() : 'recent'))
  const choose = (id) => {
    setView(id)
    try {
      localStorage.setItem(KEY, id)
    } catch {
      /* per-viewer convenience only */
    }
  }
  const { Pane } = VIEWS.find((v) => v.id === view)
  return (
    <section className="card" aria-label="Views">
      <Tabs label="Views" tabs={VIEWS} value={view} onChange={choose} />
      <div role="tabpanel" aria-labelledby={`tab-${view}`} className="tabpanel">
        <Pane />
      </div>
    </section>
  )
}
