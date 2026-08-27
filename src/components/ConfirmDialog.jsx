import { useEffect, useId, useRef } from "react";

const FOCUSABLE = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export default function ConfirmDialog({ message, title = "Are you sure?", confirmLabel = "Delete", onConfirm, onCancel }) {
  const cancelRef = useRef(null);
  const panelRef = useRef(null);
  const titleId = useId();
  const descId = useId();

  useEffect(() => {
    // Remember what had focus so we can hand it back when the dialog closes.
    const previous = document.activeElement;
    cancelRef.current?.focus();
    const onKey = (e) => {
      if (e.key === "Escape") { onCancel(); return; }
      if (e.key !== "Tab" || !panelRef.current) return;
      // Focus trap: Tab / Shift+Tab cycle within the dialog.
      const nodes = Array.from(panelRef.current.querySelectorAll(FOCUSABLE));
      if (nodes.length === 0) return;
      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      else if (!panelRef.current.contains(document.activeElement)) { e.preventDefault(); first.focus(); }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      if (previous && typeof previous.focus === "function") previous.focus();
    };
  }, [onCancel]);

  return (
    <div
      className="confirm-overlay"
      onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}
    >
      <div
        ref={panelRef}
        className="confirm-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={message ? descId : undefined}
      >
        <h3 id={titleId} className="confirm-title">{title}</h3>
        {message && <p id={descId} className="confirm-message">{message}</p>}
        <div className="confirm-actions">
          <button ref={cancelRef} type="button" className="btn confirm-cancel" onClick={onCancel}>
            Cancel
          </button>
          <button type="button" className="btn confirm-ok" onClick={onConfirm}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
