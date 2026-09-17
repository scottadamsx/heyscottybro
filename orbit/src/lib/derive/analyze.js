import { CADENCE, RING_POINTS, contactWeight, isContact, isInPerson } from '../constants.js'
import { daysBetween } from '../dates.js'

export const isDone = (e) => (e.status || 'done') === 'done'

/** Done events on or before asOf, oldest first. */
export function eventsAsOf(events, asOf) {
  return Object.entries(events)
    .map(([id, e]) => ({ id, ...e }))
    .filter((e) => isDone(e) && e.date && e.date <= asOf)
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))
}

export function ringFor({ score90, score365, last }) {
  if (score90 >= RING_POINTS.inner) return 0
  if (score90 >= RING_POINTS.close) return 1
  if (score365 >= RING_POINTS.regular) return 2
  if (last) return 3
  return 4
}

/**
 * Relationship state for one person as of a date.
 * `done` is the output of eventsAsOf (pass it in when analysing many people).
 * Rings use closeness points (hangout 3, call 2, text or conversation 1); drift and fade use the last contact (DR-096).
 * `lastEvent` / `seenDays` stay in person only, for the "Last seen" line.
 */
export function analyze(personId, done, asOf) {
  let n90 = 0
  let n365 = 0
  let score90 = 0
  let score365 = 0
  let count = 0
  let last = null
  let lastEvent = null
  let touch = null
  let inPerson = 0
  for (const e of done) {
    if (!e.people?.includes(personId)) continue
    if (!touch || e.date > touch) touch = e.date
    if (!isContact(e.kind)) continue
    count++
    const age = daysBetween(e.date, asOf)
    const w = contactWeight(e.kind)
    if (age <= 90) (n90++, (score90 += w))
    if (age <= 365) (n365++, (score365 += w))
    if (!last || e.date >= last) last = e.date
    if (isInPerson(e.kind)) {
      inPerson++
      if (!lastEvent || e.date >= lastEvent.date) lastEvent = e
    }
  }
  const ring = ringFor({ score90, score365, last })
  const cadence = CADENCE[ring]
  const days = last ? daysBetween(last, asOf) : null
  const drift = cadence != null && days != null && days > cadence
  const fade = days == null ? 0.35 : Math.max(0.35, 1 - Math.min(days, 240) / 300)
  const seenDays = lastEvent ? daysBetween(lastEvent.date, asOf) : null
  return { n90, n365, score90, score365, count, inPerson, last, lastEvent, seenDays, touch, ring, cadence, days, drift, fade }
}

export function analyzeAll(people, events, asOf) {
  const done = eventsAsOf(events, asOf)
  return Object.fromEntries(Object.keys(people).map((id) => [id, analyze(id, done, asOf)]))
}

/** Days-since pill tone: ok | warn (70% of cadence) | late (overdue) | none (not logged). */
export function pillTone(a) {
  if (a.days == null || a.cadence == null) return 'none'
  if (a.days > a.cadence) return 'late'
  if (a.days >= a.cadence * 0.7) return 'warn'
  return 'ok'
}
