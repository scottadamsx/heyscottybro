import { adjacency, pairKey } from './cooccur.js'
import { mulberry32, shuffle } from './random.js'

const ITERATIONS = 30

const firstName = (name = '') => name.trim().split(/\s+/)[0] || name

export function strengthLabel(strength) {
  if (strength > 1.2) return 'tight'
  if (strength > 0.5) return 'solid'
  return 'loose'
}

/**
 * Label propagation over the co-attendance graph. Each pass visits people in random order and
 * moves each one to the label with the most summed edge weight among their neighbours.
 * Groups of 2+ are clusters.
 */
export function detectClusters(people, weights, { seed = 1 } = {}) {
  const ids = Object.keys(people).sort()
  const adj = adjacency(weights, ids)
  const label = new Map(ids.map((id) => [id, id]))
  const rand = mulberry32(seed)

  for (let it = 0; it < ITERATIONS; it++) {
    let changed = false
    for (const id of shuffle(ids, rand)) {
      const nbrs = adj.get(id)
      if (!nbrs.size) continue
      const score = new Map()
      for (const [n, w] of nbrs) score.set(label.get(n), (score.get(label.get(n)) || 0) + w)
      let best = label.get(id)
      let bestScore = score.get(best) ?? -1
      for (const [l, s] of [...score].sort((a, b) => (a[0] < b[0] ? -1 : 1))) {
        if (s > bestScore + 1e-9) {
          best = l
          bestScore = s
        }
      }
      if (best !== label.get(id)) {
        label.set(id, best)
        changed = true
      }
    }
    if (!changed) break
  }

  const groups = new Map()
  for (const id of ids) groups.set(label.get(id), [...(groups.get(label.get(id)) || []), id])

  return [...groups.values()]
    .filter((members) => members.length >= 2)
    .map((members) => describeCluster(members, people, weights))
    .sort((a, b) => b.members.length - a.members.length || b.strength - a.strength)
}

function describeCluster(members, people, weights) {
  const degree = new Map(members.map((m) => [m, 0]))
  let total = 0
  let edges = 0
  for (let i = 0; i < members.length; i++) {
    for (let j = i + 1; j < members.length; j++) {
      const w = weights.get(pairKey(members[i], members[j]))
      if (!w) continue
      total += w
      edges++
      degree.set(members[i], degree.get(members[i]) + w)
      degree.set(members[j], degree.get(members[j]) + w)
    }
  }
  const ranked = [...members].sort(
    (a, b) => degree.get(b) - degree.get(a) || (people[a].name || '').localeCompare(people[b].name || ''),
  )
  const top = ranked.slice(0, 2).map((id) => firstName(people[id].name))
  const extra = members.length - top.length
  const name = top.join(' & ') + (extra > 0 ? ` +${extra}` : '')

  const counts = {}
  for (const id of members) counts[people[id].group || 'other'] = (counts[people[id].group || 'other'] || 0) + 1
  const group = Object.entries(counts).sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1))[0][0]

  const strength = edges ? total / edges : 0
  return {
    id: [...members].sort().join('+'),
    name,
    members: ranked,
    group,
    strength,
    strengthLabel: strengthLabel(strength),
  }
}
