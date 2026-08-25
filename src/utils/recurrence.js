/**
 * Recurrence planning for reminders created by agents.
 *
 * Why this exists: `create_item` used to accept whatever the model passed. When
 * Scott said "twice a week at 8am for 6 weeks" the model had to invent start
 * dates itself — it often left `date` empty (so the reminder never appeared on
 * the calendar) or put both occurrences on consecutive days. This module makes
 * the derivation deterministic and testable:
 *
 *   - `time` is normalised to HH:MM (accepts "8am", "8:30 pm", "20:15").
 *   - a recurring reminder with no `date` starts on the next sensible day
 *     (today if the time hasn't passed, else tomorrow).
 *   - `weekdays: ["tue","fri"]` or `times_per_week: 2` expands into one weekly
 *     row per weekday, spaced evenly across the week.
 *   - `weeks: 6` becomes `recur_times: 6` on every weekly row.
 *
 * Everything here is pure (takes "now" as an argument) so it can run under
 * `node src/utils/recurrence.test.js`.
 */
import { toDateStr, parseDate } from "./plannerUtils.js";

export const WEEKDAY_NAMES = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];

/** Evenly spaced weekday sets (0 = Sunday). Chosen by hand so 2/wk is Tue+Fri, not Mon+Tue. */
const SPACED = {
  1: [1],
  2: [2, 5],
  3: [1, 3, 5],
  4: [1, 2, 4, 5],
  5: [1, 2, 3, 4, 5],
  6: [1, 2, 3, 4, 5, 6],
  7: [0, 1, 2, 3, 4, 5, 6],
};

export function spacedWeekdays(n) {
  const k = Math.max(1, Math.min(7, Math.round(Number(n) || 1)));
  return SPACED[k];
}

/** "tue" | "Tuesday" | 2 → 2. Returns null when unrecognised. */
export function weekdayIndex(v) {
  if (v == null) return null;
  if (typeof v === "number" && v >= 0 && v <= 6) return v;
  const s = String(v).trim().toLowerCase();
  if (/^[0-6]$/.test(s)) return Number(s);
  const i = WEEKDAY_NAMES.findIndex((n) => n === s || n.slice(0, 3) === s.slice(0, 3));
  return i === -1 ? null : i;
}

/** Normalise a human time to "HH:MM". Returns null if it can't be read. */
export function normalizeTime(v) {
  if (v == null || v === "") return null;
  const s = String(v).trim().toLowerCase();
  const m = s.match(/^(\d{1,2})(?::(\d{2}))?(?::\d{2})?\s*(am|pm|a\.m\.|p\.m\.)?$/);
  if (!m) return null;
  let h = Number(m[1]);
  const min = Number(m[2] || 0);
  const ap = m[3] ? m[3][0] : null;
  if (ap === "p" && h < 12) h += 12;
  if (ap === "a" && h === 12) h = 0;
  if (h > 23 || min > 59) return null;
  return `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
}

function minutesOf(hhmm) {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

/**
 * First date on/after `fromStr` that falls on `weekday`. If that date is
 * `fromStr` itself and the time has already passed, roll a week forward.
 */
export function nextDateForWeekday(fromStr, weekday, { time = null, nowMinutes = 0 } = {}) {
  const d = parseDate(fromStr);
  const delta = (weekday - d.getDay() + 7) % 7;
  d.setDate(d.getDate() + delta);
  if (delta === 0 && time && minutesOf(time) <= nowMinutes) d.setDate(d.getDate() + 7);
  return toDateStr(d);
}

/**
 * Turn the agent's `data` for a reminder into one or more concrete rows.
 * Returns { rows, notes } — `notes` are plain-English derivations the tool
 * result echoes back so the model can confirm honestly.
 */
export function planReminderRows(data, { todayStr, nowMinutes = 0 } = {}) {
  const notes = [];
  const out = { ...data };
  delete out.weekdays; delete out.times_per_week; delete out.weeks;

  if (data.time != null && data.time !== "") {
    const t = normalizeTime(data.time);
    if (!t) throw new Error(`time "${data.time}" is not a clock time — use HH:MM (24h) or "8am"`);
    if (t !== data.time) notes.push(`time "${data.time}" stored as ${t}`);
    out.time = t;
  }

  let weekdays = Array.isArray(data.weekdays) ? data.weekdays.map(weekdayIndex) : null;
  if (weekdays && weekdays.some((w) => w == null)) {
    throw new Error(`weekdays must be day names (mon…sun); got ${JSON.stringify(data.weekdays)}`);
  }
  if (!weekdays && data.times_per_week) {
    weekdays = spacedWeekdays(data.times_per_week);
    notes.push(`${data.times_per_week}×/week spaced to ${weekdays.map((i) => WEEKDAY_NAMES[i]).join(" + ")}`);
  }
  if (weekdays) weekdays = [...new Set(weekdays)].sort((a, b) => a - b);

  const weeks = data.weeks ? Math.max(1, Math.round(Number(data.weeks))) : null;

  if (weekdays && weekdays.length) {
    const rows = weekdays.map((wd) => {
      const row = { ...out, recurrence: "weekly" };
      row.date = nextDateForWeekday(data.date || todayStr, wd, { time: out.time, nowMinutes });
      if (weeks) row.recur_times = weeks;
      else if (data.recur_times) row.recur_times = Math.ceil(Number(data.recur_times) / weekdays.length);
      return row;
    });
    if (data.recurrence && data.recurrence !== "weekly") notes.push(`recurrence forced to weekly for a weekday schedule`);
    if (!weeks && data.recur_times) notes.push(`recur_times ${data.recur_times} total split across ${weekdays.length} weekly rows`);
    notes.push(`created ${rows.length} weekly reminder${rows.length > 1 ? "s" : ""} starting ${rows.map((r) => r.date).join(", ")}`);
    return { rows, notes };
  }

  if (weeks) { out.recur_times = weeks; if (!out.recurrence || out.recurrence === "none") out.recurrence = "weekly"; }

  const recurring = out.recurrence && out.recurrence !== "none";
  if (recurring && !out.date) {
    const startsToday = !out.time || minutesOf(out.time) > nowMinutes;
    const d = parseDate(todayStr);
    if (!startsToday) d.setDate(d.getDate() + 1);
    out.date = toDateStr(d);
    notes.push(`no date given — recurring reminder starts ${out.date}`);
  }
  return { rows: [out], notes };
}
