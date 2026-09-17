import { createContext, createElement, useContext, useMemo } from 'react'
import { useOrbit } from './OrbitContext.jsx'
import { analyzeAll, eventsAsOf } from '../lib/derive/analyze.js'
import { cooccur } from '../lib/derive/cooccur.js'
import { detectClusters } from '../lib/derive/clusters.js'
import { isInPerson } from '../lib/constants.js'
import { daysBetween } from '../lib/dates.js'

const DerivedContext = createContext(null)

/**
 * Everything derived from events, as of the current as-of date. Computed once per change of
 * people, events or the as-of date, and shared; nothing here is ever stored.
 */
export function DerivedProvider({ children }) {
  const { people, events, asOf } = useOrbit()
  const value = useMemo(() => {
    const done = eventsAsOf(events, asOf)
    const byPerson = analyzeAll(people, events, asOf)
    const weights = cooccur(done, asOf)
    const clusters = detectClusters(people, weights)
    const clusterOf = {}
    for (const c of clusters) for (const id of c.members) clusterOf[id] = c
    const ids = Object.keys(people)
    const byName = (a, b) => (people[a].name || '').localeCompare(people[b].name || '')
    const everyone = [...ids].sort((a, b) => byPerson[a].ring - byPerson[b].ring || byName(a, b))
    const drifting = ids
      .filter((id) => byPerson[id].drift)
      .sort((a, b) => byPerson[b].days - byPerson[b].cadence - (byPerson[a].days - byPerson[a].cadence) || byName(a, b))
    return {
      asOf,
      done,
      byPerson,
      weights,
      clusters,
      clusterOf,
      everyone,
      drifting,
      stats: {
        people: ids.length,
        innerClose: ids.filter((id) => byPerson[id].ring <= 1).length,
        hangouts30: done.filter((e) => isInPerson(e.kind) && daysBetween(e.date, asOf) <= 30).length,
        clusters: clusters.length,
        drifting: drifting.length,
      },
    }
  }, [people, events, asOf])
  return createElement(DerivedContext.Provider, { value }, children)
}

export function useDerived() {
  const ctx = useContext(DerivedContext)
  if (!ctx) throw new Error('useDerived must be used inside DerivedProvider')
  return ctx
}
