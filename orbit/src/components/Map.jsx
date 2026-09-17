import { useEffect, useMemo, useRef, useState } from 'react'
import { useOrbit } from '../state/OrbitContext.jsx'
import { useDerived } from '../state/useDerived.js'
import { useUI } from '../state/UIContext.jsx'
import { GROUPS, RINGS, RING_RADII, groupOf } from '../lib/constants.js'
import { layoutNodes, NODE_R } from '../lib/derive/layout.js'
import { hashString } from '../lib/derive/random.js'
import { convexHull } from '../lib/geometry.js'
import { firstName } from './ui/PersonChip.jsx'
import { initials } from './ui/Avatar.jsx'

const LERP = 0.18
const FLOAT_PX = 4
// Ring labels go at the first of these angles (top first) that isn't covered by a person.
const LABEL_ANGLES = [-90, -60, -120, -30, -150, 90, 60, 120, 0, 180].map((d) => (d * Math.PI) / 180)
const nodeRadius = (size) => (size < 480 ? 11 : NODE_R)

/** Reads the tokens where the map actually is, so it also works inside a host app's shadow root. */
function readColors(el) {
  const css = getComputedStyle(el || document.documentElement)
  const v = (name) => css.getPropertyValue(name).trim()
  const groups = {}
  for (const { id } of GROUPS) groups[id] = v(`--color-group-${id}`)
  return {
    groups,
    ink: v('--color-ink'),
    soft: v('--color-ink-soft'),
    line: v('--color-line'),
    surface: v('--color-surface'),
    brand: v('--color-brand-600'),
    danger: v('--color-danger'),
    font: v('--font-body'),
    display: v('--font-display'),
  }
}

const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches

