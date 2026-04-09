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

    if (recur === "none") {
      if (reminderDate >= start && reminderDate <= end) expanded.push(r);
      return;
    }
    if (recur === "daily") {
      const cur = new Date(Math.max(start.getTime(), reminderDate.getTime()));
      while (cur <= end) {
        expanded.push({ ...r, date: toDateStr(cur) });
        cur.setDate(cur.getDate() + 1);
      }
      return;
    }
    if (recur === "weekly") {
      const cur = new Date(reminderDate);
      while (cur <= end) {
        if (cur >= start) expanded.push({ ...r, date: toDateStr(cur) });
        cur.setDate(cur.getDate() + 7);
      }
      return;
    }
    if (recur === "monthly") {
      for (let offset = 0; offset <= 12; offset++) {
        const y = reminderDate.getFullYear() + Math.floor((reminderDate.getMonth() + offset) / 12);
        const m = (reminderDate.getMonth() + offset) % 12;
        const lastDay = new Date(y, m + 1, 0).getDate();
        const day = Math.min(reminderDate.getDate(), lastDay);
        const candidate = new Date(y, m, day);
        if (candidate > end) break;
        if (candidate >= start && candidate >= reminderDate) {
          expanded.push({ ...r, date: toDateStr(candidate) });
        }
      }
    }
  });

  expanded.sort((a, b) => a.date.localeCompare(b.date));
  return expanded;
}
