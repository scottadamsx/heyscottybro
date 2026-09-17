// Import people and events exported from elsewhere (e.g. a Claude memory dump). Nothing is saved
// until apply; existing values are never overwritten; anything ambiguous is held for Scotty.
import * as store from './store.js'
import * as repo from './repo.js'
import { GROUPS, KINDS, TOPICS } from '../src/lib/constants.js'
import { findDuplicateEvent, findSimilarIntent, mergeFacts, normText } from '../src/lib/dedupe.js'
import { isBirthday, isYMD } from '../src/lib/validate.js'
import { today } from '../src/lib/dates.js'
import { newId } from '../src/lib/ids.js'

const GROUP_IDS = GROUPS.map((g) => g.id)
const KIND_IDS = KINDS.map((k) => k.id)
const TOPIC_IDS = TOPICS.map((t) => t.id)
const str = (x) => (typeof x === 'string' ? x.trim() : '')

// "family (you listed her with the Adamses)" is the exporter guessing, not Scotty's words.
const GUESSED_HOW = /\(you listed\b|^(friend|family|contact)\s*\(/i
// Notes that are the exporter talking to Scotty belong in questions, not in his notes.
const COMMENTARY = /\b(not confirmed|see questions|you corrected|you've also described|i merged|i kept)\b/i

const baseName = (name) => str(name).replace(/\s*\([^)]*\)\s*$/, '')

/**
 * Work out what an import would do. Returns { plan, questions }.
 * plan.create / plan.update / plan.unchanged / plan.hold / plan.events.{create,update,skip}
 */
export function planImport(data) {
  const people = store.get('people')
  const events = store.get('events')
  const entries = Array.isArray(data?.people) ? data.people : []
  const questions = Array.isArray(data?.questions) ? data.questions.filter((q) => str(q)).map(str) : []
  const stamp = `[from Claude, ${today()}]`

  // 1. Match every entry to an existing person, or mark it new.
  const byName = new Map()
  for (const [id, p] of Object.entries(people)) byName.set(normText(p.name), [...(byName.get(normText(p.name)) || []), id])
  const matched = entries.map((e) => {
    const names = [baseName(e.name), ...(Array.isArray(e.aliases) ? e.aliases : [])].map(normText).filter(Boolean)
    const ids = [...new Set(names.flatMap((n) => byName.get(n) || []))]
    return { entry: e, ids }
  })
  // An existing person claimed by two entries (two different Nicks) can't be decided safely.
  const claims = new Map()
  for (const m of matched) if (m.ids.length === 1) claims.set(m.ids[0], [...(claims.get(m.ids[0]) || []), m])

  const plan = { create: [], update: [], unchanged: [], hold: [], events: { create: [], update: [], skip: [] } }
  const nameToId = new Map(Object.entries(people).map(([id, p]) => [normText(p.name), id]))
  const pending = []

  for (const m of matched) {
    const e = m.entry
    const name = str(e.name)
    if (!name) continue
    if (m.ids.length > 1) {
      plan.hold.push({ name, reason: `matches ${m.ids.map((id) => people[id].name).join(' and ')}` })
      continue
    }
    if (m.ids.length === 1 && claims.get(m.ids[0]).length > 1) {
      const others = claims.get(m.ids[0]).map((x) => str(x.entry.name))
      plan.hold.push({ name, reason: `${others.join(' and ')} would both be merged into ${people[m.ids[0]].name}; say which it is` })
      continue
    }
    const id = m.ids[0] || newId('p')
    nameToId.set(normText(baseName(name)), id)
    for (const a of e.aliases || []) if (!nameToId.has(normText(a))) nameToId.set(normText(a), id)
    pending.push({ id, entry: e, existing: m.ids[0] ? people[m.ids[0]] : null })
  }

  // 2. Build each change now that every name has an id.
  for (const { id, entry: e, existing } of pending) {
    const how = GUESSED_HOW.test(str(e.how)) ? '' : str(e.how)
    const birthday = isBirthday(str(e.birthday)) ? str(e.birthday) : ''
    const facts = (Array.isArray(e.facts) ? e.facts : [])
      .filter((f) => str(f.k))
      .map((f) => {
        const fact = { k: str(f.k), v: str(f.v), topic: TOPIC_IDS.includes(f.topic) ? f.topic : 'other' }
        const ref = str(f.person) && nameToId.get(normText(baseName(f.person)))
        if (ref && ref !== id) fact.ref = ref
        return fact
      })
    let note = str(e.notes)
    if (COMMENTARY.test(note)) {
      questions.push(`${str(e.name)}: ${note}`)
      note = ''
    }
    const todos = (Array.isArray(e.todos) ? e.todos : [])
      .filter((t) => str(t.text))
      .map((t) => ({
        id: newId('i'),
        text: str(t.text),
        kind: t.kind === 'gift' ? 'gift' : 'todo',
        amount: Number.isFinite(t.amount_dollars) ? Math.round(t.amount_dollars * 100) : null,
        due: isYMD(str(t.due)) ? str(t.due) : '',
        done: false,
      }))

    if (!existing) {
      plan.create.push({
        id,
        name: baseName(e.name),
        doc: {
          name: baseName(e.name),
          group: GROUP_IDS.includes(e.group) ? e.group : 'other',
          birthday,
          how,
          notes: note ? `${stamp} ${note}` : '',
          facts: mergeFacts([], facts).facts,
          intents: todos,
          createdAt: new Date().toISOString(),
        },
      })
      continue
    }

    const changes = []
    const doc = { ...existing }
    if (how && !existing.how) (doc.how = how), changes.push(`how you know them: ${how}`)
    if (birthday && !existing.birthday) (doc.birthday = birthday), changes.push(`birthday ${birthday}`)
    const merged = mergeFacts(existing.facts || [], facts)
    if (merged.added || merged.replaced) {
      doc.facts = merged.facts
      changes.push(`${merged.added + merged.replaced} fact${merged.added + merged.replaced === 1 ? '' : 's'}`)
    }
    const known = normText(existing.notes)
    if (note && !known.includes(normText(note))) {
      doc.notes = [existing.notes, `${stamp} ${note}`].filter(Boolean).join('\n')
      changes.push('notes')
    }
    const newTodos = todos.filter((t) => !findSimilarIntent(existing.intents || [], t))
    if (newTodos.length) {
      doc.intents = [...(existing.intents || []), ...newTodos]
      changes.push(`${newTodos.length} follow-up${newTodos.length === 1 ? '' : 's'}`)
    }
    if (changes.length) plan.update.push({ id, name: existing.name, changes, doc })
    else plan.unchanged.push(existing.name)
  }

  // 3. Events: people must resolve; the same occasion is merged, not repeated.
  const evs = Array.isArray(data?.events) ? data.events : []
  for (const ev of evs) {
    const title = str(ev.title) || str(ev.kind)
    if (!isYMD(str(ev.date)) || !KIND_IDS.includes(ev.kind)) {
      plan.events.skip.push({ title, reason: 'no real date or unknown kind' })
      continue
    }
    const ids = (ev.people || []).map((n) => nameToId.get(normText(baseName(n))))
    if (!ids.length || ids.some((x) => !x)) {
      plan.events.skip.push({ title, reason: 'someone in it is not in Orbit or is on hold' })
      continue
    }
    const updates = {}
    for (const [n, text] of Object.entries(ev.updates || {})) {
      const pid = nameToId.get(normText(baseName(n)))
      if (pid && ids.includes(pid) && str(text)) updates[pid] = str(text)
    }
    const doc = {
      date: ev.date,
      title,
      kind: ev.kind,
      place: str(ev.place),
      notes: /^planned$/i.test(str(ev.notes)) ? '' : str(ev.notes),
      people: [...new Set(ids)],
      updates,
      status: ev.date > today() ? 'planned' : 'done',
      createdAt: new Date().toISOString(),
    }
    const dup = findDuplicateEvent(events, doc)
    if (dup?.match === 'exact') {
      const e = events[dup.id]
      const extra = Object.fromEntries(Object.entries(updates).filter(([pid, t]) => !e.updates?.[pid] || !normText(e.updates[pid]).includes(normText(t))))
      if (Object.keys(extra).length) {
        plan.events.update.push({ id: dup.id, title: e.title, changes: ['what people were up to'], doc: { ...e, updates: { ...e.updates, ...Object.fromEntries(Object.entries(extra).map(([pid, t]) => [pid, e.updates?.[pid] ? `${e.updates[pid]} / ${t}` : t])) } } })
      } else plan.events.skip.push({ title, reason: 'already logged' })
      continue
    }
    plan.events.create.push({ id: newId('e'), title, date: ev.date, doc })
  }

  return { plan, questions }
}

/** Save a plan. People first so links and events resolve. Returns counts and any failures. */
export function applyImport(plan) {
  const failed = []
  const run = (label, fn) => {
    const out = fn()
    if (!out.ok) failed.push(`${label}: ${out.message}`)
  }
  // New people go in without links first, then with them, so links between two new people resolve.
  for (const c of plan.create) run(c.name, () => repo.savePerson(c.id, { ...c.doc, facts: c.doc.facts.filter((f) => !f.ref) }))
  for (const c of plan.create) if (c.doc.facts.some((f) => f.ref)) run(c.name, () => repo.savePerson(c.id, c.doc, { allowDuplicate: true }))
  for (const u of plan.update) run(u.name, () => repo.savePerson(u.id, u.doc))
  for (const e of plan.events.create) run(e.title, () => repo.saveEvent(e.id, e.doc))
  for (const e of plan.events.update) run(e.title, () => repo.saveEvent(e.id, e.doc, { allowDuplicate: true }))
  return {
    created: plan.create.length,
    updated: plan.update.length,
    events: plan.events.create.length + plan.events.update.length,
    failed,
  }
}
