import { useOrbit } from '../../state/OrbitContext.jsx'
import { useUI } from '../../state/UIContext.jsx'
import { useDerived } from '../../state/useDerived.js'
import { RINGS } from '../../lib/constants.js'
import { today } from '../../lib/dates.js'
import Button from '../ui/Button.jsx'
import Empty from '../ui/Empty.jsx'
import { DaysBadge } from '../ui/Badge.jsx'
import EventRow from '../EventRow.jsx'
import PersonRow from './PersonRow.jsx'

export default function PlanView() {
  const { events, saveEvent } = useOrbit()
  const { open, openEvent, notify } = useUI()
  const { everyone, byPerson } = useDerived()
  const now = today()
  const planned = Object.entries(events)
    .filter(([, e]) => e.status === 'planned')
    .sort((a, b) => (a[1].date < b[1].date ? -1 : 1))
  const worth = everyone
    .filter((id) => byPerson[id].ring === 4 || byPerson[id].drift)
    .filter((id) => !planned.some(([, e]) => e.people.includes(id)))

  const skip = async (id, e) => {
    await saveEvent(id, { ...e, status: 'skipped' }).catch(() => {})
    notify('Marked as not happening')
  }

  return (
    <div className="stack-lg">
      <section>
        <div className="section-head">
          <h3 className="section-title">Coming up</h3>
          <Button size="sm" variant="secondary" onClick={() => open('log', { plan: true })}>
            + Plan something
          </Button>
        </div>
        {planned.length ? (
          <ul className="rows">
            {planned.map(([id, e]) => (
              <EventRow key={id} event={e} onOpen={() => openEvent(id)}>
                {e.date < now && (
                  <span className="row-actions ask-happened">
                    <span className="muted">Did it happen?</span>
                    <Button size="sm" variant="primary" onClick={() => open('log', { eventId: id, status: 'done' })}>
                      Yes, log it
                    </Button>
                    <Button size="sm" onClick={() => skip(id, e)}>
                      No
                    </Button>
                  </span>
                )}
              </EventRow>
            ))}
          </ul>
        ) : (
          <p className="muted">Nothing planned.</p>
        )}
      </section>
      <section>
        <h3 className="section-title">Worth planning</h3>
        {worth.length ? (
          <ul className="rows">
            {worth.map((id) => (
              <PersonRow key={id} id={id} sub={byPerson[id].ring === 4 ? 'Never logged' : `Overdue · ${RINGS[byPerson[id].ring]}`} badge={<DaysBadge a={byPerson[id]} />}>
                <Button size="sm" variant="secondary" onClick={() => open('log', { people: [id], plan: true })}>
                  Plan
                </Button>
              </PersonRow>
            ))}
          </ul>
        ) : (
          <Empty>{everyone.length ? "Everyone's on track." : 'Nothing yet.'}</Empty>
        )}
      </section>
    </div>
  )
}
