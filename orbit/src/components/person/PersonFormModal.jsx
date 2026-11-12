import { useRef, useState } from 'react'
import { useOrbit } from '../../state/OrbitContext.jsx'
import { useUI } from '../../state/UIContext.jsx'
import { GROUPS } from '../../lib/constants.js'
import { findDuplicatePerson } from '../../lib/dedupe.js'
import { isBirthday } from '../../lib/validate.js'
import { newId } from '../../lib/ids.js'
import { mediaStore } from '../../lib/runtime.js'
import Modal from '../ui/Modal.jsx'
import Button, { IconButton } from '../ui/Button.jsx'
import Avatar from '../ui/Avatar.jsx'
import { X } from '../ui/icons.js'
import { Field, SelectField, TextArea, TextField } from '../ui/Field.jsx'

const GROUP_OPTIONS = GROUPS.map((g) => ({ value: g.id, label: g.label }))
const blankRow = (group = 'friends') => ({ key: newId('row'), name: '', group, birthday: '', allow: false })

/** Add one or more people in one go. Blank rows are ignored. */
export function AddPeopleModal({ onClose, name = '' }) {
  const { people, savePerson } = useOrbit()
  const { notify, openPerson } = useUI()
  const [rows, setRows] = useState([{ ...blankRow(), name }])
  const [how, setHow] = useState('')
  const [errors, setErrors] = useState({})
  const [busy, setBusy] = useState(false)

  const update = (key, patch) => setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch, ...('name' in patch ? { allow: false } : {}) } : r)))
  const filled = rows.filter((r) => r.name.trim())

  // Duplicates against Orbit and against other rows in this batch.
  const dupOf = (row) => {
    const d = findDuplicatePerson(people, row.name)
    if (d) return { ...d, name: people[d.id].name }
    const twin = filled.find((r) => r.key !== row.key && r.name.trim().toLowerCase() === row.name.trim().toLowerCase())
    return twin && rows.indexOf(twin) < rows.indexOf(row) ? { match: 'batch' } : null
  }

  const save = async () => {
    const e = {}
    for (const r of filled) {
      if (r.birthday && !isBirthday(r.birthday)) e[r.key] = 'Birthday must be MM-DD or YYYY-MM-DD.'
      const d = dupOf(r)
      if (d?.match === 'batch') e[r.key] = 'Listed twice.'
      else if (d?.match === 'exact' && !r.allow) e[r.key] = 'Already in Orbit. Tick "Add anyway" if this is someone else.'
    }
    if (!filled.length) e.form = 'Type at least one name.'
    setErrors(e)
    if (Object.keys(e).length) return
    setBusy(true)
    let added = 0
    let firstId = null
    for (const r of filled) {
      const id = newId('p')
      try {
        await savePerson(
          id,
          {
            name: r.name.trim(),
            group: r.group,
            birthday: r.birthday.trim(),
            how: how.trim(),
            notes: '',
            facts: [],
            intents: [],
            createdAt: new Date().toISOString(),
          },
          { allowDuplicate: r.allow },
        )
        added++
        firstId ??= id
        setRows((rs) => rs.filter((x) => x.key !== r.key))
      } catch (err) {
        setErrors((x) => ({ ...x, [r.key]: err.code === 'duplicate' ? 'Already in Orbit.' : err.message }))
      }
    }
    setBusy(false)
    if (added) notify(`Added ${added} ${added === 1 ? 'person' : 'people'}`, firstId && added === 1 ? { action: { label: 'Open', run: () => openPerson(firstId) } } : {})
    if (added === filled.length) onClose()
  }

  return (
    <Modal
      title="Add people"
      onClose={onClose}
      size="lg"
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={save} disabled={busy}>
            {busy ? 'Adding…' : filled.length > 1 ? `Add ${filled.length} people` : 'Add person'}
          </Button>
        </>
      }
    >
      <form className="stack" onSubmit={(ev) => (ev.preventDefault(), save())}>
        {rows.map((r, i) => {
          const d = r.name.trim() && dupOf(r)
          return (
            <div key={r.key} className="batch-row">
              <div className="batch-fields">
                <TextField label="Name" value={r.name} onChange={(v) => update(r.key, { name: v })} maxLength={80} data-autofocus={i === 0 ? true : undefined} className="grow" />
                <SelectField label="Group" value={r.group} onChange={(v) => update(r.key, { group: v })} options={GROUP_OPTIONS} />
                <TextField label="Birthday" value={r.birthday} onChange={(v) => update(r.key, { birthday: v })} placeholder="MM-DD" maxLength={10} className="narrow-2" />
                {rows.length > 1 && (
                  <IconButton label={`Remove row ${i + 1}`} onClick={() => setRows((rs) => rs.filter((x) => x.key !== r.key))} className="batch-remove">
                    <X size={14} />
                  </IconButton>
                )}
              </div>
              {d?.match === 'exact' && (
                <div className="notice notice-warn">
                  <span>{d.name} is already in Orbit.</span>
                  <Button size="sm" variant="ghost" onClick={() => (onClose(), openPerson(d.id))}>
                    Open them
                  </Button>
                  <label className="check">
                    <input type="checkbox" checked={r.allow} onChange={(e) => update(r.key, { allow: e.target.checked, name: r.name })} /> Add anyway
                  </label>
                </div>
              )}
              {d?.match === 'similar' && <p className="field-hint">There's already a {d.name}. Add a last name if this is someone else.</p>}
              {errors[r.key] && <p className="field-error" role="alert">{errors[r.key]}</p>}
            </div>
          )
        })}
        <div>
          <Button size="sm" variant="secondary" onClick={() => setRows((rs) => [...rs, blankRow(rs.at(-1)?.group)])}>
            + Add another
          </Button>
        </div>
        <TextField label="How you know them" hint="Applies to everyone above. You can change it per person later." value={how} onChange={setHow} maxLength={200} />
        {errors.form && <p className="field-error" role="alert">{errors.form}</p>}
        <button type="submit" hidden />
      </form>
    </Modal>
  )
}

