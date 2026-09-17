import { useMemo, useState } from 'react'
import { useOrbit } from '../../state/OrbitContext.jsx'
import { normText } from '../../lib/dedupe.js'
import Avatar from './Avatar.jsx'

/** Toggle chips for choosing who was there, with a filter once the list gets long. */
export default function PeoplePicker({ value, onChange, label = 'Who was there' }) {
  const { people } = useOrbit()
  const [q, setQ] = useState('')
  const ids = useMemo(
    () => Object.keys(people).sort((a, b) => people[a].name.localeCompare(people[b].name)),
    [people],
  )
  const shown = q ? ids.filter((id) => normText(people[id].name).includes(normText(q)) || value.includes(id)) : ids
  const toggle = (id) => onChange(value.includes(id) ? value.filter((x) => x !== id) : [...value, id])

  return (
    <fieldset className="field">
      <legend>
        {label} {value.length > 0 && <span className="muted">({value.length})</span>}
      </legend>
      {ids.length > 12 && (
        <input className="input" placeholder="Filter people" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Filter people" />
      )}
      {ids.length === 0 ? (
        <p className="field-hint">Nobody in Orbit yet. Add a person first.</p>
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
        </div>
      )}
    </fieldset>
  )
}
