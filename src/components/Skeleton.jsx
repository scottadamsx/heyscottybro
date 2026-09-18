/**
 * Loading skeletons — grey shapes in the layout the content will land in, so
 * the page doesn't jump when data arrives. Sizes are classes (system.css §9),
 * never inline styles. Each region announces itself once to screen readers
 * (role="status" + a visually-hidden label); the shapes are aria-hidden.
 * Shimmer stops under prefers-reduced-motion.
 *
 *   if (loading) return <PageSkeleton variant="tasks" label="Loading tasks" />;
 */

/** One grey bar. className picks the shape: sk-title, sk-num, sk-pill, sk-dot, sk-block, w-50 … */
export function Skeleton({ className = "" }) {
  return <span className={`skeleton ${className}`} aria-hidden="true" />;
}

/** The accessible wrapper: announce once, hide the shapes. */
export function SkeletonRegion({ label = "Loading…", inline = false, className = "", children }) {
  return (
    <div className={`sk-region${inline ? " is-inline" : ""} ${className}`} role="status" aria-live="polite" aria-busy="true">
      <span className="visually-hidden">{label}</span>
      <div className="sk-shapes" aria-hidden="true">{children}</div>
    </div>
  );
}

const WIDTHS = ["w-80", "w-65", "w-50", "w-80", "w-35", "w-65"];

/** Rows of a list: title + meta on the left, a pill on the right. */
export function SkeletonRows({ rows = 4, actions = true, dot = false }) {
  return (
    <div className="skeleton-list">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="skeleton-list-row">
          {dot && <Skeleton className="sk-dot" />}
          <div className="sk-stack">
            <Skeleton className={WIDTHS[i % WIDTHS.length]} />
            <Skeleton className="sk-sub w-35" />
          </div>
          {actions && <Skeleton className="sk-pill" />}
        </div>
      ))}
    </div>
  );
}

/** Back-compat: the old list placeholder, now announced. */
export function SkeletonList({ rows = 4, label = "Loading…" }) {
  return <SkeletonRegion label={label} inline><SkeletonRows rows={rows} /></SkeletonRegion>;
}

export function SkeletonCard({ lines = 3, heading = true, children }) {
  return (
    <div className="sk-card">
      {heading && <Skeleton className="sk-heading" />}
      {children || Array.from({ length: lines }, (_, i) => <Skeleton key={i} className={i === lines - 1 ? "w-50" : WIDTHS[i % WIDTHS.length]} />)}
    </div>
  );
}

function Header({ actions = 1 }) {
  return (
    <div className="sk-head">
      <Skeleton className="sk-title" />
      <div className="sk-row">{Array.from({ length: actions }, (_, i) => <Skeleton key={i} className="sk-pill sk-fixed" />)}</div>
    </div>
  );
}

function Kpis({ n = 3 }) {
  return (
    <div className="sk-kpis">
      {Array.from({ length: n }, (_, i) => (
        <div key={i} className="sk-stack">
          <Skeleton className="w-50" />
          <Skeleton className="sk-num" />
          <Skeleton className="sk-sub w-65" />
        </div>
      ))}
    </div>
  );
}

function Calendar() {
  return (
    <div className="sk-card">
      <div className="sk-head"><Skeleton className="sk-heading" /><Skeleton className="sk-pill sk-fixed" /></div>
      <div className="sk-cal">{Array.from({ length: 35 }, (_, i) => <Skeleton key={i} className="sk-cell" />)}</div>
    </div>
  );
}

function Paragraphs({ n = 3 }) {
  return Array.from({ length: n }, (_, p) => (
    <div key={p} className="sk-stack">
      <Skeleton /><Skeleton /><Skeleton className={p % 2 ? "w-50" : "w-80"} />
    </div>
  ));
}

