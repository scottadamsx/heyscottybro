import { useState } from 'react'
import { useOrbit } from '../../state/OrbitContext.jsx'
import { useUI } from '../../state/UIContext.jsx'
import { useDerived } from '../../state/useDerived.js'
import { today } from '../../lib/dates.js'
import { newId } from '../../lib/ids.js'
import Modal from '../ui/Modal.jsx'
import Button from '../ui/Button.jsx'
import { TextArea } from '../ui/Field.jsx'
import { firstName } from '../ui/PersonChip.jsx'
import LastSeen from './LastSeen.jsx'
import { Sparkles } from '../ui/icons.js'

export default function SayHiModal({ id, onClose }) {
  const { people, saveEvent, ai } = useOrbit()
  const { notify, open } = useUI()
  const { byPerson } = useDerived()
  const p = people[id]
  const [text, setText] = useState(`Hey ${firstName(p.name)}! How've you been? We should grab a coffee sometime soon.`)
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text)
      notify('Copied')
    } catch {
      setError("Couldn't copy. Select the text and copy it yourself.")
    }
  }

  const personal = async () => {
    setBusy('ai')
    setError('')
    try {
      setText(await ai.sayHi(id))
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy('')
    }
  }

  const logText = async () => {
    setBusy('log')
    try {
      await saveEvent(newId('e'), {
        date: today(),
        title: 'Said hi',
        kind: 'Text',
        place: '',
        people: [id],
        updates: {},
        notes: text.trim(),
        status: 'done',
        createdAt: new Date().toISOString(),
      })
      notify(`Logged a text to ${firstName(p.name)}`)
      onClose()
    } catch (err) {
      setBusy('')
      if (err.code === 'duplicate') setError('You already logged a text to them today.')
    }
  }

  return (
    <Modal
      title={`Say hi to ${firstName(p.name)}`}
      onClose={onClose}
      footer={
        <>
          <Button onClick={() => (onClose(), open('log', { people: [id], plan: true }))}>Plan a hangout</Button>
          <span className="spacer" />
          <Button variant="secondary" onClick={logText} disabled={!!busy || !text.trim()}>
            Log as sent text
          </Button>
          <Button variant="primary" onClick={copy} disabled={!text.trim()}>
            Copy
          </Button>
        </>
      }
    >
      <div className="stack">
        <LastSeen a={byPerson[id]} />
        <TextArea label="Message" value={text} onChange={setText} rows={4} maxLength={1000} data-autofocus />
        {ai.available && (
          <div>
            <Button size="sm" variant="ghost" onClick={personal} disabled={!!busy}>
              <Sparkles size={14} aria-hidden />
              {busy === 'ai' ? 'Writing…' : 'Make it personal'}
            </Button>
          </div>
        )}
        {error && <p className="field-error" role="alert">{error}</p>}
      </div>
    </Modal>
  )
}
