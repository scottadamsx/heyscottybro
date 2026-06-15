import { Link, useParams, Navigate } from "react-router-dom";
import { Reveal } from "../../components/Reveal";
import PromptBlock from "./PromptBlock";
import { STEPS, findStep } from "./steps";

export default function GuideStep() {
  const { slug } = useParams();
  const idx = findStep(slug);
  if (idx === -1) return <Navigate to="/guide/step/brief" replace />;

  const step = STEPS[idx];
  const prev = idx > 0 ? STEPS[idx - 1] : null;
  const next = idx < STEPS.length - 1 ? STEPS[idx + 1] : null;
  const { Figure, Plain } = step;

  return (
    <Reveal>
      <article className="lp-guide-section" style={{ borderBottom: "none" }}>
        <div className="lp-step-meta">Step {step.num} of {STEPS.length}</div>
        <h2>{step.title}</h2>

        <Plain />
        {Figure && <Figure />}

        <h3>The prompt to copy</h3>
        <PromptBlock text={step.prompt} />
        <p className="lp-step-note">
          <i className="fa-solid fa-circle-info" /> Don&apos;t worry about the technical words in there —
          the prompt is written so the AI builds it the right way. Your job is just to paste it, answer
          its questions, and approve what it gives you.
        </p>

        {/* Prev / next */}
        <div className="lp-step-nav">
          {prev
            ? <Link to={`/guide/step/${prev.slug}`} className="pill pill-ghost"><i className="fa-solid fa-arrow-left" /> {prev.title}</Link>
            : <Link to="/guide" className="pill pill-ghost"><i className="fa-solid fa-arrow-left" /> Overview</Link>}
          {next
            ? <Link to={`/guide/step/${next.slug}`} className="pill pill-dark">{next.title} <i className="fa-solid fa-arrow-right" /></Link>
            : <Link to="/guide/help" className="pill pill-dark">Help &amp; FAQ <i className="fa-solid fa-arrow-right" /></Link>}
        </div>
      </article>
    </Reveal>
  );
}
