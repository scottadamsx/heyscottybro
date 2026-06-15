import { createContext, useCallback, useContext, useRef, useState } from "react";

// Errors (and the odd verbose info toast) can carry a wall of text — a stack
// trace, a Supabase constraint message, a full API error. We show the start so
// the toast stays compact, and hand over the COMPLETE message via copy/expand.
const PREVIEW_CHARS = 140;

function copyToClipboard(text) {
  if (navigator.clipboard?.writeText) return navigator.clipboard.writeText(text);
  // Fallback for insecure contexts / older browsers.
  return new Promise((resolve, reject) => {
    try {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      ta.remove();
      resolve();
    } catch (err) { reject(err); }
  });
}

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
        <ToastItem key={t.id} toast={t} dismiss={dismiss} />
      ))}
    </div>
  );
}

function ToastItem({ toast: t, dismiss }) {
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);

  const full = String(t.message ?? "");
  const isLong = full.length > PREVIEW_CHARS;
  const shown = isLong && !expanded ? `${full.slice(0, PREVIEW_CHARS).trimEnd()}…` : full;

  const accent = t.type === "error" ? "var(--red, #ef4444)"
    : t.type === "success" ? "var(--green, #4ade80)"
    : t.type === "warning" ? "var(--orange, #f59e0b)"
    : "var(--text-primary, #fff)";

  const copyFull = () => {
    copyToClipboard(full)
      .then(() => { setCopied(true); setTimeout(() => setCopied(false), 1600); })
      .catch(() => {});
  };

  const microBtn = {
    fontSize: "0.7rem", fontWeight: 600, background: "none", border: "none",
    cursor: "pointer", padding: 0, lineHeight: 1,
  };

  return (
    <div style={{
      display: "flex", alignItems: "flex-start", gap: "0.75rem",
      padding: "0.75rem 1rem",
      borderRadius: "0.5rem",
      background: "var(--bg-raised, #1e1e1e)",
      border: `1px solid ${
        t.type === "error" ? "var(--red, #ef4444)"
        : t.type === "success" ? "var(--green, #4ade80)"
        : t.type === "warning" ? "var(--orange, #f59e0b)"
        : "var(--border-primary, #333)"}`,
      boxShadow: "var(--shadow-card, 0 4px 16px rgba(0,0,0,0.4))",
      fontSize: "0.875rem",
      lineHeight: 1.4,
    }}>
      <span style={{ fontSize: "1rem", flexShrink: 0, marginTop: "1px", color: accent }}>
        {t.type === "error" ? "✕" : t.type === "success" ? "✓" : t.type === "warning" ? "⚠" : "ℹ"}
      </span>

      <div style={{ flex: 1, minWidth: 0, color: accent }}>
        <span
          onClick={isLong ? copyFull : undefined}
          title={isLong ? "Click to copy the full message" : undefined}
          style={{
            display: "block",
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
            cursor: isLong ? "copy" : "default",
          }}
        >
          {shown}
        </span>

        {isLong && (
          <div style={{ display: "flex", gap: "0.75rem", marginTop: "0.4rem", flexWrap: "wrap" }}>
            <button onClick={copyFull} style={{ ...microBtn, color: "var(--accent, #6366f1)" }}>
              {copied ? "✓ Copied" : "Copy full message"}
            </button>
            <button onClick={() => setExpanded((v) => !v)} style={{ ...microBtn, color: "var(--text-muted, #888)" }}>
              {expanded ? "Show less" : "Show more"}
            </button>
          </div>
        )}
      </div>

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
  );
}
