import { useState } from 'react'
import { useOrbit } from '../state/OrbitContext.jsx'
import { useUI } from '../state/UIContext.jsx'
import { RINGS } from '../lib/constants.js'
import { parseDollars } from '../lib/money.js'
import Modal from './ui/Modal.jsx'
import Button from './ui/Button.jsx'
import { TextField } from './ui/Field.jsx'

const KINDS = [
  { id: 'xmas', label: 'Christmas' },
  { id: 'bday', label: 'Birthday' },
]
const toText = (cents) => (cents ? String(cents / 100) : '')

export default function BudgetModal({ onClose }) {
  const { settings, saveSettings } = useOrbit()
  const { notify } = useUI()
  const [form, setForm] = useState(() => Object.fromEntries(KINDS.map((k) => [k.id, settings.budget[k.id].slice(0, 3).map(toText)])))
  const [error, setError] = useState('')

  const save = async () => {
    const budget = {}
    for (const k of KINDS) {
      const cents = form[k.id].map(parseDollars)
      if (cents.some((c) => Number.isNaN(c))) return setError('Amounts should look like 50 or 49.99.')
      budget[k.id] = [...cents.map((c) => c ?? 0), 0]
    }
    try {
      await saveSettings({ ...settings, budget })
      notify('Budgets saved')
      onClose()
    } catch {
      /* banner shows the reason */
    }
  }

  return (
    <Modal
      title="Gift budgets"
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={save}>
            Save
          </Button>
        </>
      }
    >
      <form className="stack" onSubmit={(e) => (e.preventDefault(), save())}>
        <p className="muted">Per person, by ring. Orbit and Not logged get no budget.</p>
        {KINDS.map((k) => (
          <fieldset key={k.id} className="field">
            <legend>{k.label} ($)</legend>
            <div className="grid-3">
              {RINGS.slice(0, 3).map((ring, i) => (
                <TextField
                  key={ring}
                  label={ring}
                  inputMode="decimal"
                  value={form[k.id][i]}
                  onChange={(v) => setForm((f) => ({ ...f, [k.id]: f[k.id].map((x, j) => (j === i ? v : x)) }))}
                  placeholder="0"
                  maxLength={9}
                />
              ))}
            </div>
          </fieldset>
        ))}
        {error && <p className="field-error" role="alert">{error}</p>}
        <button type="submit" hidden />
      </form>
    </Modal>
  )
}
