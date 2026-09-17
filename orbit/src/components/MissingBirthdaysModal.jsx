import { useState } from 'react'
import { useOrbit } from '../state/OrbitContext.jsx'
import { useUI } from '../state/UIContext.jsx'
import { isBirthday } from '../lib/validate.js'
import Modal from './ui/Modal.jsx'
import Button from './ui/Button.jsx'
import { TextField } from './ui/Field.jsx'

/** Fill in several missing birthdays in one go. Blank ones are left alone. */
export default function MissingBirthdaysModal({ onClose }) {
  const { people, savePerson } = useOrbit()
  const { notify } = useUI()
  const ids = Object.keys(people)
    .filter((id) => !people[id].birthday)
    .sort((a, b) => people[a].name.localeCompare(people[b].name))
  const [values, setValues] = useState({})
  const [errors, setErrors] = useState({})
  const [busy, setBusy] = useState(false)

  const save = async () => {
    const e = {}
    const filled = Object.entries(values).filter(([, v]) => v.trim())
    for (const [id, v] of filled) if (!isBirthday(v.trim())) e[id] = 'Use MM-DD or YYYY-MM-DD.'
    setErrors(e)
    if (Object.keys(e).length) return
    setBusy(true)
    let n = 0
    for (const [id, v] of filled) {
      try {
        await savePerson(id, { ...people[id], birthday: v.trim() })
        n++
      } catch {
        /* banner explains */
      }
    }
    notify(n ? `Saved ${n} birthday${n === 1 ? '' : 's'}` : 'Nothing to save')
    onClose()
  }

  return (
    <Modal
      title="Missing birthdays"
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={save} disabled={busy}>
            Save
          </Button>
        </>
      }
    >
      <form className="stack" onSubmit={(ev) => (ev.preventDefault(), save())}>
        <p className="muted">MM-DD, or YYYY-MM-DD if you know the year. Leave blank to skip.</p>
        {ids.map((id, i) => (
          <TextField
            key={id}
            label={people[id].name}
            value={values[id] || ''}
            onChange={(v) => setValues((x) => ({ ...x, [id]: v }))}
            error={errors[id]}
            placeholder="MM-DD"
            maxLength={10}
            data-autofocus={i === 0 ? true : undefined}
          />
        ))}
        {!ids.length && <p className="muted">Everyone has a birthday saved.</p>}
        <button type="submit" hidden />
      </form>
    </Modal>
  )
}
