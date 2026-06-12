// Canonical date utilities — import from here, not from plannerUtils, to keep
// timezone handling consistent (all functions use local time, not UTC).

export function toDateStr(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function parseLocalDate(isoStr) {
  const [y, m, d] = isoStr.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function formatDisplayDate(isoDate) {
  if (!isoDate) return "";
  try {
    const d = /^\d{4}-\d{2}-\d{2}$/.test(isoDate) ? parseLocalDate(isoDate) : new Date(isoDate);
    return d.toLocaleDateString(undefined, { weekday: "long", year: "numeric", month: "long", day: "numeric" });
  } catch {
    return isoDate;
  }
}

export function formatShortDate(isoDate) {
  if (!isoDate) return "";
  try {
    const d = parseLocalDate(isoDate);
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  } catch {
    return isoDate;
  }
}

export function isToday(isoDate) {
  return isoDate === toDateStr();
}

export function daysFromNow(isoDate) {
  if (!isoDate) return null;
  const diff = parseLocalDate(isoDate).getTime() - new Date().setHours(0, 0, 0, 0);
  return Math.ceil(diff / 86400000);
}

export function isPast(isoDate) {
  return !!isoDate && isoDate < toDateStr();
}
