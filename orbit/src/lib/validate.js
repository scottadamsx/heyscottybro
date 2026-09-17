// Shape checks for every stored document. Shared by the API server and the interview agent's tools,
// so an AI write is held to exactly the same rules as a UI write.
import { GROUPS, KINDS, TOPICS } from './constants.js'
import { dedupeFacts, dedupeIntents } from './dedupe.js'

const GROUP_IDS = new Set(GROUPS.map((g) => g.id))
const KIND_IDS = new Set(KINDS.map((k) => k.id))
const TOPIC_IDS = new Set(TOPICS.map((t) => t.id))
export const STATUSES = ['done', 'planned', 'skipped']
export const INTENT_KINDS = ['todo', 'gift']

const isStr = (x) => typeof x === 'string'
const isObj = (x) => x && typeof x === 'object' && !Array.isArray(x)
const isCents = (x) => Number.isInteger(x) && x >= 0

/** A real calendar date written as YYYY-MM-DD. */
export function isYMD(s) {
  if (!isStr(s) || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false
  const [y, m, d] = s.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d))
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d
}

/** "", "MM-DD" (Feb 29 allowed) or a full YYYY-MM-DD. */
export function isBirthday(s) {
  if (s === '' || s == null) return true
  if (isStr(s) && /^\d{2}-\d{2}$/.test(s)) return isYMD(`2000-${s}`)
  return isYMD(s)
}

function result(errors, value) {
  return errors.length ? { ok: false, errors } : { ok: true, value }
}

export function validatePerson(doc) {
  const e = []
  if (!isObj(doc)) return result(['person must be an object'])
  if (!isStr(doc.name) || !doc.name.trim()) e.push('name is required')
  if (doc.group != null && !GROUP_IDS.has(doc.group)) e.push(`unknown group "${doc.group}"`)
  if (!isBirthday(doc.birthday)) e.push('birthday must be "", MM-DD or YYYY-MM-DD')
  for (const f of doc.facts || []) {
    if (!isStr(f.k) || !f.k.trim()) e.push('every fact needs a label (k)')
    if (f.topic != null && !TOPIC_IDS.has(f.topic)) e.push(`unknown fact topic "${f.topic}"`)
    if (f.ref != null && !isStr(f.ref)) e.push('a fact link (ref) must be a person id')
  }
  for (const i of doc.intents || []) {
    if (!isStr(i.id) || !isStr(i.text) || !i.text.trim()) e.push('every intent needs an id and text')
    if (!INTENT_KINDS.includes(i.kind)) e.push(`unknown intent kind "${i.kind}"`)
    if (i.amount != null && !isCents(i.amount)) e.push('intent amount must be whole cents')
    if (i.due != null && i.due !== '' && !isYMD(i.due)) e.push('a follow-up date must be YYYY-MM-DD')
  }
  if (e.length) return result(e)
  return result([], {
    ...doc,
    name: doc.name.trim(),
    group: doc.group || 'other',
    birthday: doc.birthday || '',
    facts: dedupeFacts(doc.facts || []),
    intents: dedupeIntents(doc.intents || []),
  })
}

/** `today` is passed in so the server and tests agree on what "the future" is. */
export function validateEvent(doc, today) {
  const e = []
  if (!isObj(doc)) return result(['event must be an object'])
  if (!isYMD(doc.date)) e.push('date must be a real YYYY-MM-DD')
  if (!KIND_IDS.has(doc.kind)) e.push(`unknown kind "${doc.kind}"`)
  const status = doc.status || 'done'
  if (!STATUSES.includes(status)) e.push(`unknown status "${doc.status}"`)
  if (status === 'done' && isYMD(doc.date) && today && doc.date > today) e.push('a future event can only be planned')
  if (!Array.isArray(doc.people) || doc.people.some((p) => !isStr(p))) e.push('people must be a list of ids')
  if (doc.updates != null && !isObj(doc.updates)) e.push('updates must be an object keyed by person id')
  if (e.length) return result(e)
  const people = [...new Set(doc.people)]
  // An update only makes sense for someone who was there.
  const updates = Object.fromEntries(
    Object.entries(doc.updates || {}).filter(([pid, text]) => people.includes(pid) && isStr(text) && text.trim()),
  )
  return result([], { ...doc, status, people, updates })
}

export function validateSettings(doc) {
  const e = []
  const ok = (arr) => Array.isArray(arr) && arr.length === 4 && arr.every(isCents)
  if (!isObj(doc) || !isObj(doc.budget)) e.push('settings.budget is required')
  else if (!ok(doc.budget.xmas) || !ok(doc.budget.bday)) e.push('budgets are four whole-cent amounts, one per ring')
  return result(e, doc)
}
