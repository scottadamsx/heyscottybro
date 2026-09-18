/**
 * Rescheduling — pure helpers behind "drag an overdue item onto a day".
 *
 * Overdue = a one-off task that isn't done and was due before today.
 * Moving an item returns the minimal patch for updateReminder/updateEvent:
 * a task just changes date; an event keeps its length (a multi-day span and
 * its end time shift with it). Repeating items are never moved here — moving
 * the base date would shift the whole series — so the patch is null.
 */

const pad = (n) => String(n).padStart(2, "0");
const toStr = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parse = (s) => { const [y, m, d] = String(s).split("-").map(Number); return new Date(y, m - 1, d); };
export const addDays = (s, n) => { const d = parse(s); d.setDate(d.getDate() + n); return toStr(d); };
const daysBetween = (a, b) => Math.round((parse(b) - parse(a)) / 86400000);
const isRepeating = (item) => (item?.recurrence || "none") !== "none";
const toMin = (t) => { const [h, m] = String(t).split(":").map(Number); return h * 60 + (m || 0); };
const fromMin = (m) => `${pad(Math.floor(m / 60) % 24)}:${pad(m % 60)}`;

/** One-off, unfinished tasks whose due date has passed — oldest first. */
export function overdueReminders(reminders, todayStr) {
  return (reminders || [])
    .filter((r) => !r.completed && r.date && r.date < todayStr && !isRepeating(r))
    .sort((a, b) => a.date.localeCompare(b.date));
}

/** Can this item be moved by drag? (one-off tasks and one-off events) */
export function canReschedule(item) {
  return Boolean(item && item.date && !isRepeating(item));
}

/**
 * The patch that moves `item` (kind "task" | "event") to `toDate`.
 * `time` (HH:MM) optionally sets a new start time; `duration` (minutes) sets a
 * task's duration_min, or an event's end time (otherwise the event keeps its
 * original length). Returns null when the item can't be moved.
 */
export function reschedulePatch(item, kind, toDate, { time, duration } = {}) {
  if (!canReschedule(item) || !/^\d{4}-\d{2}-\d{2}$/.test(toDate)) return null;
  if (kind === "task") {
    const patch = { date: toDate };
    if (time !== undefined) patch.time = time || null;
    if (duration !== undefined) patch.duration_min = duration > 0 ? Math.round(duration) : null;
    return patch;
  }
  const patch = { date: toDate };
  if (item.end_date && item.end_date > item.date) patch.end_date = addDays(toDate, daysBetween(item.date, item.end_date));
  if (time !== undefined) {
    patch.start_time = time || null;
    const len = duration > 0 ? duration : (item.start_time && item.end_time ? toMin(item.end_time) - toMin(item.start_time) : 0);
    if (time && len > 0) patch.end_time = fromMin(toMin(time) + len);
    else if (!time) patch.end_time = null;
  }
  return patch;
}

/**
 * Suggested landing days: the `pick` least-loaded days in the next `span`
 * days starting tomorrow (ties go to the sooner day). `loadByDate` maps
 * "YYYY-MM-DD" → number of things already on that day.
 */
export function suggestDays(todayStr, loadByDate = {}, { span = 14, pick = 3 } = {}) {
  const days = Array.from({ length: span }, (_, i) => addDays(todayStr, i + 1));
  return days
    .map((d, i) => ({ date: d, load: loadByDate[d] || 0, i }))
    .sort((a, b) => a.load - b.load || a.i - b.i)
    .slice(0, pick)
    .sort((a, b) => a.i - b.i)
    .map(({ date, load }) => ({ date, load }));
}

/* ── Day timeline (time-boxing) ─────────────────────────────────────────────
   Minutes since midnight throughout. A task's block is time → time + its
   duration_min (30 when unset); an event's is start_time → end_time (60 when
   there's no end). Untimed items are "all day" and never overlap a slot. */
export const DAY_START = 6 * 60;   // 6:00 AM — top of the timeline
export const DAY_END = 23 * 60;    // 11:00 PM — bottom
export const SNAP = 15;
export const DEFAULT_TASK_MIN = 30;
export const DEFAULT_EVENT_MIN = 60;

