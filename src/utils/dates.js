// Canonical date utilities — import from here, not from plannerUtils, to keep
// timezone handling consistent (all functions use local time, not UTC).

export function toDateStr(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function parseLocalDate(isoStr) {
  const [y, m, d] = isoStr.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function getDateFormat() {
  try { return localStorage.getItem("setting:dateFormat") === "full-month" ? "full-month" : "weekday-ordinal"; }
  catch { return "weekday-ordinal"; }
}

export function formatDisplayDate(isoDate, dateFormat = getDateFormat()) {
  if (!isoDate) return "";
  try {
    const d = /^\d{4}-\d{2}-\d{2}$/.test(isoDate) ? parseLocalDate(isoDate) : new Date(isoDate);
    if (Number.isNaN(d.getTime())) return "";
    const day = d.getDate();
    const suffix = day % 100 >= 11 && day % 100 <= 13 ? "th" : ({ 1: "st", 2: "nd", 3: "rd" }[day % 10] || "th");
    return `${d.toLocaleDateString("en-US", { weekday: "long" })}, ${d.toLocaleDateString("en-US", { month: dateFormat === "full-month" ? "long" : "short" })} ${day}${suffix}`;
  } catch {
    return isoDate;
  }
}

export function formatShortDate(isoDate) {
  return formatDisplayDate(isoDate);
}

export function formatDisplayDateTime(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return `${formatDisplayDate(date)} · ${date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}`;
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
