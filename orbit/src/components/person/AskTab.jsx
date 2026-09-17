import { useOrbit } from '../../state/OrbitContext.jsx'
import { useDerived } from '../../state/useDerived.js'
import { questionsFor } from '../../lib/derive/questions.js'
import AiBlock, { hasSubstance } from './AiBlock.jsx'

export default function AskTab({ id }) {
  const { people, events } = useOrbit()
  const { done, asOf } = useDerived()
  const p = people[id]
  const qs = questionsFor(id, p, done, asOf, people)

  return (
    <div className="stack-lg">
      <section className="section">
        <h3 className="section-title">Next time, ask about</h3>
        {qs.length ? (
          <ul className="q-list">
            {qs.map((q) => (
              <li key={q.q}>
                <span>{q.q}</span>
                <span className="field-hint">{q.why}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="muted">Nothing to go on yet. Add info or what they're up to, and questions show up here.</p>
        )}
      </section>
      <AiBlock
        title="Claude's questions"
        has={!!p.questions?.length}
        at={p.questionsAt}
        run={(ai) => ai.questions(id)}
        emptyText="Claude can write 5 questions from what you've saved."
        disabledReason={hasSubstance(p, id, events) ? '' : 'Add some info or updates first, then Claude can write these.'}
      >
        <ol className="q-list numbered">
          {(p.questions || []).map((q) => (
            <li key={q}>{q}</li>
          ))}
        </ol>
      </AiBlock>
    </div>
  )
}
