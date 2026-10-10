import { useEffect, useRef, useState } from 'react'
import { useOrbit } from '../state/OrbitContext.jsx'
import Modal from './ui/Modal.jsx'
import Button from './ui/Button.jsx'
import { Check } from './ui/icons.js'

// The conversation survives closing the drawer until the page reloads.
let saved = []
// Groups this conversation's turns in data/chat-log.jsonl.
let session = `chat-${Date.now().toString(36)}`

/**
 * Text turns for the API. What was saved during a reply is attached to that reply as a
 * [saved: ...] list, so the agent knows not to save it again on the next message.
 */
function toTurns(log) {
  const turns = []
  let pending = []
  for (const m of log) {
    if (m.role === 'system') {
      if (m.saved) pending.push(m.content)
    } else if (m.role === 'assistant') {
      turns.push({ role: 'assistant', content: pending.length ? `${m.content}\n[saved: ${pending.join('; ')}]` : m.content })
      pending = []
    } else turns.push({ role: 'user', content: m.content })
  }
  return turns
}

const CHIPS = [
  { label: 'Pick someone for me', send: 'Pick someone for me to tell you about.' },
  { label: 'Brain dump', fill: 'Brain dump: ' },
  { label: 'Gift ideas', send: "Let's go through gift ideas. Ask me who I need to get gifts for." },
]

export default function InterviewDrawer({ about, onClose, onManual, sourceHostEventId, eventDate, eventTitle, eventPeople = [], reminderId, occurrenceDate, goal = '' }) {
  const { ai, people, reload } = useOrbit()
  const [log, setLog] = useState(saved)
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const controller = useRef(null)
  const inputRef = useRef(null)
  const endRef = useRef(null)
  const started = useRef(false)

  useEffect(() => {
    saved = log
    endRef.current?.scrollIntoView({ block: 'end' })
  }, [log])

  const sending = useRef(false)
  const send = async (content) => {
    const body = content.trim()
    // A ref, not state: two quick Enter presses both see the old state before React re-renders.
    if (!body || sending.current) return
    sending.current = true
    const next = [...log, { role: 'user', content: body }]
    setLog(next)
    setText('')
    setBusy(true)
    controller.current = new AbortController()
    try {
      const turns = toTurns(next)
      const context = goal === 'log_hangout' || sourceHostEventId || reminderId
        ? { sourceHostEventId, goal: 'log_hangout', eventDate, eventTitle }
        : {}
      const out = await ai.interview(turns, controller.current.signal, session, context)
      setLog((l) => [...l, ...out.lines.map((line) => ({ role: 'system', saved: true, content: line })), { role: 'assistant', content: out.reply }])
      for (const source of out.hostEvents || []) {
        window.dispatchEvent(new CustomEvent('orbit:host-event-saved', { detail: source }))
      }
      if (reminderId && occurrenceDate && out.loggedEvent) {
        window.dispatchEvent(new CustomEvent('app:reminder-destination-saved', { detail: { reminderId, occurrenceDate, destination: 'Orbit hangout' } }))
      }
      if (out.wrote) reload()
    } catch (err) {
      if (err.name === 'AbortError') {
        setLog((l) => [...l, { role: 'system', content: 'Stopped. Anything already saved stays saved.' }])
        reload()
      } else {
        setLog((l) => [...l, { role: 'system', tone: 'error', content: err.message }])
      }
    } finally {
      sending.current = false
      setBusy(false)
      controller.current = null
      inputRef.current?.focus()
    }
  }

  // Opening from someone's card starts the conversation about them.
  useEffect(() => {
    if (!started.current && ((about && people[about]) || sourceHostEventId || eventDate || reminderId || goal === 'log_hangout')) {
      started.current = true
      if (sourceHostEventId || eventDate || reminderId) {
        saved = []
        session = `chat-${Date.now().toString(36)}`
        setLog([])
        const event = eventTitle ? `the calendar event “${eventTitle}” on ${eventDate || 'the scheduled date'}` : 'a hangout I want to log'
        const attendees = eventPeople.map((id) => people[id]?.name).filter(Boolean)
        send(`I want to log ${event} in Orbit.${attendees.length ? ` Start with ${attendees.join(' and ')} as the people I named; confirm whether anyone else was there.` : ''} Ask me who was there and what happened. Keep the supplied title and date, do not guess attendees, and ask before logging if any required detail is missing.`)
      } else send(`Let's talk about ${people[about].name}.`)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [about])

  const close = () => {
    controller.current?.abort()
    onClose()
  }

  const reset = () => {
    controller.current?.abort()
    session = `chat-${Date.now().toString(36)}`
    setLog([])
  }

  return (
    <Modal
      variant="drawer"
      eyebrow="Personal assistant"
      title="Orbit"
      onClose={close}
      footer={
        <form
          className="chat-form"
          onSubmit={(e) => {
            e.preventDefault()
            send(text)
          }}
        >
          <textarea
            ref={inputRef}
            className="input textarea"
            rows={2}
            value={text}
            placeholder={goal === 'log_hangout' ? 'Tell me who was there and what happened…' : 'Tell me about someone…'}
            aria-label="Message"
            maxLength={4000}
            data-autofocus
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                send(text)
              }
            }}
          />
          {busy ? (
            <Button variant="danger" onClick={() => controller.current?.abort()}>
              Stop
            </Button>
          ) : (
            <Button variant="primary" type="submit" disabled={!text.trim()}>
              Send
            </Button>
          )}
        </form>
      }
    >
      <div className="chat" aria-live="polite">
        {log.length === 0 && (
          <p className="muted">
            {goal === 'log_hangout'
              ? 'I’ll help log this hangout by asking one question at a time. I won’t guess who was there; you can switch to manual entry at any time.'
              : 'I’ll ask about the people in your life one question at a time and save what you tell me as we go. Nothing is made up; I only save what you say.'}
          </p>
        )}
        {log.map((m, i) => (
          <div key={i} className={`bubble bubble-${m.role}${m.tone ? ` bubble-${m.tone}` : ''}`}>
            {m.saved && <Check size={12} aria-label="Saved:" />}
            {m.content}
          </div>
        ))}
        {busy && <div className="bubble bubble-assistant typing">Thinking…</div>}
        <div ref={endRef} />
      </div>
      <div className="chips chat-chips">
        {onManual && <button type="button" className="chip" onClick={onManual}>Use manual entry</button>}
        {CHIPS.map((c) => (
          <button
            key={c.label}
            type="button"
            className="chip"
            disabled={busy}
            onClick={() => {
              if (c.send) send(c.send)
              else {
                setText(c.fill)
                inputRef.current?.focus()
              }
            }}
          >
            {c.label}
          </button>
        ))}
        {log.length > 0 && (
          <button type="button" className="chip" onClick={reset}>
            Start over
          </button>
        )}
      </div>
    </Modal>
  )
}
