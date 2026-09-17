import { RINGS, isInPerson, isRemote } from '../constants.js'
import { daysBetween } from '../dates.js'

/**
 * Relationship stats for one person. `done` is eventsAsOf(...), `a` is analyze(...) for the same asOf.
 */
export function relStats(personId, done, asOf) {
  const mine = done.filter((e) => e.people?.includes(personId))
  const inPerson = mine.filter((e) => isInPerson(e.kind))

  const recent = inPerson.filter((e) => daysBetween(e.date, asOf) <= 365)
  let avgGap = null
  if (recent.length >= 2) {
    let sum = 0
    for (let i = 1; i < recent.length; i++) sum += daysBetween(recent[i - 1].date, recent[i].date)
    avgGap = Math.round(sum / (recent.length - 1))
  }

  let this90 = 0
  let prev90 = 0
  for (const e of inPerson) {
    const age = daysBetween(e.date, asOf)
    if (age <= 90) this90++
    else if (age <= 180) prev90++
  }
  const trend = this90 > prev90 ? 'up' : this90 < prev90 ? 'down' : 'flat'

  const kinds = {}
  for (const e of inPerson) kinds[e.kind] = (kinds[e.kind] || 0) + 1
  const topKind = Object.entries(kinds).sort((x, y) => y[1] - x[1] || (x[0] < y[0] ? -1 : 1))[0] || null

  return {
    asOf,
    inPerson: inPerson.length,
    entries: mine.length,
    avgGap,
    this90,
    prev90,
    trend,
    kinds,
    topKind: topKind ? topKind[0] : null,
    topKindCount: topKind ? topKind[1] : 0,
    oneOnOne: inPerson.filter((e) => e.people.length === 1).length,
    remote: mine.filter((e) => isRemote(e.kind)).length,
    lastInPerson: inPerson.at(-1) || null,
  }
}

/** "Work on" suggestions, in the fixed order from the brief. */
export function workOn(person, a, s) {
  const out = []
  if (a.drift) out.push({ key: 'overdue', text: `Overdue: ${a.days} days since you saw them (${RINGS[a.ring]} is every ~${a.cadence} days)` })
  if (s.this90 < s.prev90) out.push({ key: 'less', text: `Seeing them less than last quarter (${s.this90} vs ${s.prev90})` })
  if (s.inPerson >= 3 && s.oneOnOne === 0) out.push({ key: 'no-solo', text: 'Always in a group. Try some one-on-one time' })
  if (s.inPerson >= 3 && s.topKindCount / s.inPerson >= 0.8) out.push({ key: 'same-kind', text: `Almost always ${s.topKind}. Mix it up` })
  if (s.entries >= 3 && s.remote / s.entries > 0.6) out.push({ key: 'remote', text: 'Mostly calls and texts. Plan something in person' })
  if (!person.birthday) out.push({ key: 'birthday', text: 'No birthday saved' })
  if ((person.facts?.length || 0) < 2) out.push({ key: 'facts', text: 'You know very little about them. Ask more next time' })
  const open = (person.intents || []).filter((i) => !i.done)
  if (open.length) {
    const todos = open.filter((i) => i.kind !== 'gift').length
    const gifts = open.length - todos
    const parts = []
    if (todos) parts.push(`${todos} thing${todos === 1 ? '' : 's'} you meant to do`)
    const late = open.filter((i) => i.due && i.due < (s.asOf || '')).length
    if (late) parts.push(`${late} overdue`)
    if (gifts) parts.push(`${gifts} gift idea${gifts === 1 ? '' : 's'} to follow up`)
    out.push({ key: 'intents', text: parts.join(' and ') })
  }
  return out
}
