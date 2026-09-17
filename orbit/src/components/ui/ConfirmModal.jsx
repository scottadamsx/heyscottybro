import { useState } from 'react'
import Modal from './Modal.jsx'
import Button from './Button.jsx'

/** Small confirm for destructive actions. `onConfirm` may be async. */
export default function ConfirmModal({ title, body, confirmLabel = 'Delete', onConfirm, onClose }) {
  const [busy, setBusy] = useState(false)
  const go = async () => {
    setBusy(true)
    try {
      await onConfirm()
      onClose()
    } catch {
      setBusy(false)
    }
  }
  return (
    <Modal
      title={title}
      onClose={onClose}
      size="sm"
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="danger" onClick={go} disabled={busy} data-autofocus>
            {busy ? 'Working…' : confirmLabel}
          </Button>
        </>
      }
    >
      <div className="stack">{body}</div>
    </Modal>
  )
}
