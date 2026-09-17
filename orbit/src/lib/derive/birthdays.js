import { daysBetween } from '../dates.js'

const pad = (n) => String(n).padStart(2, '0')
const isLeap = (y) => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0

/** "YYYY-MM-DD" | "MM-DD" → { year, month, day } or null. */
export function parseBirthday(b) {
  if (!b) return null
  let m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(b)
  if (m) return { year: +m[1], month: +m[2], day: +m[3] }
  m = /^(\d{2})-(\d{2})$/.exec(b)
  if (m) return { year: null, month: +m[1], day: +m[2] }
  return null
}

function occurrence(p, year) {
  // Feb 29 birthdays are marked on Feb 28 in other years.
  const day = p.month === 2 && p.day === 29 && !isLeap(year) ? 28 : p.day
  return `${year}-${pad(p.month)}-${pad(day)}`
}

/** Next birthday on or after asOf: { date, days, turning } (turning is null without a birth year). */
export function nextBirthday(birthday, asOf) {
  const p = parseBirthday(birthday)
  if (!p) return null
  let year = +asOf.slice(0, 4)
  let date = occurrence(p, year)
  if (date < asOf) date = occurrence(p, ++year)
  return { date, days: daysBetween(asOf, date), turning: p.year ? year - p.year : null }
}

export function nextChristmas(asOf) {
  let year = +asOf.slice(0, 4)
  let date = `${year}-12-25`
  if (date < asOf) date = `${++year}-12-25`
  return { date, days: daysBetween(asOf, date) }
}

/** Gift budget in cents. Only the inner, close and regular rings get one. */
export function giftBudget(settings, kind, ring) {
  if (ring > 2) return 0
  return settings?.budget?.[kind]?.[ring] ?? 0
}
