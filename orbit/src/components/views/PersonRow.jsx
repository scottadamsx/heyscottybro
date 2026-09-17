import { useOrbit } from '../../state/OrbitContext.jsx'
import { useUI } from '../../state/UIContext.jsx'
import { groupOf } from '../../lib/constants.js'
import Avatar from '../ui/Avatar.jsx'

/** A person as a list row that opens their card; extra controls go in children. */
export default function PersonRow({ id, sub, badge, children }) {
  const { people } = useOrbit()
  const { openPerson } = useUI()
  const p = people[id]
  return (
    <li className="row">
      <button type="button" className="row-button" onClick={() => openPerson(id)}>
        <Avatar person={p} />
        <span className="row-main">
          <span className="row-title">{p.name}</span>
          <span className="row-sub">
            <span className={`dot group-${groupOf(p.group).id}`} aria-hidden />
            {sub}
          </span>
        </span>
        {badge}
      </button>
      {children && <span className="row-actions">{children}</span>}
    </li>
  )
}
