export function toDateStr(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function parseDate(s) {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function formatMoney(amount) {
  return `$${Math.abs(Number(amount || 0)).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })}`;
}

export function getWeekRange(today = new Date()) {
  const day = today.getDay(); // 0=Sun, 1=Mon, ...6=Sat
  const daysFromMon = day === 0 ? 6 : day - 1;
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate() - daysFromMon);
  const end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 6);
  return { start, end, startStr: toDateStr(start), endStr: toDateStr(end) };
}

export function formatDisplayDate(isoDate) {
  if (!isoDate) return "";
  try {
    // Parse "YYYY-MM-DD" as a LOCAL date. `new Date("YYYY-MM-DD")` parses as
    // UTC midnight, which renders as the previous day in negative-offset
    // timezones — use the local-safe parser to keep the calendar day correct.
    const local = /^\d{4}-\d{2}-\d{2}$/.test(isoDate) ? parseDate(isoDate) : new Date(isoDate);
    return local.toLocaleDateString(undefined, {
      weekday: "long", month: "long", day: "numeric"
    });
  } catch {
    return isoDate;
  }
}

/**
 * Recurring-task completion model (per occurrence):
 *  - `recurrence === "none"`: `completed: true` is the marker; `completed_date`
 *    is informational.
 *  - recurring rows: `completed` stays false while the series is alive and
 *    `completed_date` is the LAST occurrence that was ticked off. Occurrences
 *    on or before it are done; the first one after it is the next pending one.
 *    `completed: true` on a recurring row means the whole series is finished.
 */
