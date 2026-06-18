import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { motion, useReducedMotion } from "framer-motion";
import { ease } from "../lib/motion";

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

/* Scroll-reveal wrapper (framer-motion; respects reduced-motion via MotionConfig) */
function Reveal({ children, className = "", delay = 0 }) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.2 }}
      transition={{ duration: 0.6, ease: ease.out, delay }}
    >
      {children}
    </motion.div>
  );
}

/* ── Terminal-window hero with typewriter (decorative; reduced-motion safe) ── */
const SCRIPT = [
  { type: "cmd", text: "whoami" },
  { type: "out", text: "software developer · founder · student" },
  { type: "cmd", text: "ls ~/work" },
  { type: "ok", text: "never86/      [LIVE]" },
  { type: "ok", text: "hike-club/    [LIVE]" },
  { type: "ok", text: "eliquinn/     [LIVE]" },
  { type: "dim", text: "planner/      [private]" },
  { type: "cmd", text: "cat status.txt" },
  { type: "out", text: "available for work — say hello" },
];

function renderLine(line, idx, typedLen) {
  const text = typedLen == null ? line.text : line.text.slice(0, typedLen);
  if (line.type === "cmd") {
    return (
      <div className="term-line" key={idx}>
        <span className="term-prompt">scotty@nl</span>
        <span className="term-dim">:</span>
        <span className="term-path">~</span>
        <span className="term-prompt">$ </span>
        <span>{text}</span>
      </div>
    );
  }
  const cls = line.type === "ok" ? "term-ok" : line.type === "dim" ? "term-dim" : "term-out";
  const pre = line.type === "out" ? "› " : "  ";
  return <div className={`term-line ${cls}`} key={idx}>{pre}{text}</div>;
}

function TerminalHero() {
  const reduce = useReducedMotion();
  const [li, setLi] = useState(0);
  const [ci, setCi] = useState(0);
  const done = li >= SCRIPT.length;

  useEffect(() => {
    if (reduce || done) return;
    const line = SCRIPT[li];
    if (ci < line.text.length) {
      const t = setTimeout(() => setCi((c) => c + 1), 20 + Math.random() * 32);
      return () => clearTimeout(t);
    }
    const pause = line.type === "cmd" ? 280 : 150;
    const t = setTimeout(() => { setLi((l) => l + 1); setCi(0); }, pause);
    return () => clearTimeout(t);
  }, [li, ci, reduce, done]);

  let lines;
  if (reduce || done) {
    lines = SCRIPT.map((l, i) => renderLine(l, i, null));
  } else {
    lines = [];
    for (let i = 0; i < li; i++) lines.push(renderLine(SCRIPT[i], i, null));
    lines.push(renderLine(SCRIPT[li], li, ci));
  }

  return (
    <motion.div
      className="term"
      aria-hidden="true"
      initial={{ opacity: 0, y: 18, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.7, ease: ease.out, delay: 0.15 }}
    >
      <div className="term-bar">
        <span className="term-dot r" /><span className="term-dot y" /><span className="term-dot g" />
        <span className="term-title">scotty@nl: ~</span>
      </div>
      <div className="term-body">
        {lines}
        <span className="term-cursor" />
      </div>
    </motion.div>
  );
}

const MARQUEE = ["Builder", "Founder", "React", "Python", "Supabase", "St. John's · NL", "scotty.3xe", "Restaurant tech", "Hike club", "Always shipping"];

const PROJECTS = [
  { id: "never86", tag: "Live Product", title: "NEVER86", desc: "A restaurant management platform built for independents — communication, customization and efficiency, front and centre.", icon: "fa-utensils", img: "/images/never86_website_concept.png", bg: "linear-gradient(135deg,#1a2a22,#13201a)", to: null, href: "https://never86.ca", cta: "Visit site" },
  { id: "sjhc", tag: "Live Community", title: "St. John's Hike Club", desc: "More than a walking group — a community movement exploring Newfoundland's most stunning trails.", icon: "fa-person-hiking", img: "/images/hikeclub.JPG", bg: "linear-gradient(135deg,#1a2a22,#13201a)", to: null, href: "https://stjohnshikeclub.com", cta: "Visit site" },
  { id: "eliquinn", tag: "Client Site", title: "eliquinn.space", desc: "A cinematic personal site for architecture student Eli Quinn — brutalist-minimal, with an intro film, smooth scroll and a pinned work gallery. Designed and built by me.", icon: "fa-compass-drafting", img: null, bg: "linear-gradient(135deg,#2a2622,#1b1916)", to: null, href: "https://eliquinn.space", cta: "Visit site" },
  { id: "ourfirsttwomonths", tag: "Personal Site", title: "Our First Two Months", desc: "A little web gift for my girlfriend — a scrollable keepsake celebrating our first two months together.", icon: "fa-heart", img: null, bg: "linear-gradient(135deg,#2a1620,#190e15)", to: null, href: "https://ourfirsttwomonths.vercel.app", cta: "Visit site" },
  { id: "minecraft-trivia", tag: "Game", title: "Minecraft Trivia", desc: "How well do you know the world of Minecraft? Blocks, mobs, biomes and more.", icon: "fa-cube", img: null, bg: "linear-gradient(135deg,#161a22,#11141b)", to: "/games/minecraft-trivia", href: null, cta: "Play now" },
  { id: "monopoly", tag: "Game", title: "Monopoly Banker", desc: "The digital Monopoly bank. No paper money, no arguments — clean, fast, fun.", icon: "fa-sack-dollar", img: null, bg: "linear-gradient(135deg,#1d1a14,#15120d)", to: "/games/monopoly-banker", href: null, cta: "Play now" },
  { id: "tictactoe", tag: "Game", title: "Tic-Tac-Toe", desc: "Classic Tic-Tac-Toe with score tracking. Challenge a friend between deploys.", icon: "fa-hashtag", img: null, bg: "linear-gradient(135deg,#21161a,#180f13)", to: "/games/tictactoe", href: null, cta: "Play now" },
  { id: "planner", tag: "Admin Tool", title: "Personal Planner", desc: "My all-in-one personal command centre — reminders, calendar, journal, budget. Password protected.", icon: "fa-list-check", img: null, bg: "linear-gradient(135deg,#181822,#101019)", to: "/admin/login", href: null, cta: "Open planner" },
];

