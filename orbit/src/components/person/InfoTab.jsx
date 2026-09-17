import { useOrbit } from '../../state/OrbitContext.jsx'
import { useUI } from '../../state/UIContext.jsx'
import { useDerived } from '../../state/useDerived.js'
import { TOPICS, groupOf } from '../../lib/constants.js'
import { formatDate } from '../../lib/dates.js'
import { nextBirthday } from '../../lib/derive/birthdays.js'
import Button, { IconButton } from '../ui/Button.jsx'
import PersonChip from '../ui/PersonChip.jsx'
import { X } from '../ui/icons.js'

function birthdayText(b, asOf) {
  if (!b) return 'Not saved'
  const n = nextBirthday(b, asOf)
  const date = b.length === 5 ? formatDate(`2000-${b}`, { month: 'long', day: 'numeric' }) : formatDate(b, { month: 'long', day: 'numeric', year: 'numeric' })
  const when = n.days === 0 ? 'today' : `in ${n.days} day${n.days === 1 ? '' : 's'}`
  return `${date} (${n.turning != null ? `turns ${n.turning} ` : ''}${when})`
}

/** First logged contact, or when they were added to Orbit. */
function knownSince(p, id, events) {
  const first = Object.values(events)
    .filter((e) => e.people?.includes(id) && e.kind !== 'Note' && (e.status || 'done') === 'done')
    .map((e) => e.date)
    .sort()[0]
  if (first) return `${formatDate(first)} (first logged)`
  return p.createdAt ? `Added to Orbit ${formatDate(p.createdAt.slice(0, 10))}` : 'Unknown'
}

export default function InfoTab({ id }) {
  const { people, events, savePerson, peek } = useOrbit()
  const { open, notify } = useUI()
  const { asOf } = useDerived()
  const p = people[id]
  const facts = p.facts || []
  // Connections both ways: facts on this card that link out, and facts on other cards that link here.
  const linksOut = facts.map((f, index) => ({ ...f, index })).filter((f) => f.ref && people[f.ref])
  // Someone already linked from this card isn't listed again from their side.
  const linkedOut = new Set(linksOut.map((f) => f.ref))
  const linksIn = Object.entries(people).flatMap(([pid, o]) =>
    pid === id || linkedOut.has(pid) ? [] : (o.facts || []).filter((f) => f.ref === id).map((f) => ({ pid, k: f.k })),
  )

  const removeFact = (index) => {
    const removed = facts[index]
    savePerson(id, { ...p, facts: facts.filter((_, i) => i !== index) })
      .then(() =>
        notify(`Removed ${removed.k}`, {
          action: {
            label: 'Undo',
            run: () => {
              const now = peek().people[id]
              if (!now) return
              const list = [...(now.facts || [])]
              list.splice(index, 0, removed)
              savePerson(id, { ...now, facts: list }).catch(() => {})
            },
          },
        }),
      )
      .catch(() => {})
  }

  return (
    <div className="stack-lg">
      <section className="section">
        <div className="section-head">
          <h3 className="section-title">Basics</h3>
          <Button size="sm" variant="ghost" onClick={() => open('editPerson', { id })}>
            Edit basics
          </Button>
        </div>
        <dl className="facts-dl">
          <dt>Birthday</dt>
          <dd>{birthdayText(p.birthday, asOf)}</dd>
          <dt>Known since</dt>
          <dd>{knownSince(p, id, events)}</dd>
          <dt>Group</dt>
          <dd>{groupOf(p.group).label}</dd>
          <dt>How you know them</dt>
          <dd>{p.how || <span className="muted">Not saved</span>}</dd>
          <dt>Notes</dt>
          <dd className="prose">{p.notes || <span className="muted">None</span>}</dd>
        </dl>
      </section>

      <section className="section">
        <h3 className="section-title">Connections</h3>
        {linksOut.length || linksIn.length ? (
          <ul className="fact-list">
            {linksOut.map((f) => (
              <li key={`out-${f.index}`} className="connection">
                <span className="muted">{f.k}</span> <PersonChip id={f.ref} full />
              </li>
            ))}
            {linksIn.map((l) => (
              <li key={`in-${l.pid}-${l.k}`} className="connection">
                <PersonChip id={l.pid} full /> <span className="muted">lists them as their {l.k.toLowerCase()}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="muted">No links to other people yet. Add info with a person picked to connect them.</p>
        )}
      </section>

      <div>
        <Button variant="secondary" onClick={() => open('fact', { id })}>
          + Add info
        </Button>
      </div>

      {TOPICS.map((t) => {
        const list = facts.map((f, index) => ({ ...f, index })).filter((f) => (f.topic || 'other') === t.id)
        return (
          <section key={t.id} className="section">
            <div className="section-head">
              <h3 className="section-title">{t.label}</h3>
              <Button size="sm" variant="ghost" onClick={() => open('fact', { id, topic: t.id })} aria-label={`Add ${t.label} info`}>
                + Add
              </Button>
            </div>
            {list.length ? (
              <ul className="fact-list">
                {list.map((f) => (
                  <li key={`${f.index}-${f.k}`}>
                    <button type="button" className="fact" onClick={() => open('fact', { id, index: f.index })}>
                      <strong>{f.k}</strong>
                      {f.v && <span> {f.v}</span>}
                      {f.ref && people[f.ref] && <span className="muted"> (linked)</span>}
                    </button>
                    <IconButton label={`Remove ${f.k}`} onClick={() => removeFact(f.index)} className="icon-sm">
                      <X size={14} />
                    </IconButton>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="muted">No info yet. Add something or ask them next time.</p>
            )}
          </section>
        )
      })}
    </div>
  )
}
