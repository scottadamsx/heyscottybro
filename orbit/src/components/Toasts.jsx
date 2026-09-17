import { useUI } from '../state/UIContext.jsx'
import Button from './ui/Button.jsx'

export default function Toasts() {
  const { toasts, dismiss } = useUI()
  return (
    <div className="toasts" role="status" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className="toast">
          <span>{t.text}</span>
          {t.action && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                t.action.run()
                dismiss(t.id)
              }}
            >
              {t.action.label}
            </Button>
          )}
        </div>
      ))}
    </div>
  )
}
