import { useUI } from '../../state/UIContext.jsx'
import { useDerived } from '../../state/useDerived.js'
import { RINGS } from '../../lib/constants.js'
import Button from '../ui/Button.jsx'
import Empty from '../ui/Empty.jsx'
import { DaysBadge } from '../ui/Badge.jsx'
import PersonRow from './PersonRow.jsx'

export default function LeastSeenView() {
  const { everyone, byPerson } = useDerived()
  const { open } = useUI()
  // Never in touch first, then longest since last contact.
  const list = [...everyone].sort((a, b) => (byPerson[b].days ?? Infinity) - (byPerson[a].days ?? Infinity))
  if (!list.length) return <Empty action={<Button variant="secondary" onClick={() => open('addPeople')}>+ Add person</Button>} />
  return (
    <ul className="rows">
      {list.map((id) => (
        <PersonRow key={id} id={id} sub={RINGS[byPerson[id].ring]} badge={<DaysBadge a={byPerson[id]} />}>
          <Button size="sm" onClick={() => open('sayHi', { id })}>
            Say hi
          </Button>
          <Button size="sm" variant="secondary" onClick={() => open('log', { people: [id], plan: true })}>
            Plan
          </Button>
        </PersonRow>
      ))}
    </ul>
  )
}
