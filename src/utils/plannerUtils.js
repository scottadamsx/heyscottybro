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

export function formatDisplayDate(isoDate) {
  if (!isoDate) return "";
  try {
    return new Date(isoDate).toLocaleDateString(undefined, {
      weekday: "long", year: "numeric", month: "long", day: "numeric"
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

    if (recur === "daily") {
      const cur = new Date(Math.max(start.getTime(), reminderDate.getTime()));
      let count = 0;
      while (cur <= effectiveEnd) {
        if (r.recur_times && count >= r.recur_times) break;
        expanded.push({ ...r, date: toDateStr(cur) });
        cur.setDate(cur.getDate() + 1);
        count++;
      }
      return;
    }

    if (recur === "weekly") {
      const cur = new Date(reminderDate);
      let count = 0;
      while (cur <= effectiveEnd) {
        if (r.recur_times && count >= r.recur_times) break;
        if (cur >= start) {
          expanded.push({ ...r, date: toDateStr(cur) });
          count++;
        }
        cur.setDate(cur.getDate() + 7);
      }
      return;
    }

    if (recur === "monthly") {
      let count = 0;
      for (let offset = 0; offset <= 36; offset++) {
        if (r.recur_times && count >= r.recur_times) break;
        const y = reminderDate.getFullYear() + Math.floor((reminderDate.getMonth() + offset) / 12);
        const m = (reminderDate.getMonth() + offset) % 12;
        const lastDay = new Date(y, m + 1, 0).getDate();
        const day = Math.min(reminderDate.getDate(), lastDay);
        const candidate = new Date(y, m, day);
        if (candidate > effectiveEnd) break;
        if (candidate >= start && candidate >= reminderDate) {
          expanded.push({ ...r, date: toDateStr(candidate) });
          count++;
        }
      }
    }
  });

  expanded.sort((a, b) => a.date.localeCompare(b.date));
  return expanded;
}
