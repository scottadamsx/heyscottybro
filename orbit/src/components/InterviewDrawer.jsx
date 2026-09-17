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

export default function InterviewDrawer({ about, onClose }) {
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
      const out = await ai.interview(turns, controller.current.signal, session)
      setLog((l) => [...l, ...out.lines.map((line) => ({ role: 'system', saved: true, content: line })), { role: 'assistant', content: out.reply }])
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
    if (about && people[about] && !started.current) {
      started.current = true
      send(`Let's talk about ${people[about].name}.`)
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
      eyebrow="Claude"
      title="Interview"
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
            placeholder="Tell me about someone…"
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
            I'll ask about the people in your life one question at a time and save what you tell me as we go. Nothing is made up; I only save what you say.
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