export const toMinutes = (t) => (t ? toMin(t) : null);
export const fromMinutes = (m) => fromMin(Math.max(0, Math.round(m)));
export const snap = (m, step = SNAP) => Math.round(m / step) * step;

/** Duration an item already implies (minutes). */
export function itemDuration(item, kind) {
  if (kind === "task") return Number(item.duration_min) > 0 ? Number(item.duration_min) : DEFAULT_TASK_MIN;
  const s = toMinutes(item.start_time), e = toMinutes(item.end_time);
  return s != null && e != null && e > s ? e - s : DEFAULT_EVENT_MIN;
}

/**
 * Everything already on `date`, split into timed blocks and untimed items.
 * `reminders`/`events` should already be expanded for that day (recurrence
 * applied). `excludeId` drops the item being scheduled.
 */
export function dayBlocks(date, reminders = [], events = [], excludeId) {
  const timed = [];
  const allDay = [];
  for (const e of events) {
    if (e.id === excludeId) continue;
    const s = toMinutes(e.start_time);
    // expandEvents gives each occurrence its own `date`; a multi-day span is
    // only "timed" on its first day (span_day 1).
    const onStartDay = e.date === date && (!e.span_day || e.span_day === 1);
    if (s == null || !onStartDay) { allDay.push({ id: `e${e.id}`, kind: "event", title: e.title }); continue; }
    timed.push({ id: `e${e.id}`, kind: "event", title: e.title, start: s, end: s + itemDuration(e, "event") });
  }
  for (const r of reminders) {
    if (r.id === excludeId || r.completed) continue;
    const s = toMinutes(r.time);
    if (s == null) { allDay.push({ id: `r${r.id}`, kind: "task", title: r.name }); continue; }
    timed.push({ id: `r${r.id}`, kind: "task", title: r.name, start: s, end: s + itemDuration(r, "task") });
  }
  timed.sort((a, b) => a.start - b.start || a.end - b.end);
  return { timed, allDay };
}

/** Blocks the slot [start, start + dur) collides with. */
export function overlapsWith(start, dur, timed) {
  return timed.filter((b) => start < b.end && start + dur > b.start);
}

/**
 * Earliest free start ≥ `from` (snapped) that fits `dur` before DAY_END,
 * or null when the day is full.
 */
export function firstFreeSlot(dur, timed, from = DAY_START) {
  let t = Math.max(DAY_START, Math.ceil(from / SNAP) * SNAP);
  const sorted = [...timed].sort((a, b) => a.start - b.start);
  while (t + dur <= DAY_END) {
    const hit = sorted.find((b) => t < b.end && t + dur > b.start);
    if (!hit) return t;
    t = Math.ceil(hit.end / SNAP) * SNAP;
  }
  return null;
}

/**
 * Has this item already finished today? Only items dated `todayStr` with a time can have
 * ended: a task ends at its time + duration (30 min if not estimated), an event at its end
 * time (or start + 60 min). A multi-day event only ends on its last day. Untimed and
 * future items never have. `nowMin` = minutes since local midnight.
 */
export function hasEnded(item, kind, todayStr, nowMin) {
  if (!item) return false;
  if (kind === "event") {
    const lastDay = item.end_date && item.end_date > item.date ? item.end_date : item.date;
    if (lastDay !== todayStr) return false;
    const end = item.end_time ? toMin(item.end_time)
      : item.start_time && lastDay === item.date ? toMin(item.start_time) + DEFAULT_EVENT_MIN : null;
    return end != null && end <= nowMin;
  }
  if (item.date !== todayStr || !item.time) return false;
  return toMin(item.time) + itemDuration(item, "task") <= nowMin;
}

/** Unfinished tasks dated today whose time has already passed (a missed slot, not "up next"). */
export function missedToday(reminders, todayStr, nowMin) {
  return (reminders || [])
    .filter((r) => !r.completed && hasEnded(r, "task", todayStr, nowMin))
    .sort((a, b) => String(a.time).localeCompare(String(b.time)));
}
