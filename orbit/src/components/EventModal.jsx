import { useOrbit } from '../state/OrbitContext.jsx'
import { useUI } from '../state/UIContext.jsx'
import { useDerived } from '../state/useDerived.js'
import { formatDate, today } from '../lib/dates.js'
import { questionsFor } from '../lib/derive/questions.js'
import Modal from './ui/Modal.jsx'
import Button from './ui/Button.jsx'
import Badge from './ui/Badge.jsx'
import PersonChip, { firstName } from './ui/PersonChip.jsx'
import Empty from './ui/Empty.jsx'

const STATUS_TONE = { done: 'success', planned: 'warn', skipped: 'neutral' }

export default function EventModal({ id }) {
  const { events, people, saveEvent, deleteEvent } = useOrbit()
  const { back, open, notify } = useUI()
  const { done, asOf } = useDerived()
  const e = events[id]

  if (!e) {
    return (
      <Modal title="Event not found" onClose={back} size="sm">
        <Empty>This event doesn't exist any more.</Empty>
      </Modal>
    )
  }

  const happened = async () => {
    const date = e.date > today() ? today() : e.date
    await saveEvent(id, { ...e, date, status: 'done' })
    notify('Marked as happened')
  }

  const remove = () =>
    open('confirm', {
      title: 'Delete this event?',
      body: <p>{e.title} on {formatDate(e.date)} will be removed from everyone's history.</p>,
      onConfirm: async () => {
        await deleteEvent(id)
        notify('Event deleted')
        back()
      },
    })

  const updates = Object.entries(e.updates || {}).filter(([pid]) => people[pid])

  return (
    <Modal
      eyebrow={e.kind}
      title={e.title || e.kind}
      onClose={back}
      footer={
        <>
          <Button variant="danger" onClick={remove}>
            Delete
          </Button>
          <span className="spacer" />
          <Button variant={e.status === 'planned' ? 'secondary' : 'quiet'} onClick={() => open('log', { eventId: id })}>
            Edit
          </Button>
          {e.status === 'planned' && (
            <Button variant="primary" onClick={happened}>
              It happened
            </Button>
          )}
        </>
      }
    >
      <div className="stack">
        <p className="meta-line">
          {formatDate(e.date)} · {e.kind}
          {e.place && ` · ${e.place}`} · <Badge tone={STATUS_TONE[e.status || 'done']}>{e.status || 'done'}</Badge>
        </p>
        <section>
          <h3 className="section-title">Who was there</h3>
          <div className="chips">
            {e.people.map((pid) => (
              <PersonChip key={pid} id={pid} full />
            ))}
          </div>
        </section>
        {updates.length > 0 && (
          <section>
            <h3 className="section-title">What they were up to</h3>
            <ul className="plain-list">
              {updates.map(([pid, text]) => (
                <li key={pid}>
                  <strong>{firstName(people[pid].name)}:</strong> {text}
                </li>
              ))}
            </ul>
          </section>
        )}
        {e.notes && (
          <section>
            <h3 className="section-title">Notes</h3>
            <p className="prose">{e.notes}</p>
          </section>
        )}
        {e.status === 'planned' && (
          <section>
            <h3 className="section-title">Ask them</h3>
            {e.people.map((pid) => {
              const p = people[pid]
              if (!p) return null
              const qs = questionsFor(pid, p, done, asOf, people).slice(0, 2)
              return (
                <div key={pid} className="ask-block">
                  <strong>{firstName(p.name)}</strong>
                  {qs.length ? (
                    <ul className="plain-list">
                      {qs.map((q) => (
                        <li key={q.q}>{q.q}</li>
                      ))}
                    </ul>
                  ) : (
                    <p className="muted">Nothing saved to ask about yet.</p>
                  )}
                </div>
              )
            })}
          </section>
        )}
      </div>
    </Modal>
  )
}
