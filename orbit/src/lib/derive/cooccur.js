import { isInPerson } from '../constants.js'
import { daysBetween } from '../dates.js'

export const pairKey = (a, b) => (a < b ? `${a}|${b}` : `${b}|${a}`)

/**
 * Co-attendance weights. Every done in-person event with 2+ people adds 1 / (1 + ageDays/180)
 * to each pair, so recent shared time counts more than old.
 * `done` is eventsAsOf(...). Returns Map<"a|b", weight>.
 */
export function cooccur(done, asOf) {
  const w = new Map()
  for (const e of done) {
    if (!isInPerson(e.kind)) continue
    const ids = [...new Set(e.people || [])]
    if (ids.length < 2) continue
    const add = 1 / (1 + daysBetween(e.date, asOf) / 180)
    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) {
        const k = pairKey(ids[i], ids[j])
        w.set(k, (w.get(k) || 0) + add)
      }
    }
  }
  return w
}

/** Map<id, Map<neighbourId, weight>> for the given ids only. */
export function adjacency(weights, ids) {
  const keep = new Set(ids)
  const adj = new Map(ids.map((id) => [id, new Map()]))
  for (const [k, v] of weights) {
    const [a, b] = k.split('|')
    if (!keep.has(a) || !keep.has(b)) continue
    adj.get(a).set(b, v)
    adj.get(b).set(a, v)
  }
  return adj
}
