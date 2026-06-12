export default function FormField({ label, error, hint, required, children, style }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.375rem", ...style }}>
      {label && (
        <label style={{ fontSize: "0.8rem", fontWeight: 500, color: "var(--text-secondary, #ccc)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
          {label}{required && <span style={{ color: "var(--danger, #ef4444)", marginLeft: "0.25rem" }}>*</span>}
        </label>
      )}
      {children}
      {error && <p style={{ margin: 0, fontSize: "0.75rem", color: "var(--danger, #ef4444)" }}>{error}</p>}
      {hint && !error && <p style={{ margin: 0, fontSize: "0.75rem", color: "var(--text-muted, #666)" }}>{hint}</p>}
    </div>
  );
}
