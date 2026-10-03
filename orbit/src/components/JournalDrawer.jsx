import { useEffect, useRef, useState } from 'react'
import { useOrbit } from '../state/OrbitContext.jsx'
import { useUI } from '../state/UIContext.jsx'
import { formatDate } from '../lib/dates.js'
import { journalAnswersReady, journalCounts, pendingJournalDraft } from '../lib/journalClient.js'
import Modal from './ui/Modal.jsx'
import Button from './ui/Button.jsx'
import Badge from './ui/Badge.jsx'
import { DateField, Field, TextField } from './ui/Field.jsx'
import { ArrowLeft, Send } from './ui/icons.js'

const STATUS = {
  draft: ['neutral', 'Draft'],
  needs_details: ['warn', 'Needs details'],
  saved: ['success', 'Saved'],
  undone: ['neutral', 'Undone'],
  error: ['danger', 'Needs retry'],
}

function Question({ question, value, onChange, disabled }) {
  const options = question.options || []
  const selected = options.some((option) => option.value === value)
  const free = !selected && !!value
  const type = question.kind === 'date' ? 'date' : 'text'
  const allowFree = question.kind !== 'fact'
  return (
    <div className="journal-question">
      {options.length > 0 && (
        <Field label={question.text}>
          {(id) => (
            <select id={id} className="input" value={selected ? value : free && allowFree ? '__other__' : ''} onChange={(e) => onChange(e.target.value === '__other__' ? '' : e.target.value)} disabled={disabled}>
              <option value="">Choose an answer</option>
              {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              {allowFree && <option value="__other__">Another answer</option>}
            </select>
          )}
        </Field>
      )}
      {allowFree && (!options.length || !selected) && (type === 'date' ? (
        <DateField label={options.length ? 'Exact date' : question.text} value={free ? value : ''} onChange={onChange} disabled={disabled} />
      ) : (
        <TextField label={options.length ? 'Your answer' : question.text} value={free ? value : ''} onChange={onChange} maxLength={200} disabled={disabled} />
      ))}
    </div>
  )
}

export default function JournalDrawer({ entryId, onClose, onManual }) {
  const { ai, health, journals, journalState, journalError, reloadJournals, sendJournal, answerJournal, retryJournal, undoJournal } = useOrbit()
  const { openEvent, notify } = useUI()
  const [selectedId, setSelectedId] = useState(entryId || null)
  const [showEntries, setShowEntries] = useState(false)
  const [text, setText] = useState('')
  const [answers, setAnswers] = useState({})
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')
  const lock = useRef(false)
  const persisted = useRef(false)
  const pendingDraft = useRef(null)
  const inputRef = useRef(null)
  const entries = Object.values(journals).sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''))
  const counts = journalCounts(journals)
  const selected = selectedId ? journals[selectedId] : null
  const available = health?.journal?.available === true

  useEffect(() => {
    const pending = pendingDraft.current
    if (!pending || !journals[pending.id]) return
    pendingDraft.current = null
    persisted.current = true
    setSelectedId(pending.id)
    setText('')
  }, [journals])

  const choose = (entry) => {
    setSelectedId(entry.id)
    setAnswers(entry.answers || {})
    setError('')
  }

  const run = async (action, { needsPersist = false } = {}) => {
    if (lock.current) return
    lock.current = true
    persisted.current = !needsPersist
    setBusy(needsPersist ? 'saving' : 'processing')
    setError('')
    try {
      await action(() => {
        persisted.current = true
        setBusy('processing')
      })
    } catch (err) {
      setError(err.message || 'The journal request failed.')
    } finally {
      lock.current = false
      setBusy('')
      inputRef.current?.focus()
    }
  }

  const send = () => {
    if (!ai.available || !available || !text.trim() || lock.current) return
    const draft = pendingJournalDraft(pendingDraft.current, text)
    pendingDraft.current = draft
    setSelectedId(draft.id)
    const alreadySaved = journals[draft.id]
    if (alreadySaved) {
      setText('')
      pendingDraft.current = null
      run(() => retryJournal(alreadySaved))
      return
    }
    run(async (onPersist) => {
      await sendJournal(draft.text, draft.id, draft.context, (entry) => {
        onPersist(entry)
        setText('')
        pendingDraft.current = null
      })
    }, { needsPersist: true })
  }

  const submitAnswers = () => {
    if (!selected || !journalAnswersReady(selected, answers) || !ai.available) return
    run(() => answerJournal(selected, answers, () => {
      persisted.current = true
      setBusy('processing')
    }), { needsPersist: true })
  }

  const close = () => {
    if (busy === 'saving' && !persisted.current) return
    onClose()
  }

  const original = selected?.text || ''
  return (
    <Modal title="Orbit" variant="drawer" size="lg" onClose={close} disableClose={busy === 'saving' && !persisted.current} footer={
      <div className="journal-footer-actions">
        <Button variant="quiet" aria-expanded={showEntries} aria-controls="orbit-entry-history" onClick={() => setShowEntries((shown) => !shown)}>Entries</Button>
        {onManual && <Button variant="quiet" onClick={onManual} disabled={busy === 'saving'}>Manual entry</Button>}
        <Button onClick={close} disabled={busy === 'saving' && !persisted.current}>Close</Button>
      </div>
    }>
      <div className={`journal-layout${showEntries ? '' : ' journal-layout-compose'}`}>
        {showEntries && <section id="orbit-entry-history" className="journal-history" aria-labelledby="journal-history-title">
          <div className="section-head">
            <h3 id="journal-history-title" className="section-title">Entries</h3>
            {journalState === 'ready' && <span className="muted" aria-label={`${counts.total} entries`}>{counts.total}</span>}
          </div>
          {journalState === 'loading' && <p className="muted" role="status">Loading entries…</p>}
          {journalState === 'error' && <div className="notice notice-warn" role="alert"><p>{journalError}</p><Button size="sm" onClick={() => reloadJournals().catch(() => {})}>Retry</Button></div>}
          {journalState === 'ready' && entries.length === 0 && <p className="muted">No entries yet.</p>}
          {journalState === 'ready' && entries.length > 0 && (
            <ul className="journal-entry-list">
              {entries.map((entry) => (
                <li key={entry.id}>
                  <button type="button" className="journal-entry-button" aria-current={selectedId === entry.id ? 'true' : undefined} onClick={() => choose(entry)} disabled={!!busy}>
                    <span className="journal-entry-date">{formatDate((entry.createdAt || entry.referenceDate).slice(0, 10))}</span>
                    <span className="journal-entry-preview">{entry.receipt?.summary || entry.text}</span>
                    <Badge tone={STATUS[entry.status]?.[0] || 'neutral'}>{STATUS[entry.status]?.[1] || entry.status}</Badge>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>}

        <section className="journal-detail" aria-label={selected ? 'Journal entry' : selectedId ? 'Journal entry unavailable' : 'New entry'}>
          {!ai.available && <p className="muted" role="status">AI is off. Journal entries remain available.</p>}
          {selected ? (
            <>
              <div className="journal-detail-head">
                {ai.available && <Button size="sm" variant="ghost" onClick={() => { setSelectedId(null); setError('') }} disabled={!!busy}>
                  <ArrowLeft size={15} aria-hidden /> New entry
                </Button>}
                <Badge tone={STATUS[selected.status]?.[0] || 'neutral'} role="status" aria-live="polite">{STATUS[selected.status]?.[1] || selected.status}</Badge>
              </div>
              <details className="journal-original"><summary>Original entry</summary><p className="prose">{original}</p></details>
              {selected.status === 'needs_details' && (
                <div className="stack">
                  <h3 className="section-title">A few details</h3>
                  {selected.questions.map((question) => (
                    <Question key={question.id} question={question} value={answers[question.id] || ''} onChange={(value) => setAnswers((current) => ({ ...current, [question.id]: value }))} disabled={!!busy || !ai.available} />
                  ))}
                  {ai.available && <Button variant="primary" onClick={submitAnswers} disabled={!!busy || !journalAnswersReady(selected, answers)}>
                    {busy ? 'Saving…' : 'Continue'}
                  </Button>}
                </div>
              )}
              {selected.status === 'saved' && selected.receipt && (
                <div className="stack">
                  <h3 className="section-title">Saved to Orbit</h3>
                  <p className="prose" role="status" aria-live="polite">{selected.receipt.summary}</p>
                  {selected.receipt.lines?.length > 0 && <ul className="plain-list">{selected.receipt.lines.map((line, i) => <li key={i}>{line}</li>)}</ul>}
                  <div className="row-actions">
                    {selected.receipt.eventId && <Button variant="secondary" onClick={() => { close(); openEvent(selected.receipt.eventId) }}>Open event</Button>}
                    <Button variant="danger" onClick={() => run(async () => {
                      await undoJournal(selected)
                      onClose()
                      notify('Save undone')
                    })} disabled={!!busy}>Undo save</Button>
                  </div>
                </div>
              )}
              {selected.status === 'undone' && <p className="muted">This entry was undone. The original text is still here.</p>}
              {(selected.status === 'draft' || selected.status === 'error') && (
                <div className="stack">
                  {selected.error && <p className="field-error" role="alert">{selected.error}</p>}
                  {ai.available && <Button variant="secondary" onClick={() => run(() => retryJournal(selected))} disabled={!!busy}>
                    {busy ? 'Processing…' : 'Retry processing'}
                  </Button>}
                </div>
              )}
              {selected.provenance && (
                <details className="journal-provenance">
                  <summary>Processing details</summary>
                  <dl className="facts-dl">
                    <dt>Model</dt><dd>{selected.provenance.model}</dd>
                    <dt>Prompts</dt><dd>{Array.isArray(selected.provenance.prompts) ? selected.provenance.prompts.join(', ') : selected.provenance.prompts}</dd>
                    <dt>Processed</dt><dd>{selected.provenance.at && !Number.isNaN(Date.parse(selected.provenance.at)) ? new Date(selected.provenance.at).toLocaleString() : selected.provenance.at}</dd>
                  </dl>
                </details>
              )}
            </>
          ) : selectedId && !pendingDraft.current ? (
            <div className="stack" role="status">
              <p className="muted">{journalState === 'ready' ? 'Journal entry unavailable.' : journalState === 'error' ? 'Could not load this entry.' : journalState === 'unavailable' ? 'Journal storage is unavailable.' : 'Loading entry…'}</p>
              {journalState === 'ready' && ai.available && <Button variant="secondary" onClick={() => setSelectedId(null)}>New entry</Button>}
            </div>
          ) : ai.available ? (
            <div className="stack">
              <Field label="What happened?">
                {(id) => <textarea id={id} ref={inputRef} className="input textarea journal-textarea" value={text} onChange={(event) => setText(event.target.value)} rows={8} maxLength={8000} placeholder="Write about the time you spent together…" data-autofocus disabled={!ai.available || !available || !!busy || !!pendingDraft.current} onKeyDown={(event) => {
                  if (event.key === 'Enter' && (event.metaKey || event.ctrlKey) && !event.nativeEvent.isComposing) {
                    event.preventDefault()
                    send()
                  }
                }} />}
              </Field>
              <div className="journal-composer-actions">
                <span className="muted">{text.length} / 8000</span>
                <Button variant="primary" onClick={send} disabled={!ai.available || !available || !text.trim() || !!busy}>
                  <Send size={15} aria-hidden /> {busy ? 'Saving…' : pendingDraft.current ? 'Retry save' : 'Send'}
                </Button>
              </div>
            </div>
          ) : null}
          {busy === 'processing' && <p role="status" className="muted">Processing entry…</p>}
          {error && <div className="notice notice-warn" role="alert"><p>{error}</p></div>}
        </section>
      </div>
    </Modal>
  )
}
