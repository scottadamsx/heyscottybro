import { normText } from './dedupe.js'
import { isYMD } from './validate.js'

export const JOURNAL_SCHEMA_VERSION = 1
export const JOURNAL_STATUSES = new Set(['draft', 'needs_details', 'saved', 'undone', 'error'])
export const JOURNAL_MAX_TEXT = 12000
export const JOURNAL_MAX_ANSWERS = 24

const plain = (x) => x !== null && typeof x === 'object' && !Array.isArray(x)
const finiteText = (x, max) => typeof x === 'string' && x.trim().length > 0 && x.length <= max

export function validTimeZone(value) {
  if (!finiteText(value, 80)) return false
  try {
    new Intl.DateTimeFormat('en', { timeZone: value })
    return true
  } catch {
    return false
  }
}

export function validateJournalInput(body, previous = null) {
  if (!plain(body)) return { ok: false, message: 'Journal entry must be an object.' }
  if (!finiteText(body.text, JOURNAL_MAX_TEXT)) return { ok: false, message: 'Write 1 to 12,000 characters.' }
  if (!isYMD(body.referenceDate) || !validTimeZone(body.timeZone)) {
    return { ok: false, message: 'A real local date and IANA time zone are required.' }
  }
  if (previous && (body.referenceDate !== previous.referenceDate || body.timeZone !== previous.timeZone)) {
    return { ok: false, message: 'The captured date and time zone cannot change.' }
  }
  if (body.answers !== undefined) {
    if (!plain(body.answers) || Object.keys(body.answers).length > JOURNAL_MAX_ANSWERS) {
      return { ok: false, message: 'Too many answers.' }
    }
    const questions = new Map((previous?.questions || []).map((q) => [q.id, q]))
    for (const [id, answer] of Object.entries(body.answers)) {
      const q = questions.get(id)
      if (!q || !finiteText(answer, 200)) return { ok: false, message: 'Unknown or invalid answer.' }
      if (q.kind === 'date' && !isYMD(answer)) return { ok: false, message: 'Answer with an exact YYYY-MM-DD date.' }
      if (q.kind === 'person' && q.options?.length && !q.options.some((o) => o.value === answer) && answer.startsWith('create:')) {
        return { ok: false, message: 'Unknown person choice.' }
      }
      if (q.kind === 'fact' && !q.options?.some((o) => o.value === answer)) {
        return { ok: false, message: 'Choose whether to add or skip this fact.' }
      }
    }
  }
  return { ok: true }
}

export function matchJournalPerson(people, mention) {
  const key = normText(mention)
  if (!key) return { id: null, candidates: [] }
  const entries = Object.entries(people)
  const exact = entries.filter(([, p]) => [p.name, ...(Array.isArray(p.aliases) ? p.aliases : [])].some((n) => normText(n) === key))
  if (exact.length === 1) return { id: exact[0][0], candidates: [exact[0][0]] }
  if (exact.length > 1) return { id: null, candidates: exact.map(([id]) => id) }
  const first = entries.filter(([, p]) => normText(p.name).split(' ')[0] === key)
  return { id: first.length === 1 ? first[0][0] : null, candidates: first.map(([id]) => id) }
}

export function resolveJournalDate(phrase, referenceDate) {
  const value = normText(phrase)
  if (value === 'today') return referenceDate
  if (value === 'yesterday') {
    const d = new Date(`${referenceDate}T12:00:00Z`)
    d.setUTCDate(d.getUTCDate() - 1)
    return d.toISOString().slice(0, 10)
  }
  return isYMD(phrase) ? phrase : null
}

export function journalQuestionId(kind, value) {
  return `${kind}:${normText(value).replaceAll(' ', '_').slice(0, 100)}`
}

export function validJournalEntry(entry) {
  return plain(entry) && entry.schemaVersion === JOURNAL_SCHEMA_VERSION &&
    Number.isSafeInteger(entry.revision) && entry.revision > 0 &&
    JOURNAL_STATUSES.has(entry.status) && finiteText(entry.text, JOURNAL_MAX_TEXT) &&
    isYMD(entry.referenceDate) && validTimeZone(entry.timeZone) &&
    Array.isArray(entry.questions) && plain(entry.answers)
}
