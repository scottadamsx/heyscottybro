import { useEffect, useId, useRef } from 'react'
import { IconButton } from './Button.jsx'
import { X } from './icons.js'

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

/**
 * Dialog shell. variant "modal" is centred (a bottom sheet under 620px); "drawer" slides in from
 * the right. Focus moves in on open, Tab stays inside, Esc closes, focus returns on close.
 */
export default function Modal({ title, eyebrow, onClose, children, footer, variant = 'modal', size = 'md', labelledBy, disableClose = false }) {
  const ref = useRef(null)
  const id = useId()
  const closeRef = useRef(onClose)
  closeRef.current = onClose

  useEffect(() => {
    const node = ref.current
    // getRootNode: the shadow root when Orbit is embedded, otherwise the document.
    const root = node.getRootNode()
    const previous = root.activeElement
    const first = node.querySelector('[data-autofocus]') || node.querySelector(FOCUSABLE)
    first?.focus()
    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        closeRef.current()
      }
      if (e.key !== 'Tab') return
      const items = [...node.querySelectorAll(FOCUSABLE)].filter((el) => el.offsetParent !== null)
      if (!items.length) return
      const [a, z] = [items[0], items.at(-1)]
      if (e.shiftKey && root.activeElement === a) {
        e.preventDefault()
        z.focus()
      } else if (!e.shiftKey && root.activeElement === z) {
        e.preventDefault()
        a.focus()
      }
    }
    // Keep the focused field visible above the on-screen keyboard: once the
    // keyboard has had time to open, centre the field inside the sheet body
    // instead of leaving it wherever the layout happened to land.
    const onFocusIn = (e) => {
      const el = e.target
      if (!el.matches('input, select, textarea')) return
      setTimeout(() => {
        if (el.isConnected) el.scrollIntoView({ block: 'center', behavior: 'smooth' })
      }, 350)
    }
    node.addEventListener('keydown', onKey)
    node.addEventListener('focusin', onFocusIn)
    document.body.classList.add('no-scroll')
    return () => {
      node.removeEventListener('keydown', onKey)
      node.removeEventListener('focusin', onFocusIn)
      if (!root.querySelector('.dialog')) document.body.classList.remove('no-scroll')
      if (previous?.isConnected) previous.focus()
    }
  }, [])

  return (
    <div className={`backdrop backdrop-${variant}`} onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div
        ref={ref}
        className={`dialog dialog-${variant} dialog-${size}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy || id}
      >
        <header className="dialog-head">
          <div className="dialog-title">
            {eyebrow && <div className="eyebrow">{eyebrow}</div>}
            {title && <h2 id={id}>{title}</h2>}
          </div>
          <IconButton label="Close" onClick={onClose} disabled={disableClose}>
            <X size={16} />
          </IconButton>
        </header>
        <div className="dialog-body">{children}</div>
        {footer && <footer className="dialog-foot">{footer}</footer>}
      </div>
    </div>
  )
}
