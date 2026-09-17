// Duplicate detection. Pure functions shared by the API server, the UI and the interview agent.

/** "  José  O'Brien " → "jose obrien" */
export function normText(s) {
  return String(s ?? '')
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, '')
    .replace(/\s+/g, ' ')
    .trim()
}

const firstWord = (s) => normText(s).split(' ')[0] || ''

/**
 * Another person with the same name.
 * exact   → same normalised full name (the server blocks this unless overridden)
 * similar → same first name and one side has no surname ("Sam" vs "Sam Hynes"); the UI only warns
 */
export function findDuplicatePerson(people, name, exceptId = null) {
  const n = normText(name)
  if (!n) return null
  let similar = null
  for (const [id, p] of Object.entries(people)) {
    if (id === exceptId) continue
    const other = normText(p.name)
    if (other === n) return { id, match: 'exact' }
    const oneIsBare = !n.includes(' ') || !other.includes(' ')
    if (!similar && oneIsBare && firstWord(other) === firstWord(n)) similar = { id, match: 'similar' }
  }
  return similar
}

const peopleKey = (ids) => [...new Set(ids || [])].sort().join('|')

/**
 * Another event that is the same occasion.
 * exact   → same date, kind and set of people (blocked unless overridden)
 * similar → same date and at least one shared person (warn only)
 */
export function findDuplicateEvent(events, ev, exceptId = null) {
  const key = peopleKey(ev.people)
  let similar = null
  for (const [id, e] of Object.entries(events)) {
    if (id === exceptId || e.date !== ev.date) continue
    if (e.kind === ev.kind && peopleKey(e.people) === key) return { id, match: 'exact' }
    if (!similar && (e.people || []).some((p) => ev.people?.includes(p))) similar = { id, match: 'similar' }
  }
  return similar
}

/** Drop repeated facts (same topic + label + detail after normalising). First one wins. */
export function dedupeFacts(facts = []) {
  const seen = new Set()
  return facts.filter((f) => {
    const key = `${f.topic || 'other'}|${normText(f.k)}|${normText(f.v)}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

/** Drop repeated intents: same id, or same kind + text while still open. First one wins. */
export function dedupeIntents(intents = []) {
  const ids = new Set()
  const open = new Set()
  return intents.filter((i) => {
    if (ids.has(i.id)) return false
    ids.add(i.id)
    if (i.done) return true
    const key = `${i.kind}|${normText(i.text)}`
    if (open.has(key)) return false
    open.add(key)
    return true
  })
}

// Words that carry no meaning for "is this the same fact?"
const STOP = new Set(
  'a an the to of and or in on at for with is are was were be been has have had hasnt havent hadnt isnt dont didnt his her hers their them they he she him my our your its it that this as by from up so just now soon while still really give make get go do me i we us scotty'.split(' '),
)
// "works" and "work" are the same word for this purpose.
const stem = (t) => (t.length > 3 && t.endsWith('s') && !t.endsWith('ss') ? t.slice(0, -1) : t)
export const contentTokens = (s) =>
  normText(s)
    .split(' ')
    .filter((t) => t && !STOP.has(t))
    .map(stem)
const within = (a, b) => a.length > 0 && a.every((t) => b.includes(t))

/**
 * How a new fact relates to an existing one on the same topic:
 * 'same'   → says nothing new (skip it)        e.g. "Spouse: married to Susan" vs existing "Wife: Susan"
 * 'richer' → says the same thing with more detail (replace)  e.g. "Dog: Test Pup" vs existing "Dog"
 * null     → a different fact
 */
export function compareFact(existing, incoming) {
  if ((existing.topic || 'other') !== (incoming.topic || 'other')) return null
  if (existing.ref && incoming.ref) return existing.ref === incoming.ref && normText(existing.k) === normText(incoming.k) ? 'same' : null
  // The same detail under another label ("Education" vs "School") is the same fact.
  if (normText(existing.v) && contentTokens(existing.v).join(' ') === contentTokens(incoming.v).join(' ')) return 'same'
  if (!existing.ref && incoming.ref && within(contentTokens(existing.v), contentTokens(incoming.v))) return 'richer'
  const ek = contentTokens(`${existing.k} ${existing.v || ''}`)
  const ik = contentTokens(`${incoming.k} ${incoming.v || ''}`)
  if (within(ik, ek)) return 'same'
  if (within(ek, ik)) return 'richer'
  const ev = contentTokens(existing.v)
  const iv = contentTokens(incoming.v)
  if (ev.length && iv.length && (within(iv, ev) || within(ev, iv))) return 'same'
  return null
}

/** Add facts, skipping ones already said and upgrading ones said with less detail. */
export function mergeFacts(existing = [], incoming = []) {
  const out = [...existing]
  let added = 0
  let replaced = 0
  let skipped = 0
  for (const f of incoming) {
    const hit = out.map((e, i) => [i, compareFact(e, f)]).find(([, r]) => r)
    if (!hit) {
      out.push(f)
      added++
    } else if (hit[1] === 'richer') {
      out[hit[0]] = f
      replaced++
    } else skipped++
  }
  return { facts: out, added, replaced, skipped }
}

/** An open intent of the same kind that already covers this one. */
export function findSimilarIntent(intents = [], incoming) {
  const it = contentTokens(incoming.text)
  return intents.find((i) => {
    if (i.done || i.kind !== incoming.kind) return false
    const et = contentTokens(i.text)
    if (within(it, et) || within(et, it)) return true
    const shared = it.filter((t) => et.includes(t)).length
    return shared / new Set([...it, ...et]).size >= 0.5
  })
}

/** Whole-dataset report. Never mutates; merging is a user decision. */
export function auditData(people, events) {
  const byName = new Map()
  for (const [id, p] of Object.entries(people)) {
    const n = normText(p.name)
    byName.set(n, [...(byName.get(n) || []), id])
  }
  const byOccasion = new Map()
  const dangling = []
  for (const [id, e] of Object.entries(events)) {
    const k = `${e.date}|${e.kind}|${peopleKey(e.people)}`
    byOccasion.set(k, [...(byOccasion.get(k) || []), id])
    for (const pid of e.people || []) if (!people[pid]) dangling.push({ event: id, person: pid })
  }
  const facts = []
  const intents = []
  for (const [id, p] of Object.entries(people)) {
    const extraFacts = (p.facts?.length || 0) - mergeFacts([], p.facts || []).facts.length
    const openIntents = (p.intents || []).filter((i) => !i.done)
    const extraIntents = openIntents.filter((i, n) => findSimilarIntent(openIntents.slice(0, n), i)).length
    if (extraFacts) facts.push({ person: id, count: extraFacts })
    if (extraIntents) intents.push({ person: id, count: extraIntents })
  }
  return {
    people: [...byName.values()].filter((ids) => ids.length > 1),
    events: [...byOccasion.values()].filter((ids) => ids.length > 1),
    facts,
    intents,
    dangling,
  }
}

export function auditIsClean(a) {
  return !a.people.length && !a.events.length && !a.facts.length && !a.intents.length && !a.dangling.length
}
