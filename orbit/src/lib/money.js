// Money is stored as integer cents and formatted only for display.

export function formatCents(cents) {
  const n = cents || 0
  return (n / 100).toLocaleString('en-CA', {
    style: 'currency',
    currency: 'CAD',
    minimumFractionDigits: n % 100 ? 2 : 0,
    maximumFractionDigits: 2,
  })
}

/** "25", "$25.50", "25.5" → 2550. Returns null for blank, NaN for junk. */
export function parseDollars(text) {
  const s = String(text ?? '').replace(/[$,\s]/g, '')
  if (!s) return null
  if (!/^\d+(\.\d{0,2})?$/.test(s)) return NaN
  return Math.round(parseFloat(s) * 100)
}
