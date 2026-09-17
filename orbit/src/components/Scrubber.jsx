import { useEffect, useMemo, useRef, useState } from 'react'
import { useOrbit } from '../state/OrbitContext.jsx'
import { addDays, daysBetween, formatDate, today } from '../lib/dates.js'
import Button, { IconButton } from './ui/Button.jsx'
import { Pause, Play } from './ui/icons.js'

const STEP_MS = 140

/** Time travel: scrub from the first event to today, or play it forward. */
export default function Scrubber() {
  const { events, asOf, setAsOf, timeTravelling } = useOrbit()
  const [playing, setPlaying] = useState(false)
  const now = today()
  const first = useMemo(() => {
    const dates = Object.values(events).map((e) => e.date).filter((d) => d && d <= now).sort()
    return dates[0] || null
  }, [events, now])
  const span = first ? daysBetween(first, now) : 0
  const value = first ? Math.max(0, Math.min(span, daysBetween(first, asOf))) : 0
  const valueRef = useRef(value)
  valueRef.current = value

  useEffect(() => {
    if (!playing) return
    const step = Math.max(1, Math.round((span * 12) / 1000))
    const timer = setInterval(() => {
      const next = valueRef.current + step
      if (next >= span) {
        setAsOf(null)
        setPlaying(false)
      } else setAsOf(addDays(first, next))
    }, STEP_MS)
    return () => clearInterval(timer)
  }, [playing, span, first, setAsOf])

  if (!first || span < 1) return null

  const toggle = () => {
    if (!playing && value >= span) setAsOf(first)
    setPlaying((p) => !p)
  }

  return (
    <div className="scrubber">
      <IconButton label={playing ? 'Pause' : 'Play through time'} onClick={toggle}>
        {playing ? <Pause size={16} /> : <Play size={16} />}
      </IconButton>
      <input
        type="range"
        className="range"
        min={0}
        max={span}
        value={value}
        aria-label="As of date"
        aria-valuetext={formatDate(asOf)}
        onChange={(e) => {
          setPlaying(false)
          const d = Number(e.target.value)
          setAsOf(d >= span ? null : addDays(first, d))
        }}
      />
      <span className="scrub-label mono">{timeTravelling ? formatDate(asOf) : 'Today'}</span>
      {timeTravelling && (
        <Button size="sm" variant="ghost" onClick={() => (setPlaying(false), setAsOf(null))}>
          Back to today
        </Button>
      )}
    </div>
  )
}
