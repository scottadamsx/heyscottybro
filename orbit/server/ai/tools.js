// The interview agent's tools. Every write goes through repo.js, so the agent gets the same
// validation and duplicate checks as the UI. Every call is logged through store.appendLog.
import * as store from '../store.js'
import * as repo from '../repo.js'
import { GROUPS, KINDS, TOPICS } from '../../src/lib/constants.js'
import { findDuplicatePerson, findSimilarIntent, mergeFacts, normText } from '../../src/lib/dedupe.js'
import { isBirthday, isYMD } from '../../src/lib/validate.js'
import { addDays, daysBetween, today } from '../../src/lib/dates.js'
import { newId } from '../../src/lib/ids.js'
import { knownSummary, personContext } from './context.js'
import { searchAll } from '../../src/lib/search.js'
import { OWNER } from './config.js'

const GROUP_IDS = GROUPS.map((g) => g.id)
const KIND_IDS = KINDS.map((k) => k.id)
const TOPIC_IDS = TOPICS.map((t) => t.id)

const str = (description) => ({ type: 'string', description })

const RAW_TOOLS = [
  {
    name: 'get_person',
    description:
      "Look up everything saved about one person: basics, facts by topic, intents and recent history. Call this before asking Scotty about someone, so you build on what's already known.",
    input_schema: {
      type: 'object',
      properties: { name: str('Their name as Scotty said it. A first name is fine.') },
      required: ['name'],
      additionalProperties: false,
    },
  },
  {
    name: 'search',
    description:
      "Search everything Orbit knows (names, how Scotty knows people, facts, notes, updates, events). Call this whenever Scotty asks a question about his people (\"who works at Molson?\", \"who did I meet at the hike club?\", \"when did I last see Ben?\") and answer only from what it returns. Also use it before adding someone, to check they aren't already saved under another name.",
    input_schema: {
      type: 'object',
      properties: { query: str('A few words to look for, e.g. "Molson" or "hike club".') },
      required: ['query'],
      additionalProperties: false,
    },
  },
  {
    name: 'add_person',
    description:
      "Add someone who isn't on the roster yet. Call this the first time Scotty mentions a new person, before saving anything else about them.",
    input_schema: {
      type: 'object',
      properties: {
        name: str('Full name if known, otherwise first name.'),
        group: { type: 'string', enum: GROUP_IDS, description: 'partner = Scotty\'s girlfriend/boyfriend/partner, sjhc = hike club, sjlc = lift club, carrick = Carrick (work). Use other if unsure.' },
        birthday: str('YYYY-MM-DD, or MM-DD without a year. Only if Scotty said it.'),
        how: str("How Scotty knows them, in Scotty's words. For family, their relation to Scotty (\"Dad\", \"Sister\", \"Grandma Susan's sister, aunt Nancy\")."),
        notes: str('Anything else Scotty said about them, including how things stand between them.'),
      },
      required: ['name', 'group'],
      additionalProperties: false,
    },
  },
  {
    name: 'update_person',
    description:
      "Save lasting information about someone already on the roster. facts are about the person's own life (their job, school, partner, kids, home, interests, health). Their relation to Scotty or how they met goes in how, never in facts. How things stand between them and Scotty goes in notes. Never save an age as a fact: when Scotty gives an age and a birthday, work out the birth year and save birthday as YYYY-MM-DD. Facts that repeat something already saved are skipped automatically.",
    input_schema: {
      type: 'object',
      properties: {
        name: str('Who to update, as they are on the roster now.'),
        new_name: str('Their corrected or fuller name, e.g. "Mike Power" when Scotty gives Mike\'s last name. Never save a name as a fact.'),
        group: { type: 'string', enum: GROUP_IDS },
        birthday: str('YYYY-MM-DD or MM-DD.'),
        how: str("How Scotty knows them, in Scotty's words; for family, their relation to Scotty. Replaces the old value."),
        notes: str('Extra notes, including how things stand between them and Scotty. Added to the end of the existing notes.'),
        facts: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              k: str('Short label, e.g. "Job", "Sister", "Program", "Climbing".'),
              v: str('The detail, e.g. "nurse at the Health Sciences". Can be empty.'),
              topic: { type: 'string', enum: TOPIC_IDS },
              person: str('If this fact is about someone else on the roster (their sister, partner, friend), that person\'s name, or Scotty\'s words for them like "my grandma" (Orbit resolves it from each person\'s relation to Scotty), so the two are linked.'),
            },
            required: ['k', 'topic'],
            additionalProperties: false,
          },
        },
      },
      required: ['name'],
      additionalProperties: false,
    },
  },
  {
    name: 'add_update',
    description:
      "Save news about what's happening in the person's own life right now (a job search, a move, training for a race, visiting town). Not for lasting facts, not for times Scotty saw them, and not for how things stand between them and Scotty (use update_person notes).",
    input_schema: {
      type: 'object',
      properties: {
        name: str('Who it is about.'),
        text: str("What they're up to, in a short phrase."),
        date: str('YYYY-MM-DD when Scotty heard it. Defaults to today.'),
      },
      required: ['name', 'text'],
      additionalProperties: false,
    },
  },
  {
    name: 'log_event',
    description:
      "Log a time Scotty saw, called or texted people. A date after today is saved as a plan. Everyone listed must already be on the roster (add them first). If the occasion is already in the recent events list, use its date, kind and title: the new people are added to that event instead of creating another.",
    input_schema: {
      type: 'object',
      properties: {
        date: str('YYYY-MM-DD. Ask if Scotty did not say.'),
        title: str('Short description, e.g. "Coffee at Rocket".'),
        kind: { type: 'string', enum: KIND_IDS },
        place: str('Where, if said.'),
        people: { type: 'array', items: { type: 'string' }, description: 'Names of everyone who was there, not Scotty.' },
        updates: { type: 'object', additionalProperties: { type: 'string' }, description: "Name → what that person is up to, if Scotty said." },
        notes: str('Anything else about the event.'),
        repeat_until: str('For a stretch ("every day for 3 weeks", "daily calls this past week"): the last day, YYYY-MM-DD. One event is logged for each day from date to repeat_until. Ask Scotty how often if it is unclear.'),
        different_occasion: { type: 'boolean', description: 'Set true only when Scotty confirmed this is a separate occasion from one already logged that day with the same people.' },
      },
      required: ['date', 'kind', 'people'],
      additionalProperties: false,
    },
  },
  {
    name: 'add_intent',
    description: 'Save something Scotty means to do for someone (kind "todo") or a gift idea for them (kind "gift").',
    input_schema: {
      type: 'object',
      properties: {
        name: str('Who it is for.'),
        text: str('What to do, or the gift idea.'),
        kind: { type: 'string', enum: ['todo', 'gift'] },
        amount: { type: 'number', description: 'Rough cost in dollars, for gifts. Optional.' },
        due: str('Follow-up date YYYY-MM-DD, if Scotty gave one ("next week", "before her birthday" worked out from today).'),
      },
      required: ['name', 'text', 'kind'],
      additionalProperties: false,
    },
  },
]