/** Page-shaped skeletons. `header={false}` when the page sits under a wrapper's own header. */
const VARIANTS = {
  page: () => <><SkeletonCard lines={3} /><SkeletonCard lines={4} /></>,
  today: () => (
    <>
      <div className="sk-cols">
        <div className="sk-wide"><Kpis n={3} /></div>
        <div className="sk-narrow"><SkeletonCard lines={2} /></div>
      </div>
      <div className="sk-cols">
        <div className="sk-card sk-wide"><Skeleton className="sk-heading" /><Skeleton className="sk-block" /></div>
        <div className="sk-card sk-narrow"><Skeleton className="sk-heading" /><SkeletonRows rows={4} actions={false} dot /></div>
      </div>
    </>
  ),
  calendar: () => <Calendar />,
  tasks: () => (
    <>
      <div className="sk-card"><Skeleton className="sk-heading" /><SkeletonRows rows={4} /></div>
      <div className="sk-card"><Skeleton className="sk-heading" /><SkeletonRows rows={2} /></div>
    </>
  ),
  money: () => (
    <>
      <div className="sk-stack"><Skeleton className="w-20" /><Skeleton className="sk-num" /></div>
      <Skeleton className="sk-pill w-50" />
      <Kpis n={4} />
      <div className="sk-cols">
        <div className="sk-card sk-wide"><Skeleton className="sk-heading" /><SkeletonRows rows={5} /></div>
        <div className="sk-card sk-narrow"><Skeleton className="sk-heading" /><Skeleton className="sk-block" /></div>
      </div>
    </>
  ),
  journal: () => (
    <div className="sk-cols">
      <div className="sk-card sk-narrow"><SkeletonRows rows={6} actions={false} /></div>
      <div className="sk-card sk-wide"><Skeleton className="sk-heading" /><Skeleton className="sk-sub w-35" /><Paragraphs n={3} /></div>
    </div>
  ),
  habits: () => (
    <>
      <Kpis n={3} />
      <div className="sk-card"><Skeleton className="sk-heading" /><SkeletonRows rows={5} dot /></div>
    </>
  ),
  health: () => (
    <>
      <Skeleton className="sk-pill w-50" />
      <Kpis n={4} />
      <div className="sk-cols">
        <div className="sk-card sk-wide"><Skeleton className="sk-heading" /><Skeleton className="sk-block" /></div>
        <div className="sk-card sk-narrow"><Skeleton className="sk-heading" /><SkeletonRows rows={3} actions={false} /></div>
      </div>
    </>
  ),
  school: () => (
    <>
      <Kpis n={3} />
      <div className="sk-grid">{Array.from({ length: 4 }, (_, i) => <SkeletonCard key={i} lines={3} />)}</div>
    </>
  ),
  cards: () => <div className="sk-grid">{Array.from({ length: 6 }, (_, i) => <SkeletonCard key={i} lines={2} />)}</div>,
  list: () => <div className="sk-card"><SkeletonRows rows={6} /></div>,
  detail: () => (
    <div className="sk-card">
      <Skeleton className="sk-sub w-20" />
      <Skeleton className="sk-title" />
      <div className="sk-row"><Skeleton className="sk-pill sk-fixed" /><Skeleton className="sk-pill sk-fixed" /></div>
      <Paragraphs n={2} />
      <div className="sk-row"><Skeleton className="sk-pill sk-fixed" /><Skeleton className="sk-pill sk-fixed" /><Skeleton className="sk-pill sk-fixed" /></div>
    </div>
  ),
  workout: () => (
    <>
      <Kpis n={3} />
      {Array.from({ length: 3 }, (_, i) => (
        <div key={i} className="sk-card"><Skeleton className="sk-heading" /><SkeletonRows rows={3} /></div>
      ))}
    </>
  ),
  reader: () => (
    <div className="sk-stack">
      <Skeleton className="sk-sub w-20" />
      <Skeleton className="sk-title" />
      <Skeleton className="sk-sub w-35" />
      <Paragraphs n={4} />
    </div>
  ),
  settings: () => (
    <>
      {Array.from({ length: 3 }, (_, c) => (
        <div key={c} className="sk-card">
          {Array.from({ length: 2 }, (_, i) => (
            <div key={i} className="sk-row"><div className="sk-stack"><Skeleton className="w-35" /><Skeleton className="sk-sub w-65" /></div><Skeleton className="sk-pill sk-fixed" /></div>
          ))}
        </div>
      ))}
    </>
  ),
};

export function PageSkeleton({ variant = "page", label = "Loading…", header = true, actions = 1, page = true }) {
  const Body = VARIANTS[variant] || VARIANTS.page;
  const region = (
    <SkeletonRegion label={label}>
      {header && <Header actions={actions} />}
      <Body />
    </SkeletonRegion>
  );
  return page ? <div className="module-page">{region}</div> : region;
}
