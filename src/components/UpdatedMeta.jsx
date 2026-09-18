/**
 * "Last updated 3 hours ago" under a post. Recent times read relative; older
 * than a week reads as a date. The exact timestamp is in <time dateTime> and
 * its tooltip. Hidden when the post was never edited — i.e. updated_at sits
 * within `sameWithinMs` of created_at (a row's first save stamps both).
 */
const MIN = 60 * 1000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

export function relativeTime(iso, now = Date.now()) {
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return "";
  const diff = Math.max(0, now - t);
  if (diff < MIN) return "just now";
  if (diff < HOUR) { const m = Math.round(diff / MIN); return `${m} minute${m === 1 ? "" : "s"} ago`; }
  if (diff < DAY) { const h = Math.round(diff / HOUR); return `${h} hour${h === 1 ? "" : "s"} ago`; }
  const days = Math.floor(diff / DAY);
  if (days === 1) return "yesterday";
  if (days < 7) return `${days} days ago`;
  const d = new Date(t);
  return `on ${d.toLocaleDateString(undefined, { month: "short", day: "numeric", ...(d.getFullYear() !== new Date(now).getFullYear() ? { year: "numeric" } : {}) })}`;
}

export const absoluteTime = (iso) => new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });

export function wasEdited(updatedAt, createdAt, sameWithinMs = MIN) {
  if (!updatedAt) return false;
  const u = new Date(updatedAt).getTime();
  if (!Number.isFinite(u)) return false;
  if (!createdAt) return true;
  const c = new Date(createdAt).getTime();
  return !Number.isFinite(c) || u - c > sameWithinMs;
}

export default function UpdatedMeta({ at, createdAt, always = false, label = "Last updated", className = "" }) {
  if (!at || (!always && !wasEdited(at, createdAt))) return null;
  const abs = absoluteTime(at);
  return (
    <span className={`updated-meta ${className}`}>
      <i className="fa-regular fa-clock" aria-hidden="true" />
      {label} <time dateTime={new Date(at).toISOString()} title={abs}>{relativeTime(at)}</time>
    </span>
  );
}
