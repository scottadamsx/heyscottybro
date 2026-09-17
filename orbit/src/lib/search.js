// Search across everything Orbit knows. Shared by the search dialog and the interview agent.
import { GROUP } from './constants.js'
import { normText } from './dedupe.js'

const snippet = (text, words) => {
  const clean = String(text || '').replace(/\s+/g, ' ').trim()
  const n = normText(clean)
  const hit = words.map((w) => n.indexOf(w)).filter((i) => i >= 0).sort((a, b) => a - b)[0] ?? 0
  const start = Math.max(0, hit - 40)
  return `${start ? '…' : ''}${clean.slice(start, start + 120)}${clean.length > start + 120 ? '…' : ''}`
}

/**
 * Every word in the query must appear somewhere in the record. Names score highest, then how you
 * know them and facts, then notes and events. Returns { people: [...], events: [...] }.
 */
export function searchAll(people, events, query, { limit = 20 } = {}) {
  const words = normText(query).split(' ').filter(Boolean)
  if (!words.length) return { people: [], events: [] }

  const peopleHits = []
  for (const [id, p] of Object.entries(people)) {
    const fields = [
      ['name', p.name, 5],
      ['group', GROUP[p.group]?.label, 1],
      ['how', p.how, 3],
      ...(p.facts || []).map((f) => [`fact`, `${f.k}: ${f.v || ''}`, 3]),
      ['notes', p.notes, 2],
      ...(p.intents || []).filter((i) => !i.done).map((i) => ['intent', i.text, 1]),
    ]
    const events_ = Object.values(events).filter((e) => e.people?.includes(id))
    for (const e of events_) if (e.updates?.[id]) fields.push(['update', e.updates[id], 2])
    const hay = normText(fields.map((f) => f[1]).join(' '))
    if (!words.every((w) => hay.includes(w))) continue
    let score = 0
    let best = null
    for (const [kind, text, weight] of fields) {
      const t = normText(text)
      const n = words.filter((w) => t.includes(w)).length
      if (!n) continue
      score += n * weight
      if (!best || n * weight > best.s) best = { s: n * weight, kind, text }
    }
    peopleHits.push({ id, name: p.name, score, matched: best?.kind, snippet: best && best.kind !== 'name' ? snippet(best.text, words) : '' })
  }

  const eventHits = []
  for (const [id, e] of Object.entries(events)) {
    const names = (e.people || []).map((pid) => people[pid]?.name || '')
    const text = [e.title, e.kind, e.place, e.notes, ...Object.values(e.updates || {}), ...names, e.date].join(' ')
    const hay = normText(text)
    if (!words.every((w) => hay.includes(w))) continue
    eventHits.push({ id, date: e.date, title: e.title || e.kind, snippet: snippet([e.place, e.notes, ...Object.values(e.updates || {})].filter(Boolean).join(' · '), words) })
  }

  return {
    people: peopleHits.sort((a, b) => b.score - a.score || a.name.localeCompare(b.name)).slice(0, limit),
    events: eventHits.sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, limit),
  }
}