export function expandReminders(reminders, startDate, endDate) {
  const start = parseDate(startDate);
  const end = parseDate(endDate);
  const expanded = [];

  reminders.forEach((r) => {
    if (r.completed) return;
    if (!r.date) return;
    const recur = r.recurrence || "none";
    const reminderDate = parseDate(r.date);

    // Resolve the hard stop: earliest of recur_until or end-of-window
    const recurUntil = r.recur_until ? parseDate(r.recur_until) : null;
    const effectiveEnd = recurUntil && recurUntil < end ? recurUntil : end;

    if (recur === "none") {
      if (reminderDate >= start && reminderDate <= end) expanded.push(r);
      return;
    }

    // Per-occurrence completion: anything on/before completed_date is done.
    const doneThrough = r.completed_date ? parseDate(r.completed_date) : null;
    const pending = (d) => d >= start && (!doneThrough || d > doneThrough);

    // recur_times limits the TOTAL number of occurrences from the series
    // start — so every occurrence must be counted, even ones before the
    // viewing window, or a "repeat 3×" series would show 3 fresh occurrences
    // in every future window forever.
    if (recur === "daily") {
      // Fast path: no occurrence cap → no need to walk days before the window.
      const cur = r.recur_times
        ? new Date(reminderDate)
        : new Date(Math.max(start.getTime(), reminderDate.getTime()));
      let count = 0;
      while (cur <= effectiveEnd) {
        if (r.recur_times && count >= r.recur_times) break;
        count++;
        if (pending(cur)) expanded.push({ ...r, date: toDateStr(cur) });
        cur.setDate(cur.getDate() + 1);
      }
      return;
    }

    if (recur === "weekly") {
      const cur = new Date(reminderDate);
      let count = 0;
      while (cur <= effectiveEnd) {
        if (r.recur_times && count >= r.recur_times) break;
        count++;
        if (pending(cur)) expanded.push({ ...r, date: toDateStr(cur) });
        cur.setDate(cur.getDate() + 7);
      }
      return;
    }

    if (recur === "monthly") {
      let count = 0;
      for (let offset = 0; offset < 1200; offset++) {
        if (r.recur_times && count >= r.recur_times) break;
        const y = reminderDate.getFullYear() + Math.floor((reminderDate.getMonth() + offset) / 12);
        const m = (reminderDate.getMonth() + offset) % 12;
        const lastDay = new Date(y, m + 1, 0).getDate();
        const day = Math.min(reminderDate.getDate(), lastDay);
        const candidate = new Date(y, m, day);
        if (candidate > effectiveEnd) break;
        count++;
        if (pending(candidate)) expanded.push({ ...r, date: toDateStr(candidate) });
      }
    }
  });

  // Dedupe by reminder id + occurrence date. A single call shouldn't ever
  // produce the same (id, date) twice, but overlapping recurrence edits or a
  // duplicated input row can sneak one in — and a double-counted occurrence is
  // exactly what makes the "Today" count disagree with the real list.
  const seen = new Set();
  const deduped = expanded.filter((r) => {
    const key = `${r.id}-${r.date}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  deduped.sort((a, b) => a.date.localeCompare(b.date));
  return deduped;
}

/** "YYYY-MM-DD" + n days → "YYYY-MM-DD" (local calendar arithmetic). */
export function addDaysStr(str, n) {
  const d = parseDate(str);
  d.setDate(d.getDate() + n);
  return toDateStr(d);
}

/**
 * The first pending occurrence of a reminder, as "YYYY-MM-DD", or null when
 * there is none (done, dateless, or the series is exhausted).
 *
 *  - one-time: its date (null once completed)
 *  - recurring: the first occurrence after `completed_date` (or the start date
 *    when nothing has been ticked off yet). This may be BEFORE `todayStr` — that
 *    is a missed occurrence, and callers treat `next < todayStr` as overdue.
 */
export function nextOccurrence(reminder, todayStr = toDateStr(new Date())) {
  if (!reminder || reminder.completed || !reminder.date) return null;
  const recur = reminder.recurrence || "none";
  if (recur === "none") return reminder.date;
  // Search from the day after the last completed occurrence (or the series
  // start). A live daily/weekly/monthly series always has an occurrence within
  // one period of that point, so a 45-day window past max(start, today) is
  // enough; an empty result means the series is exhausted.
  const from = reminder.completed_date && reminder.completed_date >= reminder.date
    ? addDaysStr(reminder.completed_date, 1)
    : reminder.date;
  const to = addDaysStr(from > todayStr ? from : todayStr, 45);
  const [first] = expandReminders([reminder], from, to);
  return first ? first.date : null;
}

/**
 * All reminder occurrences that fall on a single local calendar day, deduped by
 * id. Use this for the Dashboard "Today" view so the count always matches the
 * same-day reminders in the full list (no slice() silently dropping items, and
 * the day boundary is the user's local day — America/St_Johns — never UTC).
 */
export function remindersForDay(reminders, dayStr) {
  const items = expandReminders(reminders, dayStr, dayStr);
  const seen = new Set();
  return items.filter((r) => (seen.has(r.id) ? false : (seen.add(r.id), true)));
}

/**
 * Tasks with NO due date ("buy shampoo", "return the fan").
 *
 * expandReminders is date-driven — it drops anything without a `date`, which is
 * correct for a calendar but made undated tasks invisible on Today, the Brief
 * and the Dashboard while "Active Tasks" still counted them. Every surface that
 * shows a day's work now shows these too, under an "Anytime" heading.
 */
export function undatedReminders(reminders) {
  return (reminders || []).filter((r) => !r.completed && !r.date);
}

/**
 * Events, expanded like reminders (recurrence) AND spread across every day of
 * a multi-day span (date .. end_date, inclusive). Each occurrence carries
 * span_day / span_total (1-based) so a day view can say "Day 2 of 5".
 */
export function expandEvents(events, startDate, endDate) {
  const out = [];
  const winStart = parseDate(startDate);
  const winEnd = parseDate(endDate);
  const seen = new Set();
  const push = (e) => { const k = e.id + "|" + e.date; if (!seen.has(k)) { seen.add(k); out.push(e); } };
  for (const e of events) {
    if (!e.date) continue;
    const spanEnd = e.end_date && e.end_date > e.date ? parseDate(e.end_date) : null;
    if (!spanEnd) { expandReminders([e], startDate, endDate).forEach(push); continue; }
    const total = Math.round((spanEnd - parseDate(e.date)) / 86400000) + 1;
    const cur = parseDate(e.date);
    for (let i = 1; i <= total; i++, cur.setDate(cur.getDate() + 1)) {
      if (cur >= winStart && cur <= winEnd) push({ ...e, date: toDateStr(cur), span_day: i, span_total: total, first_day: e.date, last_day: e.end_date });
    }
  }
  return out;
}

/** "19:00:00" / "19:00" → "7:00 PM". Empty in → empty out. */
export function formatTime12(t) {
  if (!t) return "";
  const [h, m] = String(t).split(":").map(Number);
  if (Number.isNaN(h)) return String(t);
  return `${h % 12 || 12}:${String(m || 0).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
}
