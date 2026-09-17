import { formatDate } from '../dates.js'
import { nextBirthday } from './birthdays.js'

const CAP = 8
// A family fact only makes a question when its label is a person ("Mom", "Sister"), not "Age" or "Relation".
const RELATIVE = /\b(mom|mother|mum|dad|father|parents?|sister|brother|siblings?|wife|husband|spouse|partner|girlfriend|boyfriend|fianc[eé]e?|son|daughter|kids?|child(ren)?|baby|grand(ma|mother|pa|father|parents?)|nana|nan|pop|aunt|uncle|cousin|niece|nephew|step\w+)\b/i
const detail = (f) => (f.v || f.k || '').trim()
const PAST = /\b(graduated|finished|completed|went through|dropped out|used to)\b/i
const COMMON_START = /^(studying|still|now|doing|taking|working|in|at|business|first|second|third|fourth|fifth|a|an|the)\b/i
const clauses = (v = '') => v.split(/[,;]/).map((c) => c.trim()).filter(Boolean)
const lcFirst = (s) => (COMMON_START.test(s) ? s[0].toLowerCase() + s.slice(1) : s)

/** "Works for M5" → M5, "line cook at Harbour Grill" → Harbour Grill, "Verafin" → Verafin. */
function workQuestion(f) {
  const v = (f.v || '').trim()
  const at = /\b(?:at|for)\s+([^,;]+)/i.exec(v)
  if (at) return `How's work at ${at[1].trim()}?`
  if (v && !/[,;]/.test(v) && v.split(/\s+/).length <= 3 && /^[A-Z0-9]/.test(v) && !/^(engineer|nurse|teacher|student|manager|cook|developer)\b/i.test(v)) return `How's work at ${v}?`
  return "How's work going?"
}

/** Only asks about school that's still going on. */
function schoolQuestion(f) {
  const parts = clauses(f.v || f.k)
  const now = parts.find((c) => /\b(now|currently)\b/i.test(c))
  if (!now && parts.some((c) => PAST.test(c))) return null
  const current = now || parts.find((c) => !/^still in school$/i.test(c))
  if (!current) return null
  const doing = /^(?:now\s+|currently\s+)?doing\s+(?:an?\s+)?(.+)$/i.exec(current)
  if (doing) return `How's the ${doing[1]} going?`
  if (/^[A-Z]/.test(current) && !COMMON_START.test(current)) return `How's school at ${current} going?`
  return `How's ${lcFirst(current)} going?`
}

/** "Bouldering" → Still into Bouldering?, "Interest: loves to read" → Still love to read?, "Sport: Rugby, plays…" → How's rugby going? */
function interestQuestion(f) {
  const k = f.k.trim()
  const first = clauses(f.v)[0] || ''
  if (/^sports?$/i.test(k) && first) return `How's ${first.toLowerCase()} going?`
  if (/^(interests?|hobb(y|ies)|passions?)$/i.test(k) && first) {
    const verb = /^(loves|likes|enjoys)\b/i.exec(first)
    return verb ? `Still ${first.replace(verb[0], verb[0].slice(0, -1)).toLowerCase()}?` : `Still into ${first.toLowerCase()}?`
  }
  if (/\binvolved\b/i.test(first)) return `How are things with ${k.toLowerCase()}?`
  return `Still into ${k}?`
}

// "how" is the person's relation to the owner, so only a how that *starts* with the word means the owner's partner.
const PARTNER = /^(my\s+)?(girlfriend|boyfriend|partner|wife|husband|fianc[eé]e?)\b/i
const firstOf = (name = '') => name.trim().split(/\s+/)[0]

/**
 * A relative, by name where Orbit knows it. Skips people you already see yourself:
 * your own family asked about your own family, or anyone about your partner.
 */
function relativeQuestion(f, person, people) {
  const linked = f.ref && people?.[f.ref]
  if (linked) {
    if (PARTNER.test(linked.how || '')) return null
    if (linked.group === 'family' && person.group === 'family') return null
    return `How's ${firstOf(linked.name)} doing?`
  }
  const named = /^([A-Z][a-z'’-]+)(\s[A-Z][a-z'’-]+)?$/.exec(((f.v || '').split(/[,;(]/)[0] || '').trim())
  return named ? `How's ${named[1]} doing?` : `How's their ${f.k.trim().toLowerCase()} doing?`
}

/**
 * Things to ask someone next time, each with a short reason. Built only from what's stored.
 * `people` (optional) lets linked relatives be named.
 */
export function questionsFor(personId, person, done, asOf, people) {
  const out = []

  const updates = done
    .filter((e) => e.updates?.[personId])
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))
    .slice(0, 4)
  for (const e of updates) {
    const text = e.updates[personId].trim().replace(/[.?!]+$/, '')
    out.push({ q: `How's it going with: ${text}?`, why: `They told you on ${formatDate(e.date)}` })
  }

  for (const f of person.facts || []) {
    const d = detail(f)
    if (!d) continue
    const why = `${f.k}${f.v ? `: ${f.v}` : ''}`
    let q = null
    if (f.topic === 'family' && RELATIVE.test(f.k)) q = relativeQuestion(f, person, people)
    else if (f.topic === 'work') q = workQuestion(f)
    else if (f.topic === 'school') q = schoolQuestion(f)
    else if (f.topic === 'interests') q = interestQuestion(f)
    if (q) out.push({ q, why })
  }

  for (const i of person.intents || []) {
    if (i.kind === 'todo' && !i.done) out.push({ q: `You meant to: ${i.text}`, why: 'On your Meant to list' })
  }

  const b = nextBirthday(person.birthday, asOf)
  if (b && b.days <= 45) {
    const when = b.days === 0 ? 'today' : `in ${b.days} day${b.days === 1 ? '' : 's'}`
    out.push({ q: `Their birthday is ${when}. Any plans?`, why: `Birthday ${formatDate(b.date, { month: 'short', day: 'numeric' })}` })
  }

  return out.slice(0, CAP)
}