/** Canvas relationship map. Rings are fixed by how often you see someone; angles come from the layout. */
export default function OrbitMap() {
  const { people } = useOrbit()
  const { byPerson, weights, clusters, everyone } = useDerived()
  const { openPerson } = useUI()
  const wrapRef = useRef(null)
  const canvasRef = useRef(null)
  const [size, setSize] = useState(0)
  const [hover, setHover] = useState(null)
  const [colors, setColors] = useState(null)
  const anim = useRef({ pos: {}, frame: 0 })

  // Track width; the canvas is square and scales with its column.
  useEffect(() => {
    const ro = new ResizeObserver(([entry]) => setSize(Math.round(entry.contentRect.width)))
    ro.observe(wrapRef.current)
    return () => ro.disconnect()
  }, [])

  // Re-read theme colours when the theme flips.
  useEffect(() => {
    const refresh = () => setColors(readColors(wrapRef.current))
    refresh()
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const mo = new MutationObserver(refresh)
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
    mq.addEventListener('change', refresh)
    document.fonts?.ready.then(refresh)
    return () => {
      mo.disconnect()
      mq.removeEventListener('change', refresh)
    }
  }, [])

  const R = Math.max(0, size / 2 - 28)
  const layoutKey = Math.round(R / 10)
  const targets = useMemo(() => {
    if (!R) return {}
    const nodes = everyone.map((id) => ({ id, ring: byPerson[id].ring, group: groupOf(people[id].group).id }))
    return layoutNodes(nodes, weights, R, nodeRadius(size))
    // R only matters in 10px steps; recomputing on every pixel of a resize is wasted work.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [everyone, byPerson, weights, people, layoutKey])

  // Keep the latest inputs for the animation loop without restarting it.
  const live = useRef({})
  live.current = { targets, people, byPerson, weights, clusters, colors, size, R, hover }

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !size) return
    const dpr = window.devicePixelRatio || 1
    canvas.width = size * dpr
    canvas.height = size * dpr
    const ctx = canvas.getContext('2d')
    let raf = 0
    const still = reducedMotion()

    const draw = (t) => {
      const { targets, people, byPerson, weights, clusters, colors, R, hover } = live.current
      if (!colors) return
      const c = size / 2
      const pos = anim.current.pos
      let moving = false

      // Ease each node toward its target angle/radius; float gently unless motion is reduced.
      const points = {}
      for (const [id, tgt] of Object.entries(targets)) {
        const cur = pos[id] || (pos[id] = { angle: tgt.angle, radius: still ? tgt.radius : 0 })
        const da = Math.atan2(Math.sin(tgt.angle - cur.angle), Math.cos(tgt.angle - cur.angle))
        const dr = tgt.radius - cur.radius
        if (still) {
          cur.angle = tgt.angle
          cur.radius = tgt.radius
        } else {
          cur.angle += da * LERP
          cur.radius += dr * LERP
          if (Math.abs(da) > 0.001 || Math.abs(dr) > 0.3) moving = true
        }
        const h = hashString(id)
        const bob = still ? 0 : Math.sin(t / 1400 + (h % 628) / 100) * FLOAT_PX
        const bobX = still ? 0 : Math.cos(t / 1700 + (h % 314) / 50) * FLOAT_PX * 0.6
        points[id] = { x: c + Math.cos(cur.angle) * cur.radius + bobX, y: c + Math.sin(cur.angle) * cur.radius + bob }
      }
      for (const id of Object.keys(pos)) if (!targets[id]) delete pos[id]
      anim.current.points = points

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, size, size)
      const small = size < 480
      const NR = nodeRadius(size)
      const pts = Object.values(points)

      // 1. Rings and labels.
      RING_RADII.forEach((f, ring) => {
        const r = f * R
        ctx.beginPath()
        ctx.arc(c, c, r, 0, Math.PI * 2)
        ctx.strokeStyle = colors.line
        ctx.lineWidth = 1
        ctx.setLineDash(ring === 4 ? [4, 6] : [])
        ctx.stroke()
        ctx.setLineDash([])
        const label = RINGS[ring].toUpperCase()
        ctx.font = `600 ${small ? 9 : 10}px ${colors.font}`
        const half = ctx.measureText(label).width / 2 + 4
        const spot = LABEL_ANGLES.map((a) => ({ x: c + Math.cos(a) * r, y: c + Math.sin(a) * r })).find(
          (s) => !pts.some((p) => Math.abs(p.x - s.x) < half + NR && Math.abs(p.y - s.y) < NR + 16),
        )
        if (!spot) return
        ctx.fillStyle = colors.surface
        ctx.fillRect(spot.x - half, spot.y - 7, half * 2, 13)
        ctx.fillStyle = colors.soft
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText(label, spot.x, spot.y)
        ctx.textBaseline = 'alphabetic'
      })

      // 2. Cluster hulls.
      ctx.save()
      ctx.globalAlpha = 0.1
      ctx.lineJoin = 'round'
      ctx.lineCap = 'round'
      ctx.lineWidth = 70
      for (const cl of clusters) {
        const pts = cl.members.map((id) => points[id]).filter(Boolean)
        if (pts.length < 2) continue
        const hull = convexHull(pts)
        ctx.beginPath()
        hull.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)))
        ctx.closePath()
        ctx.strokeStyle = colors.groups[cl.group] || colors.brand
        ctx.fillStyle = ctx.strokeStyle
        ctx.stroke()
        if (hull.length > 2) ctx.fill()
      }
      ctx.restore()

      // 3. Co-attendance edges.
      for (const [k, w] of weights) {
        const [a, b] = k.split('|')
        const pa = points[a]
        const pb = points[b]
        if (!pa || !pb) continue
        ctx.beginPath()
        ctx.moveTo(pa.x, pa.y)
        ctx.lineTo(pb.x, pb.y)
        ctx.globalAlpha = Math.min(0.55, 0.12 + w * 0.18)
        ctx.lineWidth = Math.min(4, 0.6 + w * 0.9)
        ctx.strokeStyle = colors.brand
        ctx.stroke()
      }
      ctx.globalAlpha = 1

      // 4. Spokes.
      ctx.lineWidth = 1
      for (const [id, p] of Object.entries(points)) {
        ctx.globalAlpha = 0.12 * byPerson[id].fade
        ctx.beginPath()
        ctx.moveTo(c, c)
        ctx.lineTo(p.x, p.y)
        ctx.strokeStyle = colors.soft
        ctx.stroke()
      }
      ctx.globalAlpha = 1

      // 5. You.
      ctx.beginPath()
      ctx.arc(c, c, 20, 0, Math.PI * 2)
      ctx.fillStyle = colors.brand
      ctx.fill()
      ctx.fillStyle = colors.surface
      ctx.font = `700 11px ${colors.display}`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText('YOU', c, c + 0.5)

      // 6. People.
      for (const [id, p] of Object.entries(points)) {
        const a = byPerson[id]
        const person = people[id]
        const isHover = hover === id
        ctx.globalAlpha = isHover ? 1 : a.fade
        ctx.beginPath()
        ctx.arc(p.x, p.y, NR, 0, Math.PI * 2)
        ctx.fillStyle = colors.surface
        ctx.fill()
        ctx.lineWidth = isHover ? 3 : 2
        ctx.strokeStyle = colors.groups[groupOf(person.group).id]
        ctx.stroke()
        ctx.fillStyle = colors.groups[groupOf(person.group).id]
        ctx.font = `700 ${Math.round(NR * 0.72)}px ${colors.font}`
        ctx.textBaseline = 'middle'
        ctx.fillText(initials(person.name), p.x, p.y + 1)
        // On a phone the outer ring gets crowded; people never logged show initials only there.
        if (!(small && a.ring === 4) || isHover) {
          ctx.fillStyle = colors.ink
          ctx.font = `600 ${small ? 10 : 11}px ${colors.font}`
          ctx.textBaseline = 'top'
          ctx.fillText(firstName(person.name), p.x, p.y + NR + 3)
        }
        if (a.drift) {
          ctx.beginPath()
          ctx.arc(p.x + NR * 0.75, p.y - NR * 0.75, 4, 0, Math.PI * 2)
          ctx.fillStyle = colors.danger
          ctx.fill()
          ctx.lineWidth = 1.5
          ctx.strokeStyle = colors.surface
          ctx.stroke()
        }
      }
      ctx.globalAlpha = 1
      ctx.textBaseline = 'alphabetic'

      if (!still || moving) raf = requestAnimationFrame(draw)
    }
    raf = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(raf)
    // The loop reads everything else from `live`; redraw when inputs change in reduced-motion mode.
  }, [size, targets, colors, hover, clusters, weights])

  const hit = (e) => {
    const rect = canvasRef.current.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    let best = null
    let bestD = nodeRadius(size) + 8
    for (const [id, p] of Object.entries(anim.current.points || {})) {
      const d = Math.hypot(p.x - x, p.y - y)
      if (d < bestD) {
        best = { id, x: p.x, y: p.y }
        bestD = d
      }
    }
    return best
  }

  const [tip, setTip] = useState(null)
  const onMove = (e) => {
    const h = hit(e)
    setHover(h?.id ?? null)
    setTip(h)
  }

  const summary = `Relationship map with ${everyone.length} people. ${RINGS.map(
    (r, i) => `${r}: ${everyone.filter((id) => byPerson[id].ring === i).length}`,
  ).join(', ')}. The Everyone list has the same people.`

  const tipPerson = tip && people[tip.id]
  const tipA = tip && byPerson[tip.id]

  return (
    <div ref={wrapRef} className="map-wrap">
      <canvas
        ref={canvasRef}
        className={`map-canvas${hover ? ' is-pointer' : ''}`}
        style={{ width: size, height: size }}
        role="img"
        aria-label={summary}
        onMouseMove={onMove}
        onMouseLeave={() => {
          setHover(null)
          setTip(null)
        }}
        onClick={(e) => {
          const h = hit(e)
          if (h) openPerson(h.id)
        }}
      />
      {tipPerson && (
        <div className="map-tip" style={{ left: tip.x, top: tip.y - nodeRadius(size) - 8 }} role="tooltip">
          <strong>{tipPerson.name}</strong>
          <span>{tipA.days == null ? 'Not logged yet' : tipA.days === 0 ? 'Seen today' : `${tipA.days} days since`}</span>
        </div>
      )}
      {everyone.length === 0 && <div className="map-empty">Nobody here yet. Add someone to start your map.</div>}
    </div>
  )
}
