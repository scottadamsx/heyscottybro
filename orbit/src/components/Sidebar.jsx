import { useMemo, useState } from 'react'
import { useOrbit } from '../state/OrbitContext.jsx'
import { useUI } from '../state/UIContext.jsx'
import { useDerived } from '../state/useDerived.js'
import { RINGS } from '../lib/constants.js'
import { formatDate } from '../lib/dates.js'
import { nextBirthday, giftBudget } from '../lib/derive/birthdays.js'
import { normText } from '../lib/dedupe.js'
import { formatCents } from '../lib/money.js'
import Button from './ui/Button.jsx'
import Badge, { DaysBadge } from './ui/Badge.jsx'
import Empty from './ui/Empty.jsx'
import PersonRow from './views/PersonRow.jsx'
import IntentList from './person/IntentList.jsx'
import { Sparkles } from './ui/icons.js'

const SYNC = {
  saved: ['success', 'Saved'],
  saving: ['warn', 'Saving…'],
  error: ['danger', 'Not saved'],
}

function QuickActions() {
  const { sync, ai } = useOrbit()
  const { open } = useUI()
  return (
    <section className="card" aria-labelledby="qa-title">
      <div className="card-head">
        <h2 id="qa-title">Quick actions</h2>
        <Badge tone={SYNC[sync][0]} role="status">
          {SYNC[sync][1]}
        </Badge>
      </div>
      <div className="stack-sm">
        <Button variant="primary" onClick={() => open('log')}>
          + Log a hangout
        </Button>
        <Button variant="secondary" onClick={() => open('addPeople')}>
          + Add person
        </Button>
        {ai.available && (
          <Button onClick={() => open('interview')}>
            <Sparkles size={16} aria-hidden /> Interview me
          </Button>
        )}
      </div>
    </section>
  )
}

function Drifting() {
  const { drifting, byPerson } = useDerived()
  const { open } = useUI()
  return (
    <section className="card" aria-labelledby="drift-title">
      <div className="card-head">
        <h2 id="drift-title">Drifting</h2>
        <Badge tone={drifting.length ? 'danger' : 'neutral'}>{drifting.length}</Badge>
      </div>
      {drifting.length ? (
        <ul className="rows">
          {drifting.slice(0, 8).map((id) => (
            <PersonRow key={id} id={id} sub={`${RINGS[byPerson[id].ring]} · every ~${byPerson[id].cadence}d`} badge={<DaysBadge a={byPerson[id]} />}>
              <Button size="sm" variant="ghost" onClick={() => open('sayHi', { id })}>
                Say hi
              </Button>
            </PersonRow>
          ))}
        </ul>
      ) : (
        <p className="muted">Nobody's drifting.</p>
      )}
    </section>
  )
}

function Birthdays() {
  const { people, settings } = useOrbit()
  const { everyone, byPerson, asOf } = useDerived()
  const { open } = useUI()
  const soon = everyone
    .map((id) => ({ id, b: nextBirthday(people[id].birthday, asOf) }))
    .filter((x) => x.b && x.b.days <= 90)
    .sort((x, y) => x.b.days - y.b.days)
  const missing = everyone.filter((id) => !people[id].birthday).length
  return (
    <section className="card" aria-labelledby="bday-title">
      <div className="card-head">
        <h2 id="bday-title">Birthdays</h2>
        <span className="muted">next 90 days</span>
      </div>
      {soon.length ? (
        <ul className="rows">
          {soon.map(({ id, b }) => {
            const budget = giftBudget(settings, 'bday', byPerson[id].ring)
            return (
              <PersonRow
                key={id}
                id={id}
                sub={`${formatDate(b.date, { month: 'short', day: 'numeric' })}${b.turning != null ? ` · turns ${b.turning}` : ''}${budget ? ` · ${formatCents(budget)}` : ''}`}
                badge={<Badge tone={b.days <= 7 ? 'warn' : 'neutral'}>{b.days === 0 ? 'today' : `${b.days}d`}</Badge>}
              />
            )
          })}
        </ul>
      ) : (
        <p className="muted">No birthdays in the next 90 days.</p>
      )}
      {missing > 0 && (
        <p className="field-hint">
          {missing} {missing === 1 ? 'person has' : 'people have'} no birthday saved.{' '}
          <button type="button" className="link" onClick={() => open('allPeople', { filter: 'noBirthday' })}>
            Fill them in
          </button>
        </p>
      )}
    </section>
  )
}

function MeantTo() {
  const { people } = useOrbit()
  // Dated follow-ups first (soonest first), then the rest.
  const open = Object.entries(people)
    .flatMap(([pid, p]) => (p.intents || []).filter((i) => !i.done).map((i) => ({ ...i, pid })))
    .sort((a, b) => (a.due || '9999') .localeCompare(b.due || '9999'))
    .slice(0, 8)
  return (
    <section className="card" aria-labelledby="meant-title">
      <div className="card-head">
        <h2 id="meant-title">Follow-ups</h2>
      </div>
      {open.length ? <IntentList intents={open} showOwner /> : <p className="muted">Nothing yet. Add things from someone's card.</p>}
    </section>
  )
}

function Everyone() {
  const { people } = useOrbit()
  const { everyone, byPerson } = useDerived()
  const { open } = useUI()
  const [q, setQ] = useState('')
  const shown = useMemo(() => (q ? everyone.filter((id) => normText(people[id].name).includes(normText(q))) : everyone), [q, everyone, people])
  return (
    <section className="card" aria-labelledby="everyone-title">
      <div className="card-head">
        <h2 id="everyone-title">Everyone</h2>
        <span className="muted mono">{everyone.length}</span>
      </div>
      {everyone.length === 0 ? (
        <Empty action={<Button variant="secondary" onClick={() => open('addPeople')}>+ Add person</Button>} />
      ) : (
        <>
          {everyone.length > 8 && (
            <input className="input list-filter" placeholder="Find someone" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Find someone" />
          )}
          <ul className="rows">
            {shown.map((id) => (
              <PersonRow key={id} id={id} sub={RINGS[byPerson[id].ring]} badge={<DaysBadge a={byPerson[id]} />} />
            ))}
          </ul>
          {shown.length === 0 && (
            <p className="muted">
              Nobody called "{q}".{' '}
              <button type="button" className="link" onClick={() => open('addPeople', { name: q })}>
                Add them
              </button>
            </p>
          )}
        </>
      )}
    </section>
  )
}

export default function Sidebar() {
  return (
    <aside className="sidebar" aria-label="Sidebar">
      <QuickActions />
      <Drifting />
      <Birthdays />
      <MeantTo />
      <Everyone />
    </aside>
  )
}
