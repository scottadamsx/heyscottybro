import { useState } from 'react'
import { useOrbit } from '../../state/OrbitContext.jsx'
import { useUI } from '../../state/UIContext.jsx'
import { dedupeIntents } from '../../lib/dedupe.js'
import { newId } from '../../lib/ids.js'
import { parseDollars } from '../../lib/money.js'
import Modal from '../ui/Modal.jsx'
import Button, { IconButton } from '../ui/Button.jsx'
import { X } from '../ui/icons.js'
import { DateField, TextField } from '../ui/Field.jsx'

const row = () => ({ key: newId('row'), text: '', amount: '', due: '' })

/** Add several "meant to" items or gift ideas at once. kind: todo | gift */
export default function IntentModal({ id, kind, onClose }) {
  const { people, savePerson } = useOrbit()
  const { notify } = useUI()
  const p = people[id]
  const gift = kind === 'gift'
  const [rows, setRows] = useState([row()])
  const [errors, setErrors] = useState({})
  const [busy, setBusy] = useState(false)
  const update = (key, patch) => setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)))

  const save = async () => {
    const filled = rows.filter((r) => r.text.trim())
    const e = {}
    for (const r of filled) if (gift && Number.isNaN(parseDollars(r.amount))) e[r.key] = 'Amount should look like 25 or 25.50.'
    if (!filled.length) e.form = 'Type at least one.'
    setErrors(e)
    if (Object.keys(e).length) return
    const before = p.intents || []
    const intents = dedupeIntents([
      ...before,
      ...filled.map((r) => ({ id: newId('i'), text: r.text.trim(), kind, amount: gift ? parseDollars(r.amount) : null, due: r.due || '', done: false })),
    ])
    const added = intents.length - before.length
    setBusy(true)
    try {
      await savePerson(id, { ...p, intents })
      notify(added ? `Added ${added}` : 'Already on the list')
      onClose()
    } catch {
      setBusy(false)
    }
  }

  return (
    <Modal
      title={gift ? `Gift ideas for ${p.name.split(' ')[0]}` : `Things you mean to do for ${p.name.split(' ')[0]}`}
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
      <form className="stack" onSubmit={(e) => (e.preventDefault(), save())}>
        {rows.map((r, i) => (
          <div key={r.key}>
            <div className="batch-fields">
              <TextField
                label={gift ? 'Gift idea' : 'Meant to'}
                placeholder={gift ? 'Hiking poles' : 'Return their tent'}
                value={r.text}
                onChange={(v) => update(r.key, { text: v })}
                maxLength={200}
                className="grow"
                data-autofocus={i === 0 ? true : undefined}
              />
              {gift && <TextField label="About ($)" inputMode="decimal" value={r.amount} onChange={(v) => update(r.key, { amount: v })} className="narrow-2" maxLength={10} />}
              <DateField label={gift ? 'By' : 'Follow up by'} value={r.due} onChange={(v) => update(r.key, { due: v })} className="narrow-3" />
              {rows.length > 1 && (
                <IconButton label={`Remove row ${i + 1}`} onClick={() => setRows((rs) => rs.filter((x) => x.key !== r.key))} className="batch-remove">
                  <X size={14} />
                </IconButton>
              )}
            </div>
            {errors[r.key] && <p className="field-error">{errors[r.key]}</p>}
          </div>
        ))}
        <div>
          <Button size="sm" variant="secondary" onClick={() => setRows((rs) => [...rs, row()])}>
            + Add another
          </Button>
        </div>
        {errors.form && <p className="field-error" role="alert">{errors.form}</p>}
        <button type="submit" hidden />
      </form>
    </Modal>
  )
}
