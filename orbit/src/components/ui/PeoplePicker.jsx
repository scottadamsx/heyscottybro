import { useMemo, useState } from 'react'
import { useOrbit } from '../../state/OrbitContext.jsx'
import { findDuplicatePerson, normText } from '../../lib/dedupe.js'
import { newId } from '../../lib/ids.js'
import Avatar from './Avatar.jsx'

/** Toggle chips for choosing who was there, with a filter that can also add someone new. */
export default function PeoplePicker({ value, onChange, label = 'Who was there' }) {
  const { people, savePerson } = useOrbit()
  const [q, setQ] = useState('')
  const [adding, setAdding] = useState(false)
  const [error, setError] = useState('')
  const ids = useMemo(
    () => Object.keys(people).sort((a, b) => people[a].name.localeCompare(people[b].name)),
    [people],
  )
  const shown = q ? ids.filter((id) => normText(people[id].name).includes(normText(q)) || value.includes(id)) : ids
  const toggle = (id) => onChange(value.includes(id) ? value.filter((x) => x !== id) : [...value, id])

  const name = q.trim()
  // Offer creation only when nobody already carries this exact name; a partial
  // match ("Sam" vs "Samir Rajani") can still be a genuinely new person.
  const canAdd = Boolean(name) && !adding && findDuplicatePerson(people, name)?.match !== 'exact'

  const addPerson = async () => {
    setAdding(true)
    setError('')
    const id = newId('p')
    try {
      // Same document and defaults the Orbit page's own Add people form saves.
      await savePerson(id, {
        name,
        group: 'friends',
        birthday: '',
        how: '',
        notes: '',
        facts: [],
        intents: [],
        createdAt: new Date().toISOString(),
      })
      onChange([...value, id])
      setQ('')
    } catch (err) {
      setError(err.code === 'duplicate' ? `${name} is already in Orbit.` : 'That person could not be added. Try again.')
    }
    setAdding(false)
  }

  return (
    <fieldset className="field">
      <legend>
        {label} {value.length > 0 && <span className="muted">({value.length})</span>}
      </legend>
      <input
        className="input people-filter"
        placeholder="Filter people, or type a new name"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        aria-label="Filter people, or type a new name"
      />
      {error && <p className="field-error" role="alert">{error}</p>}
      {ids.length === 0 && !name ? (
        <p className="field-hint">Nobody in Orbit yet. Type their name above to add them.</p>
      ) : (
        <div className="chips">
          {shown.map((id) => (
            <button
              key={id}
              type="button"
              className="chip"
              aria-pressed={value.includes(id)}
              onClick={() => toggle(id)}
            >
              <Avatar person={people[id]} size="xs" />
              {people[id].name}
            </button>
          ))}
          {canAdd && (
            <button type="button" className="chip chip-add" onClick={addPerson} disabled={adding}>
              {adding ? 'Adding…' : `+ Add new person: ${name}`}
            </button>
          )}
        </div>
      )}
    </fieldset>
  )
}
