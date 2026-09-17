// Builds the text the model sees about a person, only from what's stored.
import * as store from '../store.js'
import { GROUP, RINGS, TOPICS } from '../../src/lib/constants.js'
import { analyze, analyzeAll, eventsAsOf } from '../../src/lib/derive/analyze.js'
import { nextBirthday } from '../../src/lib/derive/birthdays.js'
import { addDays, today } from '../../src/lib/dates.js'
import { formatCents } from '../../src/lib/money.js'
import { OWNER } from './config.js'

const RECENT_EVENTS = 12

/** How much there is to go on. The routes refuse to call the model with nothing. */
export function hasSubstance(id) {
  const p = store.get('people')[id]
  if (!p) return false
  if (p.notes?.trim() || p.how?.trim() || p.facts?.length) return true
  return Object.values(store.get('events')).some((e) => e.updates?.[id] || (e.people?.includes(id) && e.notes?.trim()))
}

/**
 * audience "owner": everything, for private briefings and the agent.
 * audience "them": for text that is said to the person, so gift ideas stay secret.
 */
export function personContext(id, { audience = 'owner' } = {}) {
  const people = store.get('people')
  const p = people[id]
  const asOf = today()
  const done = eventsAsOf(store.get('events'), asOf)
  const a = analyze(id, done, asOf)
  const lines = [`Name: ${p.name}`, `Group: ${GROUP[p.group]?.label || 'Other'}`, `Ring: ${RINGS[a.ring]}`]
  if (a.lastEvent) {
    const e = a.lastEvent
    const ago = a.days === 0 ? 'today' : a.days === 1 ? 'yesterday' : `${a.days} days ago`
    lines.push(`Last seen in person: ${e.date}, ${ago}, for ${e.title || e.kind}${e.place ? ` at ${e.place}` : ''}`)
  }
  const b = nextBirthday(p.birthday, asOf)
  if (b) lines.push(`Birthday: ${p.birthday}${b.days <= 60 ? ` (in ${b.days} days)` : ''}`)
  if (p.how?.trim()) lines.push(`How they know each other: ${p.how.trim()}`)
  if (p.notes?.trim()) lines.push(`Notes: ${p.notes.trim()}`)

  for (const t of TOPICS) {
    const facts = (p.facts || []).filter((f) => (f.topic || 'other') === t.id)
    if (facts.length) lines.push(`${t.label}: ${facts.map((f) => (f.v ? `${f.k}: ${f.v}` : f.k)).join('; ')}`)
  }
  const linkedFrom = Object.values(people).flatMap((o) => (o.facts || []).filter((f) => f.ref === id).map((f) => `${o.name} (their ${f.k.toLowerCase()})`))
  if (linkedFrom.length) {
    lines.push(`Connected people: ${linkedFrom.join('; ')}`)
  }

  const open = (p.intents || []).filter((i) => !i.done)
  const todos = open.filter((i) => i.kind !== 'gift')
  const gifts = open.filter((i) => i.kind === 'gift')
  if (todos.length) lines.push(`${OWNER}'s own to-do list for them (things ${OWNER} means to do): ${todos.map((i) => i.text).join('; ')}`)
  if (gifts.length && audience === 'owner') {
    lines.push(`Gift ideas ${OWNER} has for them (a secret from them): ${gifts.map((i) => `${i.text}${i.amount ? ` (about ${formatCents(i.amount)})` : ''}`).join('; ')}`)
  }

  const mine = done.filter((e) => e.people?.includes(id)).slice(-RECENT_EVENTS).reverse()
  if (mine.length) {
    lines.push('Recent history (newest first):')
    for (const e of mine) {
      const others = e.people.filter((x) => x !== id).map((x) => people[x]?.name).filter(Boolean)
      const bits = [`- ${e.date} ${e.kind}${e.title ? `: ${e.title}` : ''}${e.place ? ` at ${e.place}` : ''}`]
      if (others.length) bits.push(`with ${others.join(', ')}`)
      if (e.updates?.[id]) bits.push(`| what they were up to: ${e.updates[id]}`)
      if (e.notes?.trim()) bits.push(`| notes: ${e.notes.trim()}`)
      lines.push(bits.join(' '))
    }
  }
  return lines.join('\n')
}

/** Short "already saved" line the agent gets back with every write, so it never asks for known things. */
export function knownSummary(id) {
  const p = store.get('people')[id]
  if (!p) return ''
  const bits = []
  if (p.birthday) bits.push(`birthday ${p.birthday}`)
  if (p.how) bits.push(`how you know them: ${p.how}`)
  for (const f of p.facts || []) bits.push(f.v ? `${f.k}: ${f.v}` : f.k)
  if (p.notes) bits.push(`notes: ${p.notes.slice(0, 200)}`)
  return bits.length ? `Already saved about ${p.name}: ${bits.join('; ')}.` : `Nothing else is saved about ${p.name} yet.`
}

/** One line per person for the interview agent. Volatile, so it goes after the cached prefix. */
export function rosterText() {
  const people = store.get('people')
  const events = store.get('events')
  const asOf = today()
  const all = analyzeAll(people, events, asOf)
  const updates = {}
  for (const e of Object.values(events)) for (const pid of Object.keys(e.updates || {})) updates[pid] = (updates[pid] || 0) + 1
  const rows = Object.entries(people)
    .sort((x, y) => all[x[0]].ring - all[y[0]].ring || x[1].name.localeCompare(y[1].name))
    .map(([id, p]) => {
      const a = all[id]
      return `- ${p.name} | ${GROUP[p.group]?.label || 'Other'}${p.how ? ` | to you: ${p.how}` : ''} | ${RINGS[a.ring]}${a.days != null ? ` (${a.days}d since contact)` : ''} | birthday: ${p.birthday || 'unknown'} | facts: ${p.facts?.length || 0} | updates: ${updates[id] || 0}`
    })
  const from = addDays(asOf, -45)
  const to = addDays(asOf, 45)
  const recent = Object.values(events)
    .filter((e) => e.kind !== 'Note' && e.date >= from && e.date <= to)
    .sort((a, b) => (a.date < b.date ? 1 : -1))
    .slice(0, 40)
    .map((e) => `- ${e.date} | ${e.title || e.kind} | ${e.kind}${e.status === 'planned' ? ' (planned)' : ''} | with ${e.people.map((pid) => people[pid]?.name).filter(Boolean).join(', ')}`)
  return `Today is ${asOf}.\n\nRoster (${rows.length} people):\n${rows.join('\n') || '(nobody yet)'}\n\nRecent and upcoming events (45 days either side):\n${recent.join('\n') || '(none)'}`
}
