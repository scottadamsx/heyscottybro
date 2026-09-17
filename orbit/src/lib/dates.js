// Calendar dates are always "YYYY-MM-DD" strings in local time.

const pad = (n) => String(n).padStart(2, '0')

export function toYMD(d) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export function today() {
  return toYMD(new Date())
}

export function parseYMD(s) {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}

const dayNumber = (s) => {
  const [y, m, d] = s.split('-').map(Number)
  return Date.UTC(y, m - 1, d) / 86_400_000
}

/** Whole days from a to b (positive when b is later). */
export function daysBetween(a, b) {
  return Math.round(dayNumber(b) - dayNumber(a))
}

export function addDays(s, n) {
  const d = parseYMD(s)
  d.setDate(d.getDate() + n)
  return toYMD(d)
}

export function formatDate(s, opts = { month: 'short', day: 'numeric', year: 'numeric' }) {
  if (!s) return ''
  return parseYMD(s).toLocaleDateString(undefined, opts)
}
