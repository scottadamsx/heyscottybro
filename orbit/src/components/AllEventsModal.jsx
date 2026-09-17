import { useMemo, useState } from 'react'
import { useOrbit } from '../state/OrbitContext.jsx'
import { useUI } from '../state/UIContext.jsx'
import { normText } from '../lib/dedupe.js'
import Modal from './ui/Modal.jsx'
import Button from './ui/Button.jsx'
import Empty from './ui/Empty.jsx'
import EventRow from './EventRow.jsx'

const FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'done', label: 'Done' },
  { id: 'planned', label: 'Planned' },
  { id: 'skipped', label: 'Skipped' },
]

export default function AllEventsModal({ onClose }) {
  const { events, people } = useOrbit()
  const { open, openEvent } = useUI()
  const [q, setQ] = useState('')
  const [status, setStatus] = useState('all')
  const list = useMemo(() => {
    const needle = normText(q)
    return Object.entries(events)
      .filter(([, e]) => status === 'all' || (e.status || 'done') === status)
      .filter(([, e]) => {
        if (!needle) return true
        const hay = normText([e.title, e.kind, e.place, e.notes, ...e.people.map((p) => people[p]?.name)].join(' '))
        return hay.includes(needle)
      })
      .sort((a, b) => (a[1].date < b[1].date ? 1 : a[1].date > b[1].date ? -1 : 0))
  }, [events, people, q, status])

  return (
    <Modal title="All events" onClose={onClose} size="lg">
      <div className="stack">
        <div className="toolbar">
          <input className="input" placeholder="Search events" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search events" />
          <div className="segmented" role="group" aria-label="Filter by status">
            {FILTERS.map((f) => (
              <button key={f.id} type="button" className="seg" aria-pressed={status === f.id} onClick={() => setStatus(f.id)}>
                {f.label}
              </button>
            ))}
          </div>
        </div>
        {list.length === 0 ? (
          <Empty
            action={
              <Button variant="secondary" onClick={() => (onClose(), open('log'))}>
                + Log a hangout
              </Button>
            }
          >
            {Object.keys(events).length ? 'No events match.' : 'Nothing yet.'}
          </Empty>
        ) : (
          <ul className="rows">
            {list.map(([id, e]) => (
              <EventRow key={id} event={e} onOpen={() => (onClose(), openEvent(id))} showStatus />
            ))}
          </ul>
        )}
      </div>
    </Modal>
  )
}
