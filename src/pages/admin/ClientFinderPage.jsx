import {
  HARVEY, VERDICT_POINTS, WORKFLOW_STEPS, ICP_INTRO, ICP_FIELDS,
  ICP_FIT_SIGNALS, PROSPECT_FIELDS, EXAMPLE_EMAIL, GUARDRAILS,
} from "../../lib/clientFinder";
import "./client-finder.css";

/**
 * Client Finder: the Harvey playbook (docs/features/client-finder-harvey.md).
 * A static reference page: what the tool does, Scott's ICP filled in, the
 * per-prospect data checklist, one draft example email, and the guardrails
 * that keep Harvey's automation off until Scott approves a batch. Content
 * lives in src/lib/clientFinder.js; this page holds no state and sends
 * nothing.
 */
export default function ClientFinderPage() {
  const s = HARVEY.stats;
  const statsLine = `${s.license} · ${s.language} · ${s.stars} stars · ${s.forks} forks · Created ${s.created} · Last push ${s.lastPush} · Verified ${s.verifiedOn}`;

  return (
    <div className="module-page client-finder-page">
      <div className="module-header">
        <h1>
          Client Finder
          <span className="client-finder-count">{WORKFLOW_STEPS.length} steps</span>
        </h1>
      </div>

      <p className="vault-intro">
        <i className="fa-solid fa-magnifying-glass" aria-hidden="true" /> {HARVEY.summary}{" "}
        Source: <a href={HARVEY.repoUrl} target="_blank" rel="noreferrer">github.com/ethanplusai/harvey</a>
      </p>
      <p className="client-finder-stats">{statsLine}</p>

      <section className="client-finder-card">
        <div className="client-finder-section-head">
          <h2>Verdict</h2>
          <span className="client-finder-count">{VERDICT_POINTS.length}</span>
        </div>
        <ul className="client-finder-list">
          {VERDICT_POINTS.map((point) => <li key={point}>{point}</li>)}
        </ul>
      </section>

      <section>
        <div className="client-finder-section-head">
          <h2>The workflow</h2>
          <span className="client-finder-count">{WORKFLOW_STEPS.length}</span>
        </div>
        <div className="client-finder-grid">
          {WORKFLOW_STEPS.map((step) => (
            <article className="client-finder-step-card" key={step.n}>
              <span className="client-finder-step-number">{step.n}</span>
              <h3 className="client-finder-step-title">{step.title}</h3>
              <p className="client-finder-step-description">{step.description}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="client-finder-card">
        <div className="client-finder-section-head">
          <h2>Scott's ideal customer profile</h2>
          <span className="client-finder-count">{ICP_FIELDS.length}</span>
        </div>
        <p className="client-finder-note">{ICP_INTRO}</p>
        <dl className="client-finder-fields">
          {ICP_FIELDS.map((f) => (
            <div className="client-finder-field" key={f.label}>
              <dt>{f.label}</dt>
              <dd>{f.value}</dd>
            </div>
          ))}
        </dl>
        <div className="client-finder-section-head">
          <h3>Fit signals</h3>
          <span className="client-finder-count">{ICP_FIT_SIGNALS.length}</span>
        </div>
        <ul className="client-finder-list">
          {ICP_FIT_SIGNALS.map((signal) => <li key={signal}>{signal}</li>)}
        </ul>
      </section>

      <section className="client-finder-card">
        <div className="client-finder-section-head">
          <h2>Data collected per prospect</h2>
          <span className="client-finder-count">{PROSPECT_FIELDS.length}</span>
        </div>
        <ul className="client-finder-checklist">
          {PROSPECT_FIELDS.map((field) => <li key={field}>{field}</li>)}
        </ul>
      </section>

      <section className="client-finder-card">
        <div className="client-finder-section-head">
          <h2>Example outreach email</h2>
          <span className="client-finder-draft-label">Draft example</span>
        </div>
        <p className="client-finder-note">{EXAMPLE_EMAIL.note}</p>
        <p className="client-finder-email-subject">Subject: {EXAMPLE_EMAIL.subject}</p>
        {EXAMPLE_EMAIL.body.map((para) => (
          <p className="client-finder-email-body" key={para}>{para}</p>
        ))}
      </section>

      <section className="client-finder-card">
        <div className="client-finder-section-head">
          <h2>Guardrails</h2>
          <span className="client-finder-count">{GUARDRAILS.length}</span>
        </div>
        <ul className="client-finder-list">
          {GUARDRAILS.map((rule) => <li key={rule}>{rule}</li>)}
        </ul>
      </section>
    </div>
  );
}
