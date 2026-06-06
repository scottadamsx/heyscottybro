import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import "./home.css";

/* Thin top scroll-progress bar */
function ScrollProgress() {
  const [w, setW] = useState(0);
  useEffect(() => {
    const onScroll = () => {
      const h = document.documentElement;
      const max = h.scrollHeight - h.clientHeight;
      setW(max > 0 ? (h.scrollTop / max) * 100 : 0);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  return <div className="scroll-progress" style={{ width: `${w}%` }} />;
}

/* Reveal-on-scroll wrapper */
function Reveal({ children, className = "", delay = 0 }) {
  const ref = useRef(null);
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) { setShown(true); io.disconnect(); }
    }, { threshold: 0.12 });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <div ref={ref} className={`reveal ${shown ? "in" : ""} ${className}`} style={delay ? { transitionDelay: `${delay}ms` } : undefined}>
      {children}
    </div>
  );
}

const MARQUEE = ["Builder", "Founder", "React", "Python", "Supabase", "St. John's · NL", "scotty.3xe", "Restaurant tech", "Hike club", "Always shipping"];

const PROJECTS = [
  { id: "never86", tag: "Live Product", title: "NEVER86", desc: "A restaurant management platform built for independents — communication, customization and efficiency, front and centre.", emoji: "🍽️", img: "/images/never86_website_concept.png", bg: "linear-gradient(135deg,#ffe2d1,#ffc2b0)", to: null, href: "https://never86.ca", cta: "Visit site" },
  { id: "sjhc", tag: "Live Community", title: "St. John's Hike Club", desc: "More than a walking group — a community movement exploring Newfoundland's most stunning trails.", emoji: "🥾", img: "/images/hikeclub.JPG", bg: "linear-gradient(135deg,#d7f0dd,#bfe6cb)", to: null, href: "https://stjohnshikeclub.com", cta: "Visit site" },
  { id: "minecraft-trivia", tag: "Game", title: "Minecraft Trivia", desc: "How well do you know the world of Minecraft? Blocks, mobs, biomes and more.", emoji: "⛏️", img: null, bg: "linear-gradient(135deg,#dfe7ff,#c7d4ff)", to: "/games/minecraft-trivia", href: null, cta: "Play now" },
  { id: "monopoly", tag: "Game", title: "Monopoly Banker", desc: "The digital Monopoly bank. No paper money, no arguments — clean, fast, fun.", emoji: "🎩", img: null, bg: "linear-gradient(135deg,#ffe9c2,#ffd79a)", to: "/games/monopoly-banker", href: null, cta: "Play now" },
  { id: "tictactoe", tag: "Game", title: "Tic-Tac-Toe", desc: "Classic Tic-Tac-Toe with score tracking. Challenge a friend between deploys.", emoji: "⭕", img: null, bg: "linear-gradient(135deg,#ffd9e0,#ffc0cd)", to: "/games/tictactoe", href: null, cta: "Play now" },
  { id: "planner", tag: "Admin Tool", title: "Personal Planner", desc: "My all-in-one personal command centre — reminders, calendar, journal, budget. Password protected.", emoji: "📋", img: null, bg: "linear-gradient(135deg,#e6e0ff,#cdbdff)", to: "/admin/login", href: null, cta: "Open planner" },
];

const SKILLS = ["🐍 Python", "⚛️ React", "🟨 JavaScript", "🐦 TypeScript", "🐘 PostgreSQL", "⚡ Supabase", "🌿 Flask", "🎨 CSS / HTML", "📦 Git", "🎮 Godot"];

function WorkCard({ p }) {
  const inner = (
    <>
      <div className={`lp-card-media ${p.img ? "" : "ph"}`} style={p.img ? undefined : { background: p.bg }}>
        {p.img ? <img src={p.img} alt={p.title} /> : <span>{p.emoji}</span>}
      </div>
      <div className="lp-card-body">
        <span className="lp-tag">{p.tag}</span>
        <h3 className="lp-card-title">{p.title}</h3>
        <p className="lp-card-desc">{p.desc}</p>
        <span className="lp-card-link">{p.cta} <i className="fa-solid fa-arrow-right" /></span>
      </div>
    </>
  );
  return p.href
    ? <a className="lp-card" href={p.href} target="_blank" rel="noreferrer">{inner}</a>
    : <Link className="lp-card" to={p.to}>{inner}</Link>;
}