// Descriptions are written with the default owner name; swap in the configured one.
export const TOOLS = JSON.parse(JSON.stringify(RAW_TOOLS).replaceAll('Scotty', OWNER))

// ---------- name matching: exact, then first name, then substring. More than one hit is ambiguous. ----------

// "my grandma" → whoever's relation to Scotty (how) says grandmother, if exactly one person does.
const RELATIONS = [
  [/^(grandma|grandmother|nan|nana|granny|gran)$/, /\b(grandma|grandmother|nan|nana|granny|gran)\b/i],
  [/^(grandpa|grandfather|grandad|granddad|pop|poppy)$/, /\b(grandpa|grandfather|grandad|granddad|pop|poppy)\b/i],
  [/^(mom|mother|mum|mommy)$/, /^(mom|mother|mum)\b/i],
  [/^(dad|father|daddy)$/, /^(dad|father)\b/i],
  [/^(sister|sis)$/, /^(sister|sis)\b/i],
  [/^(brother|bro)$/, /^(brother|bro)\b/i],
  [/^(girlfriend|gf)$/, /^(my\s+)?girlfriend\b/i],
  [/^(boyfriend|bf)$/, /^(my\s+)?boyfriend\b/i],
  [/^(partner|wife|husband)$/, /^(my\s+)?(partner|wife|husband)\b/i],
]

