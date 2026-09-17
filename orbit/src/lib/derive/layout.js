import { GROUPS, RING_RADII } from '../constants.js'
import { pairKey } from './cooccur.js'

export const NODE_R = 14
const ITERATIONS = 320
const TAU = Math.PI * 2

const wrap = (a) => {
  let x = (a + Math.PI) % TAU
  if (x < 0) x += TAU
  return x - Math.PI
}

/**
 * Angular force layout. Each node's distance from the centre is fixed by its ring. Only the
 * angle moves: co-attendees pull together, same-group people pull a little, and nodes that
 * overlap push apart.
 * nodes: [{ id, ring, group }]  weights: cooccur() map  R: outer radius in px  nodeR: node radius in px.
 * Returns { [id]: { angle, radius } }.
 */
export function layoutNodes(nodes, weights, R, nodeR = NODE_R) {
  const order = GROUPS.map((g) => g.id)
  const sorted = [...nodes].sort(
    (a, b) => order.indexOf(a.group) - order.indexOf(b.group) || (a.id < b.id ? -1 : 1),
  )
  const n = sorted.length
  if (!n) return {}

  // Seed: each group gets a slice of the circle sized by its headcount.
  const byGroup = new Map()
  for (const node of sorted) byGroup.set(node.group, [...(byGroup.get(node.group) || []), node])
  const theta = new Float64Array(n)
  const radius = new Float64Array(n)
  let cursor = -Math.PI / 2
  let i = 0
  for (const members of byGroup.values()) {
    const size = (members.length / n) * TAU
    members.forEach((node, k) => {
      theta[i] = cursor + ((k + 0.5) * size) / members.length
      radius[i] = RING_RADII[node.ring] * R
      i++
    })
    cursor += size
  }

  const w = sorted.map((a) => sorted.map((b) => (a.id === b.id ? 0 : weights.get(pairKey(a.id, b.id)) || 0)))
  const force = new Float64Array(n)
  const min = nodeR + nodeR + 44

  for (let it = 0; it < ITERATIONS; it++) {
    force.fill(0)
    for (let a = 0; a < n; a++) {
      for (let b = a + 1; b < n; b++) {
        const d = wrap(theta[b] - theta[a])
        const dx = radius[a] * Math.cos(theta[a]) - radius[b] * Math.cos(theta[b])
        const dy = radius[a] * Math.sin(theta[a]) - radius[b] * Math.sin(theta[b])
        const dist = Math.hypot(dx, dy)
        if (dist > 1.4 * min) {
          if (w[a][b] > 0) {
            const pull = 0.5 * Math.min(w[a][b], 3) * d
            force[a] += pull
            force[b] -= pull
          }
          if (sorted[a].group === sorted[b].group) {
            force[a] += 0.08 * d
            force[b] -= 0.08 * d
          }
        }
        if (dist < min) {
          const dir = d === 0 ? (a < b ? 1 : -1) : Math.sign(d)
          const push = (3.0 * (min - dist)) / min
          force[a] -= dir * push * (120 / radius[a])
          force[b] += dir * push * (120 / radius[b])
        }
      }
    }
    const step = 0.05 * (1 - it / 360)
    for (let a = 0; a < n; a++) {
      theta[a] = wrap(theta[a] + Math.max(-0.25, Math.min(0.25, force[a] * step)))
    }
  }

  return Object.fromEntries(sorted.map((node, k) => [node.id, { angle: theta[k], radius: radius[k] }]))
}