export default function HomePage() {
  return (
    <div className="lp">
      <ScrollProgress />

      {/* ── Hero ── */}
      <header className="lp-hero">
        <span className="lp-eyebrow">Available for work · St. John's, NL</span>
        <h1 className="lp-hero-title">
          I build software<br />people <em>love</em> to use.
        </h1>
        <p className="lp-hero-sub">
          Scott Adams — junior software developer, student &amp; founder. From restaurant
          platforms to hiking communities to tools I use every day.
        </p>
        <div className="lp-cta">
          <a href="#work" className="pill pill-dark">See my work <i className="fa-solid fa-arrow-down" /></a>
          <a href="mailto:scottadamsx@gmail.com" className="pill pill-ghost">Say hello 👋</a>
        </div>
        <div className="lp-stats">
          <div className="lp-stat"><b>2+</b><span>Live products</span></div>
          <div className="lp-stat"><b>6+</b><span>Projects shipped</span></div>
          <div className="lp-stat"><b>∞</b><span>Ideas brewing</span></div>
        </div>
      </header>

      {/* ── Marquee ── */}
      <div className="lp-marquee" aria-hidden="true">
        <div className="lp-marquee-track">
          {[...MARQUEE, ...MARQUEE].map((m, i) => <span className="lp-marquee-item" key={i}>{m}</span>)}
        </div>
      </div>

      {/* ── Work ── */}
      <section className="lp-section" id="work">
        <Reveal>
          <span className="lp-kicker">Selected work</span>
          <h2 className="lp-h2">Things I&apos;ve built</h2>
          <p className="lp-section-sub">From live products to playful experiments — a look at what I&apos;ve been making.</p>
        </Reveal>
        <Reveal>
          <div className="lp-work-grid">
            {PROJECTS.map((p) => <WorkCard key={p.id} p={p} />)}
          </div>
        </Reveal>
      </section>

      {/* ── About ── */}
      <section className="lp-section">
        <Reveal>
          <div className="lp-about">
            <div>
              <span className="lp-kicker">About</span>
              <h2 className="lp-h2">Building ideas from the Rock.</h2>
              <p>
                I&apos;m a developer, student and founder based in St. John&apos;s, Newfoundland. I build things
                because I genuinely love it — a restaurant platform, a community hiking site, or my own tools.
                I care about execution and the details people feel but never notice.
              </p>
              <p>
                Off the keyboard I founded St. John&apos;s Hike Club and make music as <strong>scotty.3xe</strong>.
                The best software is invisible — it just works.
              </p>
              <div className="lp-socials">
                <a href="https://github.com/scotty3xe" target="_blank" rel="noreferrer" className="pill pill-ghost"><i className="fa-brands fa-github" /> GitHub</a>
                <a href="https://linkedin.com/in/scottadams" target="_blank" rel="noreferrer" className="pill pill-ghost"><i className="fa-brands fa-linkedin-in" /> LinkedIn</a>
              </div>
            </div>
            <div>
              <span className="lp-kicker">Toolkit</span>
              <h2 className="lp-h2" style={{ fontSize: "clamp(1.6rem,4vw,2.2rem)" }}>What I work with</h2>
              <div className="lp-skills">
                {SKILLS.map((s) => <span className="lp-skill" key={s}>{s}</span>)}
              </div>
            </div>
          </div>
        </Reveal>
      </section>

      {/* ── Music ── */}
      <div className="lp-music-wrap">
        <Reveal>
          <section className="lp-music">
            <span className="lp-kicker">Music</span>
            <h2 className="lp-h2">SCOTTY 3XE</h2>
            <p className="lp-music-sub">The artistic side — sharp lyricism, concept-driven storytelling and sonic experimentation. Always with purpose.</p>
            <div className="lp-music-cta">
              <a href="https://open.spotify.com/artist/2cLUqlaPtqUPBAMn5gdRbe" target="_blank" rel="noreferrer" className="pill pill-dark" style={{ background: "#1DB954", color: "#04210f" }}><i className="fa-brands fa-spotify" /> Spotify</a>
              <a href="https://music.apple.com/us/artist/scotty-3xe/1822133331" target="_blank" rel="noreferrer" className="pill pill-ghost"><i className="fa-brands fa-apple" /> Apple Music</a>
            </div>
          </section>
        </Reveal>
      </div>

      {/* ── Contact ── */}
      <section className="lp-section lp-contact">
        <Reveal>
          <span className="lp-kicker">Contact</span>
          <h2 className="lp-h2">Let&apos;s build<br />something good.</h2>
          <p className="lp-contact-sub">A project, a collab, or just a conversation — my inbox is open.</p>
          <a href="mailto:scottadamsx@gmail.com" className="pill pill-dark"><i className="fa-solid fa-paper-plane" /> scottadamsx@gmail.com</a>
        </Reveal>
      </section>
    </div>
  );
}