export function matchPerson(people, name) {
  const n = normText(name)
  if (!n) return { error: 'No name given.' }
  const entries = Object.entries(people)
  const word = n.replace(/^(my|our)\s+/, '')
  const relation = RELATIONS.find(([alias]) => alias.test(word))
  if (relation) {
    const hits = entries.filter(([, p]) => relation[1].test(p.how || ''))
    if (hits.length === 1) return { id: hits[0][0], person: hits[0][1] }
    if (hits.length > 1) return { error: `"${name}" could be ${hits.map(([, p]) => p.name).join(' or ')}. Ask ${OWNER} which one.` }
  }
  const stages = [
    (p) => normText(p.name) === n,
    (p) => normText(p.name).split(' ')[0] === n.split(' ')[0] && (!n.includes(' ') || normText(p.name) === n),
    (p) => normText(p.name).includes(n),
  ]
  for (const test of stages) {
    const hits = entries.filter(([, p]) => test(p))
    if (hits.length === 1) return { id: hits[0][0], person: hits[0][1] }
    if (hits.length > 1) return { error: `"${name}" could be ${hits.map(([, p]) => p.name).join(' or ')}. Ask ${OWNER} which one.` }
  }
  return { error: `Nobody called "${name}" is on the roster. Use add_person first if this is someone new.` }
}

const err = (message) => ({ ok: false, message })

const NAME_FACT = /^(last|first|full|sur|family)\s*name$|^surname$/i

const RELATIVE_WORD = /^(sister|brother|sibling|mom|mother|dad|father|wife|husband|partner|girlfriend|boyfriend|son|daughter|cousin|aunt|uncle|niece|nephew|friend|roommate|coworker)$/i

/**
 * "Grandma's sister, my great aunt" → a "Sister of" fact linked to whoever "grandma" is.
 * Returns the fact to add, or null when the how doesn't name someone Orbit can find.
 */
