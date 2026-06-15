import { Link } from "react-router-dom";
import { Reveal } from "../../components/Reveal";

const FAQ = [
  ["Do I need to know how to code?", "Nope. This guide is the plan and the conversation — the actual code gets written for you. Your job is to make the decisions only you can make: what it's for, what it should do, and what it should feel like."],
  ["How long does this take?", "The planning is usually a few focused conversations — sometimes an afternoon for something small. The build then goes screen by screen. Because the thinking is done up front, the building part is fast and rarely doubles back."],
  ["What if I change my mind halfway?", "That's allowed and expected — that's exactly why we plan one piece at a time. If a later step changes an earlier decision, we go back, adjust, and flow forward again. Better to catch it on paper than after it's built."],
  ["Why not just use a website builder like Wix or Squarespace?", "Those are great for a brochure-style site. This approach is for real apps — things with logins, saved data, and custom logic (a tracker, a tool, a small product). You get something that's truly yours, not boxed into a template."],
  ["What does it cost to run?", "Most of the toolkit has generous free tiers — you can launch a small app for $0 and only pay once it grows. The main running costs to watch are the database (if it gets big) and any AI features (a few cents per use)."],
];

export default function GuideHelp() {
  return (
    <Reveal>
      <article className="lp-guide-section" style={{ borderBottom: "none" }}>
        <h2>Help &amp; common questions</h2>
        <p>Stuck, curious, or wondering if this is for you? Start here.</p>
        <div className="lp-faq">
          {FAQ.map(([q, a]) => (
            <details key={q}>
              <summary>{q}</summary>
              <p>{a}</p>
            </details>
          ))}
        </div>
        <div className="lp-guide-callout" style={{ marginTop: "1.6rem" }}>
          <strong>Want to build something with this approach?</strong> I&apos;m always up for a good idea —
          <a href="mailto:scottadamsx@gmail.com" style={{ color: "var(--green)" }}> say hello</a> and tell
          me what you&apos;re dreaming up.
        </div>
        <div className="lp-subhero-cta" style={{ justifyContent: "flex-start", marginTop: "1.4rem" }}>
          <a href="mailto:scottadamsx@gmail.com" className="pill pill-dark"><i className="fa-solid fa-paper-plane" /> say hello</a>
          <Link to="/" className="pill pill-ghost"><i className="fa-solid fa-arrow-left" /> back home</Link>
        </div>
      </article>
    </Reveal>
  );
}
