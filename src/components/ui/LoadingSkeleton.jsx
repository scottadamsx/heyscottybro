export default function LoadingSkeleton({ rows = 3, height = "1rem", gap = "0.75rem", style }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap, ...style }}>
      {Array.from({ length: rows }, (_, i) => (
        <div
          key={i}
          style={{
            height,
            borderRadius: "0.25rem",
            background: "var(--bg-raised, #1e1e1e)",
            width: i === rows - 1 && rows > 1 ? "60%" : "100%",
            animation: "skeleton-pulse 1.5s ease-in-out infinite",
          }}
        />
      ))}
      <style>{`@keyframes skeleton-pulse { 0%,100%{opacity:0.4} 50%{opacity:0.8} }`}</style>
    </div>
  );
}