export function linkFromHow(people, selfId, how = '') {
  for (const part of how.split(/[,;()]/)) {
    const m = /^\s*(?:my\s+)?([\p{L}][\p{L}' -]*?)['’]s\s+([\p{L}]+)/iu.exec(part)
    if (!m || !RELATIVE_WORD.test(m[2])) continue
    const hit = matchPerson(people, m[1])
    if (!hit.id || hit.id === selfId) continue
    const word = m[2][0].toUpperCase() + m[2].slice(1).toLowerCase()
    return { k: `${word} of`, v: hit.person.name, topic: /^(friend|roommate|coworker)$/i.test(m[2]) ? 'other' : 'family', ref: hit.id }
  }
  return null
}

const withHowLink = (people, id, doc) => {
  const link = linkFromHow(people, id, doc.how)
  if (!link || (doc.facts || []).some((f) => f.ref === link.ref)) return doc
  return { ...doc, facts: [...(doc.facts || []), link] }
}

/** "Dad's birthday party" matches "dads bday party" closely enough; different titles don't. */
function sameTitle(a = '', b = '') {
  const ta = normText(a).split(' ').filter((t) => t.length > 2)
  const tb = normText(b).split(' ').filter((t) => t.length > 2)
  if (!ta.length || !tb.length) return normText(a) === normText(b)
  const shared = ta.filter((t) => tb.includes(t)).length
  return shared / Math.min(ta.length, tb.length) >= 0.6
}
const clean = (s) => (typeof s === 'string' ? s.trim() : '')

// ---------- executors ----------

const run = {
  search({ query }) {
    const people = store.get('people')
    const hits = searchAll(people, store.get('events'), query, { limit: 12 })
    if (!hits.people.length && !hits.events.length) return { ok: true, message: `Nothing in Orbit matches "${query}".` }
    const lines = [
      ...hits.people.map((h) => `person: ${h.name}${h.snippet ? ` (${h.matched}: ${h.snippet})` : ''}`),
      ...hits.events.map((h) => `event: ${h.date} ${h.title}${h.snippet ? ` (${h.snippet})` : ''}`),
    ]
    return { ok: true, message: lines.join('\n') }
  },

  get_person({ name }) {
    const m = matchPerson(store.get('people'), name)
    if (m.error) return err(m.error)
    return { ok: true, message: personContext(m.id) }
  },

  add_person({ name, group, birthday, how, notes }) {
    const people = store.get('people')
    const dup = findDuplicatePerson(people, name)
    if (dup?.match === 'exact') return err(`${people[dup.id].name} is already on the roster. Use update_person instead.`)
    if (birthday && !isBirthday(birthday)) return err('birthday must be YYYY-MM-DD or MM-DD')
    const id = newId('p')
    const doc = {
      name: clean(name),
      group: GROUP_IDS.includes(group) ? group : 'other',
      birthday: clean(birthday),
      how: clean(how),
      notes: clean(notes),
      facts: [],
      intents: [],
      createdAt: new Date().toISOString(),
    }
    const out = repo.savePerson(id, withHowLink(people, id, doc))
    if (!out.ok) return err(out.message)
    const note = dup ? ` Note: there is also ${people[dup.id].name} on the roster; make sure this is a different person.` : ''
    const details = [doc.group, doc.how && `how you know them: ${doc.how}`, doc.birthday && `birthday ${doc.birthday}`].filter(Boolean)
    return { ok: true, message: `Added ${doc.name}.${note}`, line: `Added ${doc.name} (${details.join('; ')})` }
  },

  update_person({ name, new_name, group, birthday, how, notes, facts }) {
    const m = matchPerson(store.get('people'), name)
    if (m.error) return err(m.error)
    const p = m.person
    // A name given as a fact ("Last name: Power") is a rename, not a fact.
    let rename = clean(new_name)
    const nameFacts = (facts || []).filter((f) => NAME_FACT.test(clean(f.k)) && clean(f.v))
    for (const f of nameFacts) {
      const v = clean(f.v)
      const first = (rename || p.name).split(/\s+/)[0]
      rename = /^first/i.test(f.k) ? [v, ...(rename || p.name).split(/\s+/).slice(1)].join(' ') : /^(last|sur|family)/i.test(f.k) ? `${first} ${v}` : v
    }
    facts = (facts || []).filter((f) => !nameFacts.includes(f))
    if (birthday && !isBirthday(birthday)) return err('birthday must be YYYY-MM-DD or MM-DD')
    const roster = store.get('people')
    const incoming = (facts || [])
      .map((f) => {
        const fact = { k: clean(f.k), v: clean(f.v), topic: TOPIC_IDS.includes(f.topic) ? f.topic : 'other' }
        const link = clean(f.person) && matchPerson(roster, f.person)
        if (link?.id && link.id !== m.id) Object.assign(fact, { ref: link.id, v: fact.v || link.person.name })
        return fact
      })
      .filter((f) => f.k)
    const merged = mergeFacts(p.facts || [], incoming)
    const extraNotes = clean(notes)
    const doc = {
      ...p,
      name: rename || p.name,
      group: group && GROUP_IDS.includes(group) ? group : p.group,
      birthday: clean(birthday) || p.birthday || '',
      how: clean(how) || p.how || '',
      notes: extraNotes && !(p.notes || '').includes(extraNotes) ? [p.notes, `[${today()}] ${extraNotes}`].filter((x) => x?.trim()).join('\n') : p.notes || '',
      facts: merged.facts,
    }
    const out = repo.savePerson(m.id, withHowLink(roster, m.id, doc))
    if (!out.ok) return err(out.message)
    // Say exactly what changed, so Scotty can check it at a glance.
    const parts = []
    const before = new Set((p.facts || []).map((f) => JSON.stringify(f)))
    for (const f of out.value.facts) {
      if (before.has(JSON.stringify(f))) continue
      const who = f.ref ? ` (linked to ${roster[f.ref].name})` : ''
      parts.push(`${f.k}${f.v ? `: ${f.v}` : ''}${who}`)
    }
    if (doc.name !== p.name) parts.unshift(`name ${p.name} -> ${doc.name}`)
    if (doc.birthday !== (p.birthday || '')) parts.push(`birthday ${doc.birthday}`)
    if (doc.group !== p.group) parts.push(`group ${doc.group}`)
    if (doc.how !== (p.how || '')) parts.push(`how you know them: ${doc.how}`)
    if (doc.notes !== (p.notes || '')) parts.push(`notes: ${extraNotes}`)
    if (!parts.length) return { ok: true, message: `Nothing new to save for ${p.name}; it was all there already.` }
    const skipped = merged.skipped ? ` (${merged.skipped} already known, not saved again)` : ''
    return { ok: true, message: `Saved for ${doc.name}: ${parts.join('; ')}.${skipped}`, line: `${doc.name}: ${parts.join('; ')}` }
  },

  add_update({ name, text, date }) {
    const m = matchPerson(store.get('people'), name)
    if (m.error) return err(m.error)
    const when = clean(date) || today()
    if (!isYMD(when)) return err('date must be YYYY-MM-DD')
    if (when > today()) return err("an update can't be dated in the future")
    const body = clean(text)
    if (!body) return err('text is empty')
    const same = Object.values(store.get('events')).some(
      (e) => e.date === when && normText(e.updates?.[m.id]) === normText(body),
    )
    if (same) return { ok: true, message: 'That update was already saved.' }
    const out = repo.saveEvent(newId('e'), {
      date: when,
      title: 'Update',
      kind: 'Note',
      place: '',
      notes: '',
      people: [m.id],
      updates: { [m.id]: body },
      status: 'done',
      createdAt: new Date().toISOString(),
    })
    if (!out.ok) return err(out.message)
    return { ok: true, message: `Saved update for ${m.person.name}.`, line: `Update for ${m.person.name}: ${body}` }
  },

  log_event(input) {
    const { date, repeat_until } = input
    if (!repeat_until) return logOne(input)
    if (!isYMD(date) || !isYMD(repeat_until)) return err('date and repeat_until must be real YYYY-MM-DD dates')
    const span = daysBetween(date, repeat_until)
    if (span < 1) return err('repeat_until must be after date')
    if (span > 92) return err('a stretch can be at most 93 days; split it up')
    let logged = 0
    let skipped = 0
    for (let d = 0; d <= span; d++) {
      const r = logOne({ ...input, date: addDays(date, d), repeat_until: undefined })
      if (!r.ok) return err(`stopped at ${addDays(date, d)}: ${r.message}`)
      if (r.line) logged++
      else skipped++
    }
    const who = input.people.join(', ')
    const line = `Logged ${logged} ${input.kind}${logged === 1 ? '' : 's'} with ${who}, every day ${date} to ${repeat_until}${skipped ? ` (${skipped} already logged)` : ''}`
    return { ok: true, message: `${line}.`, line: logged ? line : undefined }
  },
}

function logOne({ date, title, kind, place, people: names, updates, notes, different_occasion }) {
  {
    if (!isYMD(date)) return err('date must be a real YYYY-MM-DD')
    if (!KIND_IDS.includes(kind)) return err(`kind must be one of ${KIND_IDS.join(', ')}`)
    const roster = store.get('people')
    const ids = []
    for (const n of names || []) {
      const m = matchPerson(roster, n)
      if (m.error) return err(m.error)
      ids.push(m.id)
    }
    if (!ids.length) return err('list at least one person')
    const ups = {}
    for (const [n, text] of Object.entries(updates || {})) {
      const m = matchPerson(roster, n)
      if (m.error) return err(m.error)
      if (!ids.includes(m.id)) return err(`${m.person.name} has an update but isn't in people`)
      if (clean(text)) ups[m.id] = clean(text)
    }
    const status = date > today() ? 'planned' : 'done'
    const ids_ = [...new Set(ids)]
    // The same occasion already logged that day (same kind, same or overlapping title): add the new people to it.
    const occasion = Object.entries(store.get('events')).find(
      ([, e]) => e.date === date && e.kind === kind && e.kind !== 'Note' && sameTitle(e.title, clean(title) || kind),
    )
    if (occasion && !different_occasion) {
      const [eid, e] = occasion
      const added = ids_.filter((pid) => !e.people.includes(pid))
      const mergedUpdates = { ...(e.updates || {}), ...ups }
      if (!added.length && Object.keys(ups).every((pid) => e.updates?.[pid] === ups[pid])) {
        return { ok: true, message: `${e.title} on ${date} already has them. Nothing new saved.` }
      }
      const out = repo.saveEvent(eid, { ...e, people: [...e.people, ...added], updates: mergedUpdates, notes: [e.notes, clean(notes)].filter(Boolean).join('\n') }, { allowDuplicate: true })
      if (!out.ok) return err(out.message)
      const names = added.map((pid) => roster[pid].name.split(' ')[0]).join(', ')
      const line = added.length ? `Added ${names} to ${e.title} (${date})` : `Updated ${e.title} (${date})`
      return { ok: true, message: `${line}.`, line }
    }
    const sameDay = Object.values(store.get('events')).find(
      (e) => e.date === date && e.kind !== 'Note' && ids_.every((pid) => e.people.includes(pid)),
    )
    if (sameDay && !different_occasion) {
      return { ok: true, message: `Already logged on ${date}: ${sameDay.title} (${sameDay.kind}) with them. Nothing new saved. If this was a separate occasion, ask ${OWNER}, then call again with different_occasion true.` }
    }
    const out = repo.saveEvent(newId('e'), {
      date,
      title: clean(title) || kind,
      kind,
      place: clean(place),
      notes: clean(notes),
      people: [...new Set(ids)],
      updates: ups,
      status,
      createdAt: new Date().toISOString(),
    })
    if (out.code === 'duplicate') return { ok: true, message: 'That event was already logged, so nothing new was saved.' }
    if (!out.ok) return err(out.message)
    const who = [...new Set(ids)].map((id) => roster[id].name.split(' ')[0]).join(', ')
    const verb = status === 'planned' ? 'Planned' : 'Logged'
    return { ok: true, message: `${verb} ${kind} on ${date} with ${who}.`, line: `${verb} ${clean(title) || kind} with ${who} (${date})` }
  }
}

Object.assign(run, {
  add_intent({ name, text, kind, amount, due }) {
    const m = matchPerson(store.get('people'), name)
    if (m.error) return err(m.error)
    if (!['todo', 'gift'].includes(kind)) return err('kind must be todo or gift')
    const body = clean(text)
    if (!body) return err('text is empty')
    const cents = amount == null ? null : Math.round(Number(amount) * 100)
    if (cents != null && !(Number.isInteger(cents) && cents >= 0)) return err('amount must be a positive number of dollars')
    if (clean(due) && !isYMD(clean(due))) return err('due must be YYYY-MM-DD')
    const p = m.person
    const similar = findSimilarIntent(p.intents || [], { text: body, kind })
    if (similar) return { ok: true, message: `Already on their list as "${similar.text}". Nothing new saved.` }
    const before = (p.intents || []).length
    const out = repo.savePerson(m.id, {
      ...p,
      intents: [...(p.intents || []), { id: newId('i'), text: body, kind, amount: cents, due: clean(due), done: false }],
    })
    if (!out.ok) return err(out.message)
    if (out.value.intents.length === before) return { ok: true, message: 'That was already on their list.' }
    const label = kind === 'gift' ? 'gift idea' : 'to-do'
    return { ok: true, message: `Added ${label} for ${p.name}.`, line: `Added ${label} for ${p.name}: ${body}` }
  },
})

/** Run one tool call. Never throws; failures come back as { ok: false, message } for the model to read. */
export function executeTool(name, input) {
  let result
  try {
    result = run[name] ? run[name](input || {}) : err(`unknown tool ${name}`)
    // After a write, remind the model what's on file so its next question isn't about something known.
    if (result.ok && name !== 'get_person') {
      const who = (name === 'log_event' ? input.people : [input.name]) || []
      const ids = who.map((n) => matchPerson(store.get('people'), n).id).filter(Boolean)
      const known = [...new Set(ids)].map(knownSummary).join(' ')
      if (known) result = { ...result, message: `${result.message} ${known}` }
    }
  } catch (e) {
    console.error('[agent] tool crashed', name, e)
    result = err(`the ${name} tool failed unexpectedly`)
  }
  store.appendLog('agent', { at: new Date().toISOString(), tool: name, input, ok: result.ok, message: result.message })
  return result
}
