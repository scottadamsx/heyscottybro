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

export function formatDate(s, opts = {}) {
  if (!s) return ''
  const d = parseYMD(s)
  if (Number.isNaN(d.getTime())) return ''
  const day = d.getDate()
  const suffix = day % 100 >= 11 && day % 100 <= 13 ? 'th' : ({ 1: 'st', 2: 'nd', 3: 'rd' }[day % 10] || 'th')
  const weekday = opts.weekday === false ? '' : `${d.toLocaleDateString('en-US', { weekday: 'long' })}, `
  let month = 'short'
  try { if (localStorage.getItem('setting:dateFormat') === 'full-month') month = 'long' } catch { /* default when storage is unavailable */ }
  return `${weekday}${d.toLocaleDateString('en-US', { month })} ${day}${suffix}`
}

// Receipts contain generated ISO dates; leave stored receipt/source text unchanged.
export function formatReceiptDates(value) {
  return String(value || '').replace(/\b\d{4}-\d{2}-\d{2}\b/g, (date) => formatDate(date))
}

export function formatDateTime(value) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return `${formatDate(toYMD(date))} · ${date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`
}
