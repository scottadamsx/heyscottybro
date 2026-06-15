import { Reveal } from "../../components/Reveal";

const TOOLS = [
  { name: "React", href: "https://react.dev", desc: "Builds the screens you click around in." },
  { name: "Tailwind CSS", href: "https://tailwindcss.com", desc: "Styles everything quickly and consistently." },
  { name: "shadcn/ui", href: "https://ui.shadcn.com", desc: "Ready-made, good-looking buttons, dialogs and menus." },
  { name: "Supabase", href: "https://supabase.com", desc: "The online database + login + security guard." },
  { name: "Vercel", href: "https://vercel.com", desc: "Puts your site live on the internet." },
  { name: "Claude", href: "https://www.anthropic.com/claude", desc: "The AI brain, for when the app needs to think." },
];

export default function GuideToolkit() {
  return (
    <Reveal>
      <article className="lp-guide-section" style={{ borderBottom: "none" }}>
        <h2>The toolkit (and where to peek)</h2>
        <p>
          The tools are boring on purpose — proven pieces that play nicely together. You don&apos;t need
          to know any of them to use this guide, but if you&apos;re curious, here&apos;s what each one does
          and a link to see it:
        </p>
        <div className="lp-tools">
          {TOOLS.map((t) => (
            <a className="lp-tool" key={t.name} href={t.href} target="_blank" rel="noreferrer">
              <span className="lp-tool-name">{t.name} <i className="fa-solid fa-arrow-up-right-from-square" /></span>
              <span className="lp-tool-desc">{t.desc}</span>
            </a>
          ))}
        </div>
        <div className="lp-guide-callout" style={{ marginTop: "1.6rem" }}>
          <strong>The honest rule:</strong> most of these have generous free tiers — you can launch a
          small app for $0 and only pay once it grows.
        </div>
      </article>
    </Reveal>
  );
}
