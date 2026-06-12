import { useEffect } from "react";

export default function Modal({ isOpen, onClose, title, children, maxWidth = "520px" }) {
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      style={{ position: "fixed", inset: 0, zIndex: 8000, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{ background: "var(--bg-elevated, #1a1a1a)", border: "1px solid var(--border, #333)", borderRadius: "0.75rem", width: "100%", maxWidth, maxHeight: "90vh", display: "flex", flexDirection: "column" }}>
        {title && (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "1.25rem 1.5rem 0" }}>
            <h2 style={{ margin: 0, fontSize: "1rem", fontWeight: 600 }}>{title}</h2>
            <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted, #666)", fontSize: "1.25rem", lineHeight: 1, padding: 0 }} aria-label="Close">×</button>
          </div>
        )}
        <div style={{ padding: "1.25rem 1.5rem 1.5rem", overflowY: "auto" }}>
          {children}
        </div>
      </div>
    </div>
  );
}
