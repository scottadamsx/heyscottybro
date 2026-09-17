import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'

const UIContext = createContext(null)
let seq = 0

/**
 * Modal stack and toasts. Person and event views are routes (/person/:id, /event/:id) so they can
 * be linked; everything else opens here, on top.
 */
export function UIProvider({ children }) {
  const [stack, setStack] = useState([])
  const [toasts, setToasts] = useState([])
  const navigate = useNavigate()
  const timers = useRef({})

  const open = useCallback((type, props = {}) => {
    const key = ++seq
    setStack((s) => [...s, { key, type, props }])
    return key
  }, [])

  const close = useCallback((key) => {
    setStack((s) => (key == null ? s.slice(0, -1) : s.filter((m) => m.key !== key)))
  }, [])

  const dismiss = useCallback((id) => {
    clearTimeout(timers.current[id])
    setToasts((t) => t.filter((x) => x.id !== id))
  }, [])

  /** notify('Saved') or notify('Removed Amy', { action: { label: 'Undo', run } }) */
  const notify = useCallback(
    (text, { action, tone = 'neutral' } = {}) => {
      const id = ++seq
      setToasts((t) => [...t.slice(-2), { id, text, action, tone }])
      timers.current[id] = setTimeout(() => dismiss(id), action ? 8000 : 4000)
    },
    [dismiss],
  )

  const value = useMemo(
    () => ({
      stack,
      open,
      close,
      toasts,
      notify,
      dismiss,
      openPerson: (id, tab) => navigate(`/person/${encodeURIComponent(id)}${tab ? `?tab=${tab}` : ''}`),
      openEvent: (id) => navigate(`/event/${encodeURIComponent(id)}`),
      openPage: (page) => navigate(`/${page}`),
      home: () => navigate('/'),
      /** Close a routed view: go back if we got here inside the app, otherwise home. */
      back: () => (window.history.state?.idx > 0 ? navigate(-1) : navigate('/')),
    }),
    [stack, open, close, toasts, notify, dismiss, navigate],
  )
  return <UIContext.Provider value={value}>{children}</UIContext.Provider>
}

export function useUI() {
  const ctx = useContext(UIContext)
  if (!ctx) throw new Error('useUI must be used inside UIProvider')
  return ctx
}
