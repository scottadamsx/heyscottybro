import { GROUPS } from '../lib/constants.js'
import { formatDate } from '../lib/dates.js'
import { useOrbit } from '../state/OrbitContext.jsx'
import OrbitMap from './Map.jsx'
import Scrubber from './Scrubber.jsx'
import Badge from './ui/Badge.jsx'

export default function MapCard() {
  const { asOf, timeTravelling } = useOrbit()
  return (
    <section className="card map-card" aria-labelledby="map-title">
      <div className="card-head">
        <h2 id="map-title">Your orbit</h2>
        {timeTravelling && <Badge tone="warn">As of {formatDate(asOf)}</Badge>}
      </div>
      <OrbitMap />
      <Scrubber />
      <ul className="legend" aria-label="Legend">
        {GROUPS.map((g) => (
          <li key={g.id}>
            <span className={`dot group-${g.id}`} aria-hidden /> {g.label}
          </li>
        ))}
        <li>
          <span className="dot dot-danger" aria-hidden /> overdue
        </li>
        <li>
          <span className="legend-line" aria-hidden /> lines = been places together
        </li>
      </ul>
    </section>
  )
}
