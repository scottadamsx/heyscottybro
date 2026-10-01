export const PAGE_VISIT_MIN_ACTIVE_MS = 3000;
export const PAGE_IDLE_MS = 60000;
export const PAGE_USAGE_SCHEMA = 1;

export function routeKeyForPath(pathname = "") {
  const path = String(pathname).replace(/^\/admin\/?/, "").split("/").filter(Boolean);
  const root = path[0] || "today";
  if (root === "people") {
    if (path[1] === "event") return "people_event";
    if (path[1] === "person") return "person_detail";
    return "people";
  }
  if (root === "health" && path[1] === "workout") return "workout_detail";
  if (root === "tasks") return "task_detail";
  if (root === "read") return "brain_reader";
  const allowed = new Set(["today", "planner", "reminders", "work", "finance", "school", "life", "health", "arcade", "mission", "vault", "settings", "analytics"]);
  return allowed.has(root) ? root : "other";
}

export function createPageVisit({ visitId, routeKey, wallNow, monotonicNow }) {
  const iso = new Date(wallNow).toISOString();
  return {
    visit_id: visitId,
    route_key: routeKey,
    started_at: iso,
    ended_at: iso,
    active_ms: 0,
    last_seen_at: iso,
    schema_version: PAGE_USAGE_SCHEMA,
    monotonic_at: monotonicNow,
  };
}

export function advancePageVisit(visit, { wallNow, monotonicNow, active }) {
  const next = { ...visit };
  if (active && Number.isFinite(visit.monotonic_at)) {
    next.active_ms += Math.max(0, monotonicNow - visit.monotonic_at);
  }
  const iso = new Date(wallNow).toISOString();
  next.ended_at = iso;
  next.last_seen_at = iso;
  next.monotonic_at = active ? monotonicNow : null;
  return next;
}

export function persistedPageVisit(visit) {
  if (!visit || visit.active_ms < PAGE_VISIT_MIN_ACTIVE_MS) return null;
  const { monotonic_at: _monotonic, ...row } = visit;
  return { ...row, active_ms: Math.round(row.active_ms) };
}