/**
 * The person's picture: pick a file, paste one, or drop one on the field —
 * the Frodo composer's gestures. Uploads go through the host's media store
 * (runtime.js); without one the field does not render. The chosen path is
 * saved with the form; replacing or removing only deletes the old stored
 * file after the save succeeds (EditPersonModal owns that).
 */
function PictureField({ id, name, group, photo, onPhoto }) {
  const media = mediaStore()
  const fileRef = useRef(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [dragOver, setDragOver] = useState(false)
  if (!media?.upload) return null

  const takeFile = async (file) => {
    if (!file || busy) return
    if (!/^image\/(png|jpeg|webp|gif)$/.test(file.type || '')) {
      setError('That file is not a picture I can use. Pick a PNG, JPEG, WebP or GIF.')
      return
    }
    setBusy(true)
    setError('')
    try {
      onPhoto(await media.upload(file, id))
    } catch (err) {
      setError(err.message || 'The picture could not be saved.')
    }
    setBusy(false)
  }

  return (
    <Field label="Picture" error={error} hint={photo ? undefined : 'A photo or screenshot of them.'}>
      {() => (
        <div
          className="batch-fields"
          onDragOver={(e) => { if (e.dataTransfer?.types?.includes('Files')) { e.preventDefault(); setDragOver(true) } }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => { e.preventDefault(); setDragOver(false); takeFile(e.dataTransfer?.files?.[0]) }}
          onPaste={(e) => {
            const img = [...(e.clipboardData?.items || [])].filter((i) => i.type.startsWith('image/')).map((i) => i.getAsFile()).filter(Boolean)[0]
            if (img) { e.preventDefault(); takeFile(img) }
          }}
          style={dragOver ? { outline: '2px dashed var(--color-accent, #888)', outlineOffset: 4 } : undefined}
        >
          <Avatar person={{ name, group, photo }} size="lg" />
          <Button type="button" size="sm" variant="secondary" onClick={() => fileRef.current?.click()} disabled={busy}>
            {busy ? 'Uploading…' : photo ? 'Change picture' : 'Add picture'}
          </Button>
          {photo && (
            <Button type="button" size="sm" variant="ghost" onClick={() => onPhoto('')} disabled={busy}>
              Remove
            </Button>
          )}
          <input
            ref={fileRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            hidden
            onChange={(e) => { takeFile(e.target.files?.[0]); e.target.value = '' }}
          />
        </div>
      )}
    </Field>
  )
}

/** Edit a person's basics. */
export function EditPersonModal({ id, onClose }) {
  const { people, savePerson } = useOrbit()
  const { notify, openPerson } = useUI()
  const p = people[id]
  const [form, setForm] = useState({ name: p.name, group: p.group || 'other', birthday: p.birthday || '', how: p.how || '', notes: p.notes || '' })
  const [photo, setPhoto] = useState(p.photo || '')
  const replacedPhotos = useRef([])
  const [errors, setErrors] = useState({})
  const [dup, setDup] = useState(null)
  const [busy, setBusy] = useState(false)
  const set = (k) => (v) => {
    setForm((f) => ({ ...f, [k]: v }))
    if (k === 'name') setDup(null)
  }

  // A replaced or removed picture's file goes only once this value is saved.
  const changePhoto = (next) => {
    if (photo && photo !== next) replacedPhotos.current.push(photo)
    setPhoto(next)
  }

  const save = async (allowDuplicate = false) => {
    const e = {}
    if (!form.name.trim()) e.name = 'Name is required.'
    if (form.birthday && !isBirthday(form.birthday.trim())) e.birthday = 'Use MM-DD or YYYY-MM-DD.'
    setErrors(e)
    if (Object.keys(e).length) return
    setBusy(true)
    try {
      await savePerson(id, { ...p, ...form, photo, name: form.name.trim(), birthday: form.birthday.trim(), how: form.how.trim(), notes: form.notes.trim() }, { allowDuplicate })
      const media = mediaStore()
      if (media?.remove) for (const old of replacedPhotos.current) if (old !== photo) media.remove(old).catch(() => {})
      replacedPhotos.current = []
      notify('Saved')
      onClose()
    } catch (err) {
      setBusy(false)
      if (err.code === 'duplicate') setDup(err.existingId)
    }
  }

  return (
    <Modal
      title={`Edit ${p.name}`}
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={() => save(false)} disabled={busy}>
            Save
          </Button>
        </>
      }
    >
      <form className="stack" onSubmit={(ev) => (ev.preventDefault(), save(false))}>
        {dup && people[dup] && (
          <div className="notice notice-warn" role="alert">
            <span>{people[dup].name} is already in Orbit.</span>
            <Button size="sm" variant="ghost" onClick={() => (onClose(), openPerson(dup))}>
              Open them
            </Button>
            <Button size="sm" onClick={() => save(true)}>
              Save anyway
            </Button>
          </div>
        )}
        <TextField label="Name" value={form.name} onChange={set('name')} error={errors.name} maxLength={80} data-autofocus />
        <PictureField id={id} name={form.name} group={form.group} photo={photo} onPhoto={changePhoto} />
        <div className="grid-2">
          <SelectField label="Group" value={form.group} onChange={set('group')} options={GROUP_OPTIONS} />
          <TextField label="Birthday" hint="MM-DD, or YYYY-MM-DD if you know the year" value={form.birthday} onChange={set('birthday')} error={errors.birthday} maxLength={10} />
        </div>
        <TextField label="How you know each other" value={form.how} onChange={set('how')} maxLength={200} />
        <TextArea label="Notes" value={form.notes} onChange={set('notes')} rows={4} maxLength={8000} />
        <button type="submit" hidden />
      </form>
    </Modal>
  )
}
