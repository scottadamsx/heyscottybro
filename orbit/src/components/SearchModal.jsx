import { useMemo, useState } from 'react'
import { useOrbit } from '../state/OrbitContext.jsx'
import { useUI } from '../state/UIContext.jsx'
import { searchAll } from '../lib/search.js'
import { formatDate } from '../lib/dates.js'
import Modal from './ui/Modal.jsx'
import Avatar from './ui/Avatar.jsx'
import Empty from './ui/Empty.jsx'
import Button from './ui/Button.jsx'

const MATCHED = { how: 'how you know them', fact: 'info', notes: 'notes', intent: 'to-do', update: 'update', group: 'group' }

/** Find anyone or anything: names, how you know them, facts, notes, updates, events. */
export default function SearchModal({ onClose }) {
  const { people, events } = useOrbit()
  const { openPerson, openEvent, open } = useUI()
  const [q, setQ] = useState('')
  const hits = useMemo(() => searchAll(people, events, q), [people, events, q])
  const go = (fn) => {
    onClose()
    fn()
  }

  return (
    <Modal title="Search" onClose={onClose} size="lg">
      <div className="stack">
        <input
          className="input"
          placeholder="A name, a company, a place, anything you told Orbit"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          aria-label="Search everything"
          data-autofocus
        />
        {q.trim() && !hits.people.length && !hits.events.length && (
          <Empty action={<Button variant="secondary" onClick={() => go(() => open('addPeople', { name: q }))}>+ Add "{q}"</Button>}>
            Nothing matches.
          </Empty>
        )}
        {hits.people.length > 0 && (
          <section className="section">
            <h3 className="section-title">People</h3>
            <ul className="rows">
              {hits.people.map((h) => (
                <li key={h.id} className="row">
                  <button type="button" className="row-button" onClick={() => go(() => openPerson(h.id))}>
                    <Avatar person={people[h.id]} />
                    <span className="row-main">
                      <span className="row-title">{h.name}</span>
                      {h.snippet && (
                        <span className="row-sub">
                          {MATCHED[h.matched]}: {h.snippet}
                        </span>
                      )}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}
        {hits.events.length > 0 && (
          <section className="section">
            <h3 className="section-title">Events</h3>
            <ul className="rows">
              {hits.events.map((h) => (
                <li key={h.id} className="row">
                  <button type="button" className="row-button" onClick={() => go(() => openEvent(h.id))}>
                    <span className="row-main">
                      <span className="row-title">{h.title}</span>
                      <span className="row-sub">
                        {formatDate(h.date)}
                        {h.snippet && ` · ${h.snippet}`}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </Modal>
  )
}
