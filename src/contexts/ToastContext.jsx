import { createContext, useCallback, useContext, useRef, useState } from "react";

const ToastContext = createContext(null);

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used inside ToastProvider");
  return ctx;
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const counterRef = useRef(0);

  const dismiss = useCallback((id) => {
    setToasts((t) => t.filter((x) => x.id !== id));
  }, []);

  const addToast = useCallback((message, type = "info", options = {}) => {
    const id = ++counterRef.current;
    const toast = { id, message, type, retry: options.retry ?? null };
    setToasts((t) => [...t, toast]);
    const duration = type === "error" ? 0 : (options.duration ?? 4000);
    if (duration > 0) setTimeout(() => dismiss(id), duration);
    return id;
  }, [dismiss]);

  return (
    <ToastContext.Provider value={{ addToast, dismiss }}>
      {children}
      <ToastContainer toasts={toasts} dismiss={dismiss} />
    </ToastContext.Provider>
  );
}

function ToastContainer({ toasts, dismiss }) {
  if (toasts.length === 0) return null;
  return (
    <div style={{
      position: "fixed", top: "1rem", right: "1rem", zIndex: 9999,
      display: "flex", flexDirection: "column", gap: "0.5rem",
      maxWidth: "360px", width: "calc(100vw - 2rem)",
    }}>
      {toasts.map((t) => (
        <div key={t.id} style={{
          display: "flex", alignItems: "flex-start", gap: "0.75rem",
          padding: "0.75rem 1rem",
          borderRadius: "0.5rem",
          background: t.type === "error" ? "var(--bg-raised, #1e1e1e)"
            : t.type === "success" ? "var(--bg-raised, #1e1e1e)"
            : "var(--bg-raised, #1e1e1e)",
          border: `1px solid ${
            t.type === "error" ? "var(--danger, #ef4444)"
            : t.type === "success" ? "var(--green, #4ade80)"
            : t.type === "warning" ? "#f59e0b"
            : "var(--border, #333)"}`,
          boxShadow: "0 4px 16px rgba(0,0,0,0.4)",
          fontSize: "0.875rem",
          lineHeight: 1.4,
        }}>
          <span style={{ fontSize: "1rem", flexShrink: 0, marginTop: "1px" }}>
            {t.type === "error" ? "✕" : t.type === "success" ? "✓" : t.type === "warning" ? "⚠" : "ℹ"}
          </span>
          <span style={{
            flex: 1,
            color: t.type === "error" ? "var(--danger, #ef4444)"
              : t.type === "success" ? "var(--green, #4ade80)"
              : t.type === "warning" ? "#f59e0b"
              : "var(--text-primary, #fff)",
          }}>
            {t.message}
          </span>
          <div style={{ display: "flex", gap: "0.5rem", flexShrink: 0 }}>
            {t.retry && (
              <button
                onClick={() => { t.retry(); dismiss(t.id); }}
                style={{ fontSize: "0.75rem", color: "var(--accent, #6366f1)", background: "none", border: "none", cursor: "pointer", padding: 0 }}
              >
                Retry
              </button>
            )}
            <button
              onClick={() => dismiss(t.id)}
              style={{ fontSize: "0.875rem", color: "var(--text-muted, #666)", background: "none", border: "none", cursor: "pointer", padding: 0, lineHeight: 1 }}
              aria-label="Dismiss"
            >
              ×
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
