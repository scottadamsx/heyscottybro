import { useOrbit } from '../../state/OrbitContext.jsx'
import { useUI } from '../../state/UIContext.jsx'
import Avatar from './Avatar.jsx'

export const firstName = (name = '') => name.trim().split(/\s+/)[0] || name

/** A person as a small button that opens their card. */
export default function PersonChip({ id, full = false }) {
  const { people } = useOrbit()
  const { openPerson } = useUI()
  const p = people[id]
  if (!p) return <span className="chip chip-missing">Unknown</span>
  return (
    <button type="button" className="chip" onClick={() => openPerson(id)}>
      <Avatar person={p} size="xs" />
      {full ? p.name : firstName(p.name)}
    </button>
  )
}