const SKILLS = ["python", "react", "javascript", "typescript", "postgresql", "supabase", "flask", "css/html", "git", "godot"];

function WorkCard({ p }) {
  const inner = (
    <>
      <div className={`lp-card-media ${p.img ? "" : "ph"}`} style={p.img ? undefined : { background: p.bg }}>
        {p.img ? <img src={p.img} alt={p.title} loading="lazy" /> : <i className={`fa-solid ${p.icon}`} aria-hidden="true" />}
      </div>
      <div className="lp-card-body">
        <span className="lp-tag">{p.tag}</span>
        <h3 className="lp-card-title">{p.title}</h3>
        <p className="lp-card-desc">{p.desc}</p>
        <span className="lp-card-link">{p.cta} <i className="fa-solid fa-arrow-right" /></span>
      </div>
    </>
  );
  const cardMotion = {
    initial: { opacity: 0, y: 24 },
    whileInView: { opacity: 1, y: 0 },
    viewport: { once: true, amount: 0.2 },
    transition: { duration: 0.5, ease: ease.out },
  };
  return p.href
    ? <motion.a className="lp-card" href={p.href} target="_blank" rel="noreferrer" {...cardMotion}>{inner}</motion.a>
    : <motion.div {...cardMotion}><Link className="lp-card" to={p.to}>{inner}</Link></motion.div>;
}

/* Hero text column — staggered */
const heroContainer = { animate: { transition: { staggerChildren: 0.09, delayChildren: 0.05 } } };
const heroItem = {
  initial: { opacity: 0, y: 22 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.7, ease: ease.out } },
};

export default function HomePage() {
  return (
    <div className="lp">
      <ScrollProgress />

      {/* ── Hero ── */}
      <header className="lp-hero">
        <motion.div variants={heroContainer} initial="initial" animate="animate">
          <motion.span className="lp-eyebrow" variants={heroItem}>available for work · St. John's, NL</motion.span>
          <motion.h1 className="lp-hero-title" variants={heroItem}>
            I build software<br />people <em>love</em> to use.
          </motion.h1>
          <motion.p className="lp-hero-sub" variants={heroItem}>
            Scott Adams — junior software developer, student &amp; founder. From restaurant
            platforms to hiking communities to tools I use every day.
          </motion.p>
          <motion.div className="lp-cta" variants={heroItem}>
            <a href="#work" className="pill pill-dark">./see-my-work <i className="fa-solid fa-arrow-down" /></a>
            <a href="mailto:scottadamsx@gmail.com" className="pill pill-ghost">say hello</a>
          </motion.div>
          <motion.div className="lp-stats" variants={heroItem}>
            <div className="lp-stat"><b>2+</b><span>live products</span></div>
            <div className="lp-stat"><b>6+</b><span>projects shipped</span></div>
            <div className="lp-stat"><b>∞</b><span>ideas brewing</span></div>
          </motion.div>
        </motion.div>

        <TerminalHero />
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
          <span className="lp-kicker">ls ~/work</span>
          <h2 className="lp-h2">Things I&apos;ve built</h2>
          <p className="lp-section-sub">From live products to playful experiments — a look at what I&apos;ve been making.</p>
        </Reveal>
        <div className="lp-work-grid">
          {PROJECTS.map((p) => <WorkCard key={p.id} p={p} />)}
        </div>
      </section>

      {/* ── About ── */}
      <section className="lp-section">
        <Reveal>
          <div className="lp-about">
            <div>
              <span className="lp-kicker">cat about.md</span>
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
              <span className="lp-kicker">stack --list</span>
              <h2 className="lp-h2" style={{ fontSize: "clamp(1.5rem,4vw,2rem)" }}>What I work with</h2>
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
            <span className="lp-kicker">play scotty.3xe</span>
            <h2 className="lp-h2">SCOTTY 3XE</h2>
            <p className="lp-music-sub">The artistic side — sharp lyricism, concept-driven storytelling and sonic experimentation. Always with purpose.</p>
            <div className="lp-music-cta">
              <a href="https://open.spotify.com/artist/2cLUqlaPtqUPBAMn5gdRbe" target="_blank" rel="noreferrer" className="pill pill-dark"><i className="fa-brands fa-spotify" /> Spotify</a>
              <a href="https://music.apple.com/us/artist/scotty-3xe/1822133331" target="_blank" rel="noreferrer" className="pill pill-ghost"><i className="fa-brands fa-apple" /> Apple Music</a>
            </div>
          </section>
        </Reveal>
      </div>

      {/* ── Contact ── */}
      <section className="lp-section lp-contact">
        <Reveal>
          <span className="lp-kicker">mail scott</span>
          <h2 className="lp-h2">Let&apos;s build<br />something good.</h2>
          <p className="lp-contact-sub">A project, a collab, or just a conversation — my inbox is open.</p>
          <a href="mailto:scottadamsx@gmail.com" className="pill pill-dark"><i className="fa-solid fa-paper-plane" /> scottadamsx@gmail.com</a>
        </Reveal>
      </section>
    </div>
  );
}
