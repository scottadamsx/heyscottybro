import { createContext, useCallback, useContext, useRef, useState } from "react";

// Errors (and the odd verbose info toast) can carry a wall of text — a stack
// trace, a Supabase constraint message, a full API error. We show the start so
// the toast stays compact, and hand over the COMPLETE message via copy/expand.
const PREVIEW_CHARS = 140;
// Spoken prefix so screen-reader users hear the toast kind, not just the colour/icon.
const TYPE_PREFIX = { error: "Error: ", success: "Success: ", warning: "Warning: ", info: "Notice: " };

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
    <div className="toast-stack" role="status" aria-live="polite">
      {toasts.map((t) => (
        <ToastItem key={t.id} toast={t} dismiss={dismiss} />
      ))}
    </div>
  );
}

const TOAST_ICON = { error: "fa-xmark", success: "fa-check", warning: "fa-exclamation", info: "fa-info" };

function ToastItem({ toast: t, dismiss }) {
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);

  const full = String(t.message ?? "");
  const isLong = full.length > PREVIEW_CHARS;
  const shown = isLong && !expanded ? `${full.slice(0, PREVIEW_CHARS).trimEnd()}…` : full;
  const kind = TOAST_ICON[t.type] ? t.type : "info";

  const copyFull = () => {
    copyToClipboard(full)
      .then(() => { setCopied(true); setTimeout(() => setCopied(false), 1600); })
      .catch(() => {});
  };

  return (
    <div className={`toast toast-${kind}`}>
      <span className="toast-icon" aria-hidden="true"><i className={`fa-solid ${TOAST_ICON[kind]}`} /></span>
      <span className="visually-hidden">{TYPE_PREFIX[kind]}</span>

      <div className="toast-body">
        {isLong
          ? <button type="button" className="toast-msg is-copyable" onClick={copyFull} title="Copy the full message">{shown}</button>
          : <span className="toast-msg">{shown}</span>}
        {isLong && (
          <div className="toast-links">
            <button type="button" onClick={copyFull}>{copied ? "Copied" : "Copy full message"}</button>
            <button type="button" onClick={() => setExpanded((v) => !v)}>{expanded ? "Show less" : "Show more"}</button>
          </div>
        )}
      </div>

      <div className="toast-actions">
        {t.retry && (
          <button type="button" className="toast-retry" onClick={() => { t.retry(); dismiss(t.id); }}>Retry</button>
        )}
        <button type="button" className="toast-x" onClick={() => dismiss(t.id)} aria-label="Dismiss">
          <i className="fa-solid fa-xmark" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
