import { useState } from 'react'
import { useOrbit } from '../../state/OrbitContext.jsx'
import { useUI } from '../../state/UIContext.jsx'
import { TOPICS } from '../../lib/constants.js'
import { mergeFacts } from '../../lib/dedupe.js'
import { newId } from '../../lib/ids.js'
import Modal from '../ui/Modal.jsx'
import Button, { IconButton } from '../ui/Button.jsx'
import { X } from '../ui/icons.js'
import { SelectField, TextField } from '../ui/Field.jsx'

const TOPIC_OPTIONS = TOPICS.map((t) => ({ value: t.id, label: t.label }))
const row = (topic = 'family', k = '', v = '', ref = '') => ({ key: newId('row'), topic, k, v, ref })

/** Add several facts at once, or edit one (index). */
export default function FactModal({ id, topic = 'family', index, onClose }) {
  const { people, savePerson } = useOrbit()
  const { notify } = useUI()
  const p = people[id]
  const editing = index != null ? p.facts[index] : null
  const [rows, setRows] = useState(() => [editing ? row(editing.topic || 'other', editing.k, editing.v || '', editing.ref || '') : row(topic)])
  const personOptions = [
    { value: '', label: 'Nobody' },
    ...Object.entries(people)
      .filter(([pid]) => pid !== id)
      .sort((a, b) => a[1].name.localeCompare(b[1].name))
      .map(([pid, o]) => ({ value: pid, label: o.name })),
  ]
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const update = (key, patch) => setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)))

  const save = async () => {
    const filled = rows.filter((r) => r.k.trim() || r.v.trim() || r.ref)
    if (filled.some((r) => !r.k.trim())) return setError('Every entry needs a "What" (e.g. Job, Sister, Program).')
    if (!filled.length) return setError('Fill in at least one.')
    const incoming = filled.map((r) => ({
      k: r.k.trim(),
      v: r.v.trim() || (r.ref ? people[r.ref].name : ''),
      topic: r.topic,
      ...(r.ref ? { ref: r.ref } : {}),
    }))
    const base = editing ? p.facts.filter((_, i) => i !== index) : p.facts || []
    let facts
    let added = 0
    if (editing) facts = [...base.slice(0, index), incoming[0], ...base.slice(index)]
    else {
      const merged = mergeFacts(base, incoming)
      facts = merged.facts
      added = merged.added + merged.replaced
    }
    setBusy(true)
    try {
      await savePerson(id, { ...p, facts })
      notify(editing ? 'Saved' : added ? `Added ${added} ${added === 1 ? 'thing' : 'things'}` : 'Already saved; nothing new')
      onClose()
    } catch {
      setBusy(false)
    }
  }

  return (
    <Modal
      title={editing ? 'Edit info' : `Add info about ${p.name.split(' ')[0]}`}
      onClose={onClose}
      size="lg"
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
          <div key={r.key} className="batch-fields">
            <SelectField label="Topic" value={r.topic} onChange={(v) => update(r.key, { topic: v })} options={TOPIC_OPTIONS} />
            <TextField label="What" placeholder="Job, Sister, Program…" value={r.k} onChange={(v) => update(r.key, { k: v })} maxLength={60} data-autofocus={i === 0 ? true : undefined} />
            <TextField label="Detail" placeholder="Nurse at the Health Sciences" value={r.v} onChange={(v) => update(r.key, { v: v })} maxLength={200} className="grow" />
            <SelectField label="About someone in Orbit" value={r.ref} onChange={(v) => update(r.key, { ref: v })} options={personOptions} />
            {rows.length > 1 && (
              <IconButton label={`Remove row ${i + 1}`} onClick={() => setRows((rs) => rs.filter((x) => x.key !== r.key))} className="batch-remove">
                <X size={14} />
              </IconButton>
            )}
          </div>
        ))}
        {!editing && (
          <div>
            <Button size="sm" variant="secondary" onClick={() => setRows((rs) => [...rs, row(rs.at(-1)?.topic)])}>
              + Add another
            </Button>
          </div>
        )}
        {error && <p className="field-error" role="alert">{error}</p>}
        <button type="submit" hidden />
      </form>
    </Modal>
  )
}
