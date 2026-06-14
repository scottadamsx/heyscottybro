export function Skeleton({ width = "100%", height = "1rem", radius = "6px", style = {} }) {
  return <div className="skeleton" style={{ width, height, borderRadius: radius, ...style }} />;
}

export function SkeletonList({ rows = 4 }) {
  return (
    <div className="skeleton-list">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="skeleton-list-row">
          <Skeleton width={`${55 + (i * 13) % 35}%`} height="0.875rem" />
          <Skeleton width="4rem" height="0.875rem" />
        </div>
      ))}
    </div>
  );
}

export function SkeletonCard({ lines = 3 }) {
  return (
    <div className="skeleton-card">
      {Array.from({ length: lines }, (_, i) => (
        <Skeleton key={i} width={i === lines - 1 ? "55%" : "100%"} height={i === 0 ? "1.1rem" : "0.8rem"} />
      ))}
    </div>
  );
}
