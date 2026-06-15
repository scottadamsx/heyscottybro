import { Link } from "react-router-dom";
import { Reveal } from "../../components/Reveal";

const ACCOUNTS = [
  {
    name: "GitHub",
    what: "Where your app's code lives — and the thing Vercel reads from to put your site online. Set this up first; the others sign in through it.",
    href: "https://github.com",
    cta: "Open github.com",
    steps: [
      <>Go to <strong>github.com</strong> and click <strong>Sign up</strong>.</>,
      <>Pick a username, enter your email, and create a password.</>,
      <>Verify your email when they send you a code. That&apos;s it — your code now has a home.</>,
    ],
  },
  {
    name: "Supabase",
    what: "Your back end: the database that remembers everything, plus logins and file storage. The free tier is plenty to start.",
    href: "https://supabase.com",
    cta: "Open supabase.com",
    steps: [
      <>Go to <strong>supabase.com</strong> and click <strong>Start your project</strong>.</>,
      <>Sign in with your <strong>GitHub</strong> account — one click, no new password.</>,
      <>Click <strong>New project</strong> and give it a name.</>,
      <>Set a database password and <strong>write it down somewhere safe</strong> — you&apos;ll need it later.</>,
      <>Pick the region closest to you, then wait about 2 minutes while it builds.</>,
    ],
  },
  {
    name: "Vercel",
    what: "Takes your code and puts it live on the internet with a real, shareable link. Free for personal projects.",
    href: "https://vercel.com",
    cta: "Open vercel.com",
    steps: [
      <>Go to <strong>vercel.com</strong> and <strong>Sign up with GitHub</strong>.</>,
      <>Click <strong>Add New… → Project</strong> and import your code from GitHub.</>,
      <>Click <strong>Deploy</strong> and wait a minute.</>,
      <>You&apos;ll get a live link you can share with anyone. Every time you update your code, it updates itself.</>,
    ],
  },
  {
    name: "Anthropic (optional)",
    what: "Only needed if your app has an AI feature. This is the key that lets your app talk to Claude.",
    href: "https://console.anthropic.com",
    cta: "Open console.anthropic.com",
    steps: [
      <>Go to <strong>console.anthropic.com</strong> and sign up.</>,
      <>Open <strong>API Keys</strong> and create a new key.</>,
      <>Copy it and <strong>keep it secret</strong> — treat it like a password, and never paste it into the website itself (it belongs on the server side).</>,
    ],
  },
];

export default function GuideSetup() {
  return (
    <Reveal>
      <article className="lp-guide-section" style={{ borderBottom: "none" }}>
        <h2>Set up your accounts</h2>
        <p>
          You need a few free accounts before anything can go live. Do them in this order — each one
          plugs into the next. Don&apos;t worry, they&apos;re all free to start and take about five minutes total.
        </p>

        <div className="lp-setup">
          {ACCOUNTS.map((a, i) => (
            <div className="lp-setup-card" key={a.name}>
              <div className="lp-setup-head">
                <span className="lp-setup-num">{i + 1}</span>
                <h3>{a.name}</h3>
              </div>
              <p className="lp-setup-what">{a.what}</p>
              <ol>
                {a.steps.map((s, j) => <li key={j}>{s}</li>)}
              </ol>
              <a href={a.href} target="_blank" rel="noreferrer" className="pill pill-dark">
                {a.cta} <i className="fa-solid fa-arrow-up-right-from-square" />
              </a>
            </div>
          ))}
        </div>

        <div className="lp-guide-callout" style={{ marginTop: "1.6rem" }}>
          <strong>Keep your passwords and keys somewhere safe</strong> — a password manager is ideal.
          That database password and any API key are the two things you really don&apos;t want to lose or leak.
        </div>

        <div className="lp-subhero-cta" style={{ justifyContent: "flex-start", marginTop: "1.4rem" }}>
          <Link to="/guide/step/brief" className="pill pill-dark">start the steps <i className="fa-solid fa-arrow-right" /></Link>
          <Link to="/guide/help" className="pill pill-ghost">help &amp; FAQ</Link>
        </div>
      </article>
    </Reveal>
  );
}
