import { useState } from 'react'
import { useOrbit } from '../state/OrbitContext.jsx'
import { useUI } from '../state/UIContext.jsx'
import Modal from './ui/Modal.jsx'
import Button from './ui/Button.jsx'
import { TextArea } from './ui/Field.jsx'

function Section({ title, items }) {
  if (!items.length) return null
  return (
    <section className="section">
      <h3 className="section-title">
        {title} <span className="muted">({items.length})</span>
      </h3>
      <ul className="plain-list">
        {items.map((x) => (
          <li key={x}>{x}</li>
        ))}
      </ul>
    </section>
  )
}

/** Paste an export (people, events, questions), preview the changes, then apply. */
export default function ImportModal({ onClose }) {
  const { storage, reload } = useOrbit()
  const { notify } = useUI()
  const [text, setText] = useState('')
  const [preview, setPreview] = useState(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const send = async (apply) => {
    let body
    try {
      body = JSON.parse(text)
    } catch {
      return setError("That isn't valid JSON. Paste the whole block, including the first { and last }.")
    }
    setBusy(true)
    setError('')
    try {
      const r = await storage.importData(body, apply)
      if (apply) {
        await reload()
        notify(r.ok ? `Imported: ${r.result.created} new, ${r.result.updated} updated` : 'Imported with some problems')
        if (r.ok) onClose()
        else setError(r.result.failed.join('\n'))
      } else setPreview(r)
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      title="Import people"
      onClose={onClose}
      size="lg"
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          {preview ? (
            <Button variant="primary" onClick={() => send(true)} disabled={busy}>
              {busy ? 'Saving…' : 'Import these changes'}
            </Button>
          ) : (
            <Button variant="primary" onClick={() => send(false)} disabled={busy || !text.trim()}>
              Preview
            </Button>
          )}
        </>
      }
    >
      <div className="stack">
        {!preview && (
          <TextArea
            label="Export JSON"
            hint="Nothing is saved until you preview and confirm. Existing details are never overwritten."
            value={text}
            onChange={(v) => (setText(v), setPreview(null))}
            rows={12}
            data-autofocus
          />
        )}
        {preview && (
          <>
            <Section title="New people" items={preview.create} />
            <Section title="Updated" items={preview.update.map((u) => `${u.name}: ${u.changes.join(', ')}`)} />
            <Section title="Held for you, not imported" items={preview.hold.map((h) => `${h.name}: ${h.reason}`)} />
            <Section title="New events" items={preview.events.create} />
            <Section title="Events updated" items={preview.events.update} />
            <Section title="Events skipped" items={preview.events.skip.map((s) => `${s.title}: ${s.reason}`)} />
            <Section title="Already up to date" items={preview.unchanged} />
            <Section title="Questions to answer in the interview" items={preview.questions} />
            <div>
              <Button size="sm" variant="ghost" onClick={() => setPreview(null)}>
                Edit the JSON
              </Button>
            </div>
          </>
        )}
        {error && <p className="field-error" role="alert">{error}</p>}
      </div>
    </Modal>
  )
}
