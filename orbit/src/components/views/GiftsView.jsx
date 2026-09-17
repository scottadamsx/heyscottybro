import { useOrbit } from '../../state/OrbitContext.jsx'
import { useUI } from '../../state/UIContext.jsx'
import { useDerived } from '../../state/useDerived.js'
import { RINGS } from '../../lib/constants.js'
import { formatDate } from '../../lib/dates.js'
import { giftBudget, nextChristmas } from '../../lib/derive/birthdays.js'
import { formatCents } from '../../lib/money.js'
import Button from '../ui/Button.jsx'
import Badge from '../ui/Badge.jsx'
import Empty from '../ui/Empty.jsx'
import PersonRow from './PersonRow.jsx'
import { Gift } from '../ui/icons.js'

export default function GiftsView() {
  const { people, settings } = useOrbit()
  const { open } = useUI()
  const { everyone, byPerson, asOf } = useDerived()
  const xmas = nextChristmas(asOf)
  const listed = everyone.filter((id) => byPerson[id].ring <= 2 || (people[id].intents || []).some((i) => i.kind === 'gift' && !i.done))
  const xmasTotal = everyone.reduce((sum, id) => sum + giftBudget(settings, 'xmas', byPerson[id].ring), 0)
  const bdayTotal = everyone.reduce((sum, id) => sum + (people[id].birthday ? giftBudget(settings, 'bday', byPerson[id].ring) : 0), 0)
  const noBudgets = ![...settings.budget.xmas, ...settings.budget.bday].some(Boolean)

  return (
    <div className="stack-lg">
      <dl className="tiles">
        <div className="tile">
          <dt>Christmas</dt>
          <dd>{formatCents(xmasTotal)}</dd>
          <p className="field-hint">{xmas.days === 0 ? 'Today' : `${xmas.days} days to go`}</p>
        </div>
        <div className="tile">
          <dt>Birthdays / year</dt>
          <dd>{formatCents(bdayTotal)}</dd>
          <p className="field-hint">People with a birthday saved</p>
        </div>
      </dl>
      <div className="section-head">
        <p className="muted">{noBudgets ? 'No budgets set yet.' : 'Budgets come from each person’s ring.'}</p>
        <Button size="sm" variant="secondary" onClick={() => open('budgets')}>
          Set budgets
        </Button>
      </div>
      {listed.length ? (
        <ul className="rows">
          {listed.map((id) => {
            const r = byPerson[id].ring
            const idea = (people[id].intents || []).find((i) => i.kind === 'gift' && !i.done)
            return (
              <PersonRow
                key={id}
                id={id}
                sub={
                  <>
                    {RINGS[r]} · {formatCents(giftBudget(settings, 'xmas', r))} Xmas · {formatCents(giftBudget(settings, 'bday', r))} bday
                    {people[id].birthday && ` · ${formatDate(people[id].birthday.length === 5 ? `2000-${people[id].birthday}` : people[id].birthday, { month: 'short', day: 'numeric' })}`}
                  </>
                }
                badge={idea ? <Badge tone="success"><Gift size={12} aria-label="Gift idea:" /> {idea.text}</Badge> : <Badge>no idea yet</Badge>}
              >
                <Button size="sm" variant="ghost" onClick={() => open('intent', { id, kind: 'gift' })} aria-label={`Add gift idea for ${people[id].name}`}>
                  + Idea
                </Button>
              </PersonRow>
            )
          })}
        </ul>
      ) : (
        <Empty>Nobody close enough for a gift budget yet.</Empty>
      )}
    </div>
  )
}
