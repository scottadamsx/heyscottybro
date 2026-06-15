import { Link } from "react-router-dom";
import { Reveal } from "../../components/Reveal";
import { FlowFigure } from "./figures";

export default function GuideStart() {
  return (
    <Reveal>
      <article className="lp-guide-section" style={{ borderBottom: "none" }}>
        <h2>The big idea: plan once, build seamless</h2>
        <p>
          Most software gets built like this: start coding, figure it out as you go, then rip it
          apart and rebuild it three times. This guide does the opposite. We do the
          <strong> thinking up front, together,</strong> one honest little decision at a time — so the
          building part is almost boring. And boring is good. Boring means it works.
        </p>
        <div className="lp-guide-callout">
          <strong>The whole philosophy in one line:</strong> plan it slowly and together, so it works
          seamlessly forever — no “version 2” that only exists to fix version 1.
        </div>

        <h3>How it works — an assembly line</h3>
        <p>
          Every step takes the last approved piece and produces the next. You approve each one before
          we move on, so nothing gets built on a shaky foundation. Here&apos;s the whole flow:
        </p>
        <FlowFigure />
        <div className="lp-guide-callout">
          If a later step reveals a problem in an earlier one, we go <strong>back</strong> and re-flow
          forward — we don&apos;t paper over it. That&apos;s what prevents a messy redo later.
        </div>

        <h3>What you actually do</h3>
        <p>
          You don&apos;t need to know how to code. Your job is to make the decisions only you can make —
          what it&apos;s for, what it should do, and what it should feel like. The rest gets handled.
          Each step below has a plain explanation <em>and</em> a ready-made prompt to paste into an AI.
        </p>
        <p>
          First things first: get your free accounts set up, then start the steps.
        </p>
        <div className="lp-subhero-cta" style={{ justifyContent: "flex-start", marginTop: "1.2rem" }}>
          <Link to="/guide/step/brief" className="pill pill-dark">start the steps <i className="fa-solid fa-arrow-right" /></Link>
          <Link to="/guide/setup" className="pill pill-ghost">set up accounts first</Link>
        </div>
      </article>
    </Reveal>
  );
}
