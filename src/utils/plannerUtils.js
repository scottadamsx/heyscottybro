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
        if (cur >= start) expanded.push({ ...r, date: toDateStr(cur) });
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
        if (cur >= start) expanded.push({ ...r, date: toDateStr(cur) });
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
        if (candidate >= start) expanded.push({ ...r, date: toDateStr(candidate) });
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
