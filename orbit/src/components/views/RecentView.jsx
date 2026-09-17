import { useUI } from '../../state/UIContext.jsx'
import { useDerived } from '../../state/useDerived.js'
import Button from '../ui/Button.jsx'
import Empty from '../ui/Empty.jsx'
import EventRow from '../EventRow.jsx'

export default function RecentView() {
  const { done } = useDerived()
  const { open, openEvent } = useUI()
  const recent = done.slice(-6).reverse()
  if (!recent.length) {
    return (
      <Empty action={<Button variant="secondary" onClick={() => open('log')}>+ Log a hangout</Button>}>
        Nothing yet.
      </Empty>
    )
  }
  return (
    <>
      <ul className="rows">
        {recent.map((e) => (
          <EventRow key={e.id} event={e} onOpen={() => openEvent(e.id)} />
        ))}
      </ul>
      <div className="card-foot">
        <Button size="sm" variant="ghost" onClick={() => open('allEvents')}>
          All events
        </Button>
      </div>
    </>
  )
}
