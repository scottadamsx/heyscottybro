import { useMemo, useState } from 'react'
import { useOrbit } from '../state/OrbitContext.jsx'
import { useUI } from '../state/UIContext.jsx'
import { addDays, formatDate, today } from '../lib/dates.js'
import { findDuplicateEvent } from '../lib/dedupe.js'
import { isYMD } from '../lib/validate.js'
import { newId } from '../lib/ids.js'
import { KIND_GROUPS, STATUS_OPTIONS } from '../lib/eventKinds.js'
import Modal from './ui/Modal.jsx'
import Button from './ui/Button.jsx'
import { DateField, SelectField, TextArea, TextField } from './ui/Field.jsx'
import PeoplePicker from './ui/PeoplePicker.jsx'
import { firstName } from './ui/PersonChip.jsx'
import InterviewDrawer from './InterviewDrawer.jsx'

/**
 * Log a hangout, plan one, or edit an event.
 * props: eventId (edit) · people · date · kind · title · status · plan (default to a week out)
 */
export default function LogModal({ eventId, onClose, mode, ...prefill }) {
  const { people, events, saveEvent, ai } = useOrbit()
  const { notify, openEvent } = useUI()
  const effectiveEventId = eventId || (prefill.sourceHostEventId ? `host_${prefill.sourceHostEventId}` : null)
  const existing = effectiveEventId ? events[effectiveEventId] : null
  const startInOrbit = ai.available && !eventId && !prefill.plan && (!effectiveEventId || (prefill.sourceHostEventId && !existing))
  const now = today()

  const [form, setForm] = useState(() => ({
    date: existing?.date ?? prefill.date ?? (prefill.plan ? addDays(now, 7) : now),
    kind: existing?.kind ?? prefill.kind ?? 'Hangout',
    title: existing?.title ?? prefill.title ?? '',
    place: existing?.place ?? '',
    people: existing?.people ?? prefill.people ?? [],
    updates: existing?.updates ?? {},
    notes: existing?.notes ?? '',
    status: prefill.status ?? existing?.status ?? 'done',
  }))
  const [errors, setErrors] = useState({})
  const [dup, setDup] = useState(null)
  const [busy, setBusy] = useState(false)
  const [entryMode, setEntryMode] = useState(() => mode || (startInOrbit ? 'orbit' : 'manual'))
  const set = (k) => (v) => {
    setForm((f) => ({ ...f, [k]: v }))
    setDup(null)
  }

  const future = isYMD(form.date) && form.date > now
  const status = existing ? form.status : future ? 'planned' : 'done'
  const similar = useMemo(() => {
    if (!isYMD(form.date) || !form.people.length) return null
    const d = findDuplicateEvent(events, { ...form, status }, effectiveEventId)
    return d?.match === 'similar' ? d.id : null
  }, [events, form, status, effectiveEventId])

  const build = () => ({
    ...(existing || {}),
    date: form.date,
    kind: form.kind,
    title: form.title.trim() || form.kind,
    place: form.place.trim(),
    people: form.people,
    updates: Object.fromEntries(
      Object.entries(form.updates)
        .filter(([id, t]) => form.people.includes(id) && t.trim())
        .map(([id, t]) => [id, t.trim()]),
    ),
    notes: form.notes.trim(),
    status,
    ...(prefill.sourceHostEventId ? { sourceHostEventId: prefill.sourceHostEventId } : {}),
    createdAt: existing?.createdAt ?? new Date().toISOString(),
  })

  const save = async (allowDuplicate = false) => {
    const e = {}
    if (!isYMD(form.date)) e.date = 'Pick a date.'
    if (!form.people.length) e.people = 'Pick at least one person.'
    if (status === 'done' && future) e.status = 'A future date can only be planned.'
    setErrors(e)
    if (Object.keys(e).length) return
    const doc = build()
    const id = effectiveEventId || newId('e')
    if (!allowDuplicate) {
      const d = findDuplicateEvent(events, doc, effectiveEventId)
      if (d?.match === 'exact' && (!existing || findDuplicateEvent({ x: existing }, doc)?.match !== 'exact')) {
        setDup(d.id)
        return
      }
    }
    setBusy(true)
    try {
      await saveEvent(id, doc, { allowDuplicate })
      if (prefill.sourceHostEventId) {
        window.dispatchEvent(new CustomEvent('orbit:host-event-saved', { detail: { sourceHostEventId: prefill.sourceHostEventId, orbitEventId: id } }))
      }
      if (prefill.reminderId && prefill.occurrenceDate) {
        window.dispatchEvent(new CustomEvent('app:reminder-destination-saved', { detail: { reminderId: prefill.reminderId, occurrenceDate: prefill.occurrenceDate, destination: 'Orbit hangout' } }))
      }
      const who = doc.people.map((p) => firstName(people[p]?.name)).join(', ')
      notify(existing ? 'Saved' : `${status === 'planned' ? 'Planned' : 'Logged'} ${doc.title} with ${who}`)
      onClose()
    } catch (err) {
      setBusy(false)
      if (err.code === 'duplicate') setDup(err.existingId)
    }
  }

  const label = existing ? 'Save' : future ? 'Plan it' : 'Log it'
  const dupEvent = dup && events[dup]

  if (entryMode === 'orbit' && ai.available && (!effectiveEventId || (prefill.sourceHostEventId && !existing)) && !prefill.plan) {
    return <InterviewDrawer onClose={onClose} onManual={() => setEntryMode('manual')} goal="log_hangout" eventPeople={prefill.people || []} sourceHostEventId={prefill.sourceHostEventId} eventDate={prefill.date} eventTitle={prefill.title} reminderId={prefill.reminderId} occurrenceDate={prefill.occurrenceDate} />
  }

  return (
    <Modal
      title={existing ? 'Edit event' : future ? 'Plan a hangout' : 'Log a hangout'}
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={() => save(false)} disabled={busy}>
            {busy ? 'Saving…' : label}
          </Button>
        </>
      }
    >
      {ai.available && !effectiveEventId && !prefill.plan && (
        <div className="journal-mode-switch segmented" role="group" aria-label="Entry method">
          <button type="button" className="seg" aria-pressed={false} onClick={() => setEntryMode('orbit')} disabled={busy}>Orbit</button>
          <button type="button" className="seg" aria-pressed={true}>Manual entry</button>
        </div>
      )}
      <form
        className="stack"
        onSubmit={(e) => {
          e.preventDefault()
          save(false)
        }}
      >
        {dupEvent && (
          <div className="notice notice-warn" role="alert">
            <p>
              <strong>Already logged:</strong> {dupEvent.title} on {formatDate(dupEvent.date)} with the same people.
            </p>
            <div className="row-actions">
              <Button size="sm" variant="secondary" onClick={() => (onClose(), openEvent(dup))}>
                Open it
              </Button>
              <Button size="sm" onClick={() => save(true)}>
                Save anyway
              </Button>
            </div>
          </div>
        )}
        <div className="grid-2">
          <DateField label="Date" value={form.date} onChange={set('date')} error={errors.date} required data-autofocus />
          <SelectField label="Occasion" value={form.kind} onChange={set('kind')} groups={KIND_GROUPS} />
        </div>
        <div className="grid-2">
          <TextField label="What" value={form.title} onChange={set('title')} placeholder={form.kind} maxLength={120} />
          <TextField label="Where" value={form.place} onChange={set('place')} maxLength={120} />
        </div>
        {existing && (
          <SelectField label="Status" value={form.status} onChange={set('status')} options={STATUS_OPTIONS} />
        )}
        {errors.status && <p className="field-error">{errors.status}</p>}
        <PeoplePicker value={form.people} onChange={set('people')} />
        {errors.people && <p className="field-error" role="alert">{errors.people}</p>}
        {similar && !dupEvent && (
          <p className="field-hint">
            Heads up: {events[similar].title} on the same day already includes some of these people.
          </p>
        )}
        {form.people.map((id) => (
          <TextField
            key={id}
            label={`What's ${firstName(people[id]?.name)} up to?`}
            value={form.updates[id] || ''}
            onChange={(v) => set('updates')({ ...form.updates, [id]: v })}
            placeholder="New job, moving, training for something…"
            maxLength={280}
          />
        ))}
        <TextArea label="Notes" value={form.notes} onChange={set('notes')} maxLength={4000} />
        <button type="submit" hidden />
      </form>
    </Modal>
  )
}
