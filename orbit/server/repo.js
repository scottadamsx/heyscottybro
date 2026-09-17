// The only module that mutates stored data. HTTP routes and the interview agent's tools both call
// these functions, so validation, duplicate checks and cascades apply to every write the same way.
import * as store from './store.js'
import { validateEvent, validatePerson, validateSettings } from '../src/lib/validate.js'
import { findDuplicateEvent, findDuplicatePerson, normText } from '../src/lib/dedupe.js'
import { today } from '../src/lib/dates.js'

export const ID = /^[\w-]{1,64}$/

/** Result shape at the boundary: { ok: true, ... } or { ok: false, code, message, ... }. */
const fail = (code, message, extra = {}) => ({ ok: false, code, message, ...extra })

export function savePerson(id, doc, { allowDuplicate = false } = {}) {
  if (!ID.test(id)) return fail('bad_id', 'bad id')
  const v = validatePerson(doc)
  if (!v.ok) return fail('invalid', v.errors.join('; '), { errors: v.errors })
  const badRef = v.value.facts.find((f) => f.ref && (f.ref === id || !store.get('people')[f.ref]))
  if (badRef) return fail('invalid', `"${badRef.k}" links to someone who isn't in Orbit`)
  // Only a new name can create a duplicate; editing a record the user already kept never trips it.
  const before = store.get('people')[id]
  const renamed = !before || normText(before.name) !== normText(v.value.name)
  if (!allowDuplicate && renamed) {
    const dup = findDuplicatePerson(store.get('people'), v.value.name, id)
    if (dup?.match === 'exact') {
      return fail('duplicate', `${store.get('people')[dup.id].name} is already in Orbit`, { existingId: dup.id })
    }
  }
  store.putItem('people', id, v.value)
  return { ok: true, id, value: v.value }
}

/** Removes the person and every reference to them. Events left with nobody are removed too. */
export function deletePerson(id) {
  if (!store.get('people')[id]) return fail('not_found', 'not found')
  let updatedEvents = 0
  let removedEvents = 0
  for (const [eid, e] of Object.entries(store.get('events'))) {
    if (!e.people?.includes(id)) continue
    const people = e.people.filter((p) => p !== id)
    if (!people.length) {
      store.removeItem('events', eid)
      removedEvents++
    } else {
      const { [id]: _, ...updates } = e.updates || {}
      store.putItem('events', eid, { ...e, people, updates })
      updatedEvents++
    }
  }
  // Facts elsewhere that linked to them keep their text but lose the link.
  for (const [pid, p] of Object.entries(store.get('people'))) {
    if (pid === id || !p.facts?.some((f) => f.ref === id)) continue
    store.putItem('people', pid, { ...p, facts: p.facts.map(({ ref, ...f }) => (ref === id ? f : { ...f, ref })) })
  }
  store.removeItem('people', id)
  return { ok: true, updatedEvents, removedEvents }
}

/** What deletePerson would do, for the confirm modal. */
export function deletePersonImpact(id) {
  const events = Object.values(store.get('events')).filter((e) => e.people?.includes(id))
  return { events: events.length, removedEvents: events.filter((e) => e.people.length === 1).length }
}

export function saveEvent(id, doc, { allowDuplicate = false } = {}) {
  if (!ID.test(id)) return fail('bad_id', 'bad id')
  const v = validateEvent(doc, today())
  if (!v.ok) return fail('invalid', v.errors.join('; '), { errors: v.errors })
  const people = store.get('people')
  const unknown = v.value.people.filter((p) => !people[p])
  if (unknown.length) return fail('invalid', `unknown people: ${unknown.join(', ')}`)
  const was = store.get('events')[id]
  const changed = !was || findDuplicateEvent({ was }, v.value)?.match !== 'exact'
  if (!allowDuplicate && changed) {
    const dup = findDuplicateEvent(store.get('events'), v.value, id)
    if (dup?.match === 'exact') return fail('duplicate', 'That event is already logged', { existingId: dup.id })
  }
  store.putItem('events', id, v.value)
  return { ok: true, id, value: v.value }
}

export function deleteEvent(id) {
  return store.removeItem('events', id) ? { ok: true } : fail('not_found', 'not found')
}

export function saveSettings(doc) {
  const v = validateSettings(doc)
  if (!v.ok) return fail('invalid', v.errors.join('; '), { errors: v.errors })
  store.putSettings(v.value)
  return { ok: true }
}

/**
 * Fold `dropId` into `keepId`: their events move over, facts and intents are combined (duplicates
 * removed), and blank basics on the kept record are filled from the dropped one. Then `dropId` is deleted.
 */
export function mergePeople(keepId, dropId) {
  const people = store.get('people')
  const keep = people[keepId]
  const drop = people[dropId]
  if (!keep || !drop || keepId === dropId) return fail('not_found', 'pick two different people')
  const merged = {
    ...drop,
    ...keep,
    birthday: keep.birthday || drop.birthday || '',
    how: keep.how || drop.how || '',
    notes: [keep.notes, drop.notes].filter((n) => n?.trim()).join('\n\n'),
    facts: [...(keep.facts || []), ...(drop.facts || [])],
    intents: [...(keep.intents || []), ...(drop.intents || [])],
    createdAt: [keep.createdAt, drop.createdAt].filter(Boolean).sort()[0],
  }
  const v = validatePerson(merged)
  if (!v.ok) return fail('invalid', v.errors.join('; '))
  for (const [eid, e] of Object.entries(store.get('events'))) {
    if (!e.people?.includes(dropId)) continue
    const ids = [...new Set(e.people.map((p) => (p === dropId ? keepId : p)))]
    const updates = { ...(e.updates || {}) }
    if (updates[dropId]) {
      updates[keepId] = [updates[keepId], updates[dropId]].filter(Boolean).join(' / ')
      delete updates[dropId]
    }
    store.putItem('events', eid, { ...e, people: ids, updates })
  }
  store.putItem('people', keepId, { ...v.value, facts: v.value.facts.filter((f) => f.ref !== keepId) })
  for (const [pid, p] of Object.entries(store.get('people'))) {
    if (pid === dropId || pid === keepId || !p.facts?.some((f) => f.ref === dropId)) continue
    store.putItem('people', pid, { ...p, facts: p.facts.map((f) => (f.ref === dropId ? { ...f, ref: keepId } : f)) })
  }
  store.removeItem('people', dropId)
  return { ok: true, id: keepId }
}

/** Fold a duplicate event into another: attendees, updates and notes are combined. */
export function mergeEvents(keepId, dropId) {
  const events = store.get('events')
  const keep = events[keepId]
  const drop = events[dropId]
  if (!keep || !drop || keepId === dropId) return fail('not_found', 'pick two different events')
  const updates = { ...(drop.updates || {}) }
  for (const [pid, text] of Object.entries(keep.updates || {})) {
    updates[pid] = updates[pid] && updates[pid] !== text ? `${text} / ${updates[pid]}` : text
  }
  const merged = {
    ...drop,
    ...keep,
    place: keep.place || drop.place || '',
    people: [...new Set([...(keep.people || []), ...(drop.people || [])])],
    updates,
    notes: [...new Set([keep.notes, drop.notes].filter((n) => n?.trim()))].join('\n\n'),
  }
  const v = validateEvent(merged, today())
  if (!v.ok) return fail('invalid', v.errors.join('; '))
  store.putItem('events', keepId, v.value)
  store.removeItem('events', dropId)
  return { ok: true, id: keepId }
}
