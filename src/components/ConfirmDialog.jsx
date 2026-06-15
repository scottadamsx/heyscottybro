import { useEffect, useRef } from "react";

export default function ConfirmDialog({ message, title = "Are you sure?", confirmLabel = "Delete", onConfirm, onCancel }) {
  const cancelRef = useRef(null);

  useEffect(() => {
    cancelRef.current?.focus();
    const onKey = (e) => { if (e.key === "Escape") onCancel(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel]);

  return (
    <div
      style={{ position: "fixed", inset: 0, zIndex: 9000, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem" }}
      onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}
    >
      <div style={{ background: "var(--bg-elevated, #1a1a1a)", border: "1px solid var(--border, #333)", borderRadius: "0.75rem", padding: "1.5rem", maxWidth: "380px", width: "100%" }}>
        <h3 style={{ margin: "0 0 0.5rem", fontSize: "1rem", fontWeight: 600 }}>{title}</h3>
        {message && <p style={{ margin: "0 0 1.25rem", fontSize: "0.875rem", color: "var(--text-muted, #aaa)", lineHeight: 1.5 }}>{message}</p>}
        <div style={{ display: "flex", gap: "0.5rem", justifyContent: "flex-end" }}>
          <button ref={cancelRef} className="btn" onClick={onCancel} style={{ background: "var(--bg-raised)", color: "var(--text-secondary)" }}>
            Cancel
          </button>
          <button className="btn" onClick={onConfirm} style={{ background: "var(--danger, var(--red))", color: "#fff", border: "none" }}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
