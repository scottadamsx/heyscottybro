import { useOrbit } from '../../state/OrbitContext.jsx'
import { useUI } from '../../state/UIContext.jsx'
import { formatDate } from '../../lib/dates.js'
import Button from '../ui/Button.jsx'
import Badge from '../ui/Badge.jsx'
import AiBlock, { hasSubstance } from './AiBlock.jsx'
import IntentList from './IntentList.jsx'
import EventRow from '../EventRow.jsx'

export default function ProfileTab({ id }) {
  const { people, events } = useOrbit()
  const { open, openEvent } = useUI()
  const p = people[id]
  const mine = Object.entries(events)
    .filter(([, e]) => e.people?.includes(id))
    .sort((a, b) => (a[1].date < b[1].date ? 1 : a[1].date > b[1].date ? -1 : 0))
  const updates = mine.filter(([, e]) => e.updates?.[id])
  const intents = p.intents || []

  return (
    <div className="stack-lg">
      <AiBlock
        title="The picture"
        has={!!p.summary}
        at={p.summaryAt}
        run={(ai) => ai.picture(id)}
        emptyText="No picture yet. Claude can write one from your notes."
        disabledReason={hasSubstance(p, id, events) ? '' : 'Add some info or updates first, then Claude can write this.'}
      >
        <p className="prose">{p.summary}</p>
      </AiBlock>

      <section className="section">
        <div className="section-head">
          <h3 className="section-title">Meant to & gift ideas</h3>
          <div className="row-actions">
            <Button size="sm" variant="ghost" onClick={() => open('intent', { id, kind: 'todo' })}>
              + Meant to
            </Button>
            <Button size="sm" variant="ghost" onClick={() => open('intent', { id, kind: 'gift' })}>
              + Gift idea
            </Button>
          </div>
        </div>
        {intents.length ? <IntentList id={id} intents={intents} /> : <p className="muted">Nothing yet.</p>}
      </section>

      <section className="section">
        <h3 className="section-title">What they've been up to</h3>
        {updates.length ? (
          <ol className="timeline">
            {updates.map(([eid, e]) => (
              <li key={eid}>
                <span className="timeline-date mono">{formatDate(e.date)}</span>
                <span>
                  {e.updates[id]}{' '}
                  <button type="button" className="link" onClick={() => openEvent(eid)}>
                    ({e.title || e.kind})
                  </button>
                </span>
              </li>
            ))}
          </ol>
        ) : (
          <p className="muted">Nothing yet. Add what they're up to when you log a hangout.</p>
        )}
      </section>

      <section className="section">
        <div className="section-head">
          <h3 className="section-title">History</h3>
          <Badge>{mine.length}</Badge>
        </div>
        {mine.length ? (
          <ul className="rows">
            {mine.map(([eid, e]) => (
              <EventRow key={eid} event={e} onOpen={() => openEvent(eid)} showStatus />
            ))}
          </ul>
        ) : (
          <div className="empty">
            <p>Nothing yet.</p>
            <Button size="sm" variant="secondary" onClick={() => open('log', { people: [id] })}>
              + Log a hangout
            </Button>
          </div>
        )}
      </section>
    </div>
  )
}
