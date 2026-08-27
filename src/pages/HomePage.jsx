/**
 * heyscottybro.com — the public landing page as a Windows XP desktop.
 *
 * Three windows open on boot (Hike Club, Lift Club, myBackyard); every other
 * project is a desktop icon that opens its own window. The taskbar carries a
 * Start menu with the site's navigation. Styles: ./xp-desktop.css (always XP,
 * independent of the admin theme picker).
 */
import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import "./xp-desktop.css";

/* ── Featured (open on boot) ─────────────────────────────── */
const FEATURED = [
  {
    id: "sjhc",
    title: "St. John's Hike Club",
    icon: "fa-person-hiking",
    href: "https://stjohnshikeclub.com",
    img: "/images/hikeclub.JPG",
    kicker: "Community · Non-profit · Founded by Scott",
    body: [
      "More than a walking group — a community movement exploring Newfoundland's most stunning trails, together.",
      "4,400+ followers on Instagram, 80+ people showing up per hike, and an 18-hike free season in 2026 with sponsors like Quidi Vidi and The Oat Company behind it.",
    ],
    facts: [["Members", "4,400+"], ["Per hike", "80+"], ["2026 season", "18 free hikes"]],
    cta: "Visit stjohnshikeclub.com",
  },
  {
    id: "lift",
    title: "St. John's Lift Club",
    icon: "fa-dumbbell",
    href: "https://stjohnsliftclub.com",
    img: null,
    kicker: "Fitness club · Launching September 2026",
    body: [
      "The Hike Club playbook applied to the gym: bi-weekly group lifts, trainer-led sessions and a crew of local creators — built for beginners who want a reason to show up.",
      "$9.99/month membership. First meet Saturday, September 19, 2026.",
    ],
    facts: [["Membership", "$9.99 / mo"], ["First meet", "Sep 19, 2026"], ["Team", "5 execs + creators"]],
    cta: "Visit stjohnsliftclub.com",
  },
  {
    id: "mybackyard",
    title: "myBackyard — what it is",
    icon: "fa-tree",
    href: "https://mybackyard.space",
    img: null,
    kicker: "Locals-only social platform · Live in St. John's",
    body: [
      "myBackyard is a social network for one place at a time. One account for everything local: a feed for your city, events with RSVPs and paid tickets, club and business pages, friends and group chats, and a places directory.",
      "Built and owned by me. Clubs build community → members join myBackyard → local businesses follow. St. John's first, then Mount Pearl, then the rest of Newfoundland.",
    ],
    facts: [["Status", "Live"], ["Seed audience", "4,400 hikers"], ["Stack", "Next.js + Supabase"]],
    cta: "Open mybackyard.space",
  },
];

/* ── Everything else — desktop icons ─────────────────────── */
const ICONS = [
  { id: "never86", title: "NEVER86", icon: "fa-utensils", href: "https://never86.ca", tag: "Live product", desc: "A restaurant management platform built for independents — communication, customization and efficiency, front and centre.", img: "/images/never86_website_concept.png" },
  { id: "clubhouse", title: "Clubhouse", icon: "fa-store", href: "https://clubhouse-management.vercel.app", tag: "SaaS · Live", desc: "The CRM behind myBackyard — clubs and local businesses manage their members, their myBackyard page and their sales in one place." },
  { id: "kiwi-ide", title: "Kiwi IDE", icon: "fa-kiwi-bird", href: null, tag: "Flagship · Private beta", desc: "My biggest build — an AI coding IDE (a fork of VS Code) for people who build with agents. Agent, live preview, ambient code stream, and “earn while you wait”." },
  { id: "kiwi-games", title: "Kiwi Games", icon: "fa-gamepad", href: "https://scottadamsx.github.io/kiwiGames/", tag: "50 browser games", desc: "Snake, 2048, Minesweeper, solitaire, word games and more. No sign-up, no install, works offline." },
  { id: "planner", title: "heyScottyBro", icon: "fa-list-check", to: "/admin/login", tag: "Personal command centre", desc: "The app behind this site — reminders, calendar, money, school, and a fellowship of AI agents. Password protected." },
  { id: "eliquinn", title: "eliquinn.space", icon: "fa-compass-drafting", href: "https://eliquinn.space", tag: "Client site", desc: "A cinematic personal site for architecture student Eli Quinn — brutalist-minimal, intro film, pinned work gallery." },
  { id: "minecraft", title: "Minecraft Trivia", icon: "fa-cube", to: "/games/minecraft-trivia", tag: "Game", desc: "How well do you know the world of Minecraft? Blocks, mobs, biomes and more." },
  { id: "monopoly", title: "Monopoly Banker", icon: "fa-sack-dollar", to: "/games/monopoly-banker", tag: "Game", desc: "The digital Monopoly bank. No paper money, no arguments." },
  { id: "tictactoe", title: "Tic-Tac-Toe", icon: "fa-hashtag", to: "/games/tictactoe", tag: "Game", desc: "Classic Tic-Tac-Toe with score tracking." },
  { id: "music", title: "scotty.3xe", icon: "fa-music", href: "https://open.spotify.com/artist/2cLUqlaPtqUPBAMn5gdRbe", tag: "Music", desc: "The artistic side — sharp lyricism, concept-driven storytelling and sonic experimentation.", extra: [["Apple Music", "https://music.apple.com/us/artist/scotty-3xe/1822133331"]] },
  { id: "about", title: "About Scott", icon: "fa-user", tag: "about.txt", desc: "Developer, student and founder in St. John's, Newfoundland. I build things because I love it — a restaurant platform, a hiking community, a social network, and the tools I use every day. I care about execution and the details people feel but never notice.", extra: [["GitHub", "https://github.com/scotty3xe"], ["LinkedIn", "https://linkedin.com/in/scottadams"]] },
  { id: "contact", title: "Contact", icon: "fa-envelope", href: "mailto:scottadamsx@gmail.com", tag: "mail scott", desc: "A project, a collab, or just a conversation — my inbox is open. scottadamsx@gmail.com" },
];

const ALL = [...FEATURED, ...ICONS];
const byId = (id) => ALL.find((w) => w.id === id);

function Clock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => { const t = setInterval(() => setNow(new Date()), 30000); return () => clearInterval(t); }, []);
  return <span className="xpd-clock">{now.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</span>;
}

function LinkOut({ href, to, className, children }) {
  if (to) return <Link className={className} to={to}>{children}</Link>;
  if (href) return <a className={className} href={href} target={href.startsWith("mailto:") ? undefined : "_blank"} rel="noreferrer">{children}</a>;
  return null;
}

const GEOM_KEY = "xpd-geom-v1";
function readGeom() { try { return JSON.parse(localStorage.getItem(GEOM_KEY)) || {}; } catch { return {}; } }
function writeGeom(g) { try { localStorage.setItem(GEOM_KEY, JSON.stringify(g)); } catch { /* private mode */ } }
/** Cascade default: featured windows side by side, others stepped down-right. */
function defaultGeom(id, index, areaW) {
  const featuredIdx = FEATURED.findIndex((f) => f.id === id);
  const w = Math.min(380, Math.max(300, Math.floor((areaW - 40) / 3)));
  if (featuredIdx >= 0) return { x: featuredIdx * (w + 12), y: 0, w, h: null };
  return { x: 40 + (index % 6) * 28, y: 40 + (index % 6) * 28, w: 360, h: null };
}

function XpWindow({ w, active, onFocus, onClose, onMin, geom, onGeom, floating }) {
  const featured = !!w.body;
  const ref = useRef(null);
  const drag = useRef(null);

  const startDrag = (e, mode) => {
    if (!floating) return;
    if (e.button !== 0) return;
    const r = ref.current.getBoundingClientRect();
    drag.current = { mode, sx: e.clientX, sy: e.clientY, x: geom.x, y: geom.y, w: r.width, h: r.height };
    const move = (ev) => {
      const d = drag.current; if (!d) return;
      const dx = ev.clientX - d.sx, dy = ev.clientY - d.sy;
      if (d.mode === "move") onGeom({ ...geom, x: Math.max(0, d.x + dx), y: Math.max(0, d.y + dy) });
      else onGeom({ ...geom, w: Math.max(260, d.w + dx), h: Math.max(120, d.h + dy) });
    };
    const up = () => { drag.current = null; window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); };
    window.addEventListener("pointermove", move); window.addEventListener("pointerup", up);
    e.preventDefault();
  };

  const style = floating ? { left: geom.x, top: geom.y, width: geom.w, height: geom.h || undefined } : undefined;
  return (
    <section ref={ref} style={style} className={`xpd-win${active ? " active" : ""}${featured ? " featured" : ""}${floating ? " floating" : ""}`} onPointerDown={onFocus} aria-label={w.title}>
      <header className="xpd-title" onPointerDown={(e) => startDrag(e, "move")} onDoubleClick={() => floating && onGeom({ ...geom, w: 380, h: null })}>
        <i className={`fa-solid ${w.icon}`} />
        <span>{w.title}</span>
        <div className="xpd-title-btns">
          <button type="button" onClick={(e) => { e.stopPropagation(); onMin(); }} aria-label="Minimize"><i className="fa-solid fa-window-minimize" /></button>
          <button type="button" className="close" onClick={(e) => { e.stopPropagation(); onClose(); }} aria-label="Close"><i className="fa-solid fa-xmark" /></button>
        </div>
      </header>
      <div className="xpd-body">
        {floating && <span className="xpd-resize" onPointerDown={(e) => startDrag(e, "resize")} aria-hidden="true" />}
        {w.img && <img className="xpd-shot" src={w.img} alt="" loading="lazy" />}
        {w.kicker && <div className="xpd-kicker">{w.kicker}</div>}
        {w.tag && !w.kicker && <div className="xpd-kicker">{w.tag}</div>}
        {w.body ? w.body.map((p, i) => <p key={i}>{p}</p>) : <p>{w.desc}</p>}
        {w.facts && (
          <dl className="xpd-facts">
            {w.facts.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}
          </dl>
        )}
        <div className="xpd-actions">
          {(w.href || w.to) && <LinkOut href={w.href} to={w.to} className="xpd-btn primary">{w.cta || (w.to ? "Open" : "Visit site")} <i className="fa-solid fa-arrow-up-right-from-square" /></LinkOut>}
          {!w.href && !w.to && <span className="xpd-btn" aria-disabled="true">Private beta</span>}
          {w.extra?.map(([label, href]) => <a key={label} className="xpd-btn" href={href} target="_blank" rel="noreferrer">{label}</a>)}
        </div>
      </div>
    </section>
  );
}

export default function HomePage() {
  const [open, setOpen] = useState(FEATURED.map((f) => f.id)); // z-order: last = top
  const [minimized, setMinimized] = useState([]);
  const [startOpen, setStartOpen] = useState(false);
  const startRef = useRef(null);
  const areaRef = useRef(null);
  const [geoms, setGeoms] = useState(readGeom);
  const [floating, setFloating] = useState(() => typeof window !== "undefined" && window.innerWidth > 720);
  useEffect(() => {
    const onResize = () => setFloating(window.innerWidth > 720);
    window.addEventListener("resize", onResize); return () => window.removeEventListener("resize", onResize);
  }, []);
  const geomFor = (id, index) => geoms[id] || defaultGeom(id, index, areaRef.current?.clientWidth || 1000);
  const setGeom = (id, g) => setGeoms((prev) => { const next = { ...prev, [id]: g }; writeGeom(next); return next; });

  useEffect(() => {
    document.title = "heyScottyBro — Scott Adams";
    const onDoc = (e) => { if (startRef.current && !startRef.current.contains(e.target)) setStartOpen(false); };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const focus = (id) => { setOpen((o) => [...o.filter((x) => x !== id), id]); setMinimized((m) => m.filter((x) => x !== id)); };
  const close = (id) => { setOpen((o) => o.filter((x) => x !== id)); setMinimized((m) => m.filter((x) => x !== id)); };
  const minimize = (id) => setMinimized((m) => (m.includes(id) ? m : [...m, id]));
  const launch = (id) => focus(id);
  const top = open[open.length - 1];
  const visible = open.filter((id) => !minimized.includes(id));

  return (
    <div className="xpd">
      <main className="xpd-desktop">
        {/* Icons: the "side" column of every other project */}
        <nav className="xpd-icons" aria-label="Projects">
          {ICONS.map((p) => (
            <button type="button" className="xpd-icon" key={p.id} onDoubleClick={() => launch(p.id)} onClick={() => launch(p.id)} title={p.tag}>
              <span className="xpd-icon-img"><i className={`fa-solid ${p.icon}`} /></span>
              <span className="xpd-icon-label">{p.title}</span>
            </button>
          ))}
        </nav>

        {/* Windows */}
        <div className={`xpd-windows${floating ? " floating" : ""}`} ref={areaRef}>
          {visible.length === 0 && (
            <div className="xpd-empty">Nothing open. Double-click an icon, or hit <b>start</b>.</div>
          )}
          {visible.map((id) => {
            const w = byId(id);
            const index = ALL.findIndex((x) => x.id === id);
            return w && <XpWindow key={id} w={w} active={id === top} onFocus={() => focus(id)} onClose={() => close(id)} onMin={() => minimize(id)} geom={geomFor(id, index)} onGeom={(g) => setGeom(id, g)} floating={floating} />;
          })}
        </div>
      </main>

      {/* Taskbar */}
      <footer className="xpd-taskbar">
        <div className="xpd-start-wrap" ref={startRef}>
          <button type="button" className={`xpd-start${startOpen ? " open" : ""}`} onClick={() => setStartOpen((s) => !s)} aria-expanded={startOpen} aria-haspopup="menu">
            <span className="xpd-orb"><i className="fa-brands fa-windows" /></span> start
          </button>
          {startOpen && (
            <div className="xpd-startmenu" role="menu">
              <div className="xpd-sm-head"><img src="/images/scott_headshot.JPEG" alt="" /> <span>Scott Adams</span></div>
              <div className="xpd-sm-cols">
                <div className="xpd-sm-col">
                  <div className="xpd-sm-label">Featured</div>
                  {FEATURED.map((f) => <button type="button" key={f.id} role="menuitem" onClick={() => { launch(f.id); setStartOpen(false); }}><i className={`fa-solid ${f.icon}`} /> {f.title}</button>)}
                  <div className="xpd-sm-label">All projects</div>
                  {ICONS.map((p) => <button type="button" key={p.id} role="menuitem" onClick={() => { launch(p.id); setStartOpen(false); }}><i className={`fa-solid ${p.icon}`} /> {p.title}</button>)}
                </div>
                <div className="xpd-sm-col right">
                  <Link to="/never86" role="menuitem"><i className="fa-solid fa-utensils" /> NEVER86</Link>
                  <Link to="/sjhc" role="menuitem"><i className="fa-solid fa-person-hiking" /> Hike Club</Link>
                  <Link to="/games" role="menuitem"><i className="fa-solid fa-gamepad" /> Games</Link>
                  <Link to="/guide" role="menuitem"><i className="fa-solid fa-book" /> Guide</Link>
                  <a href="https://github.com/scotty3xe" target="_blank" rel="noreferrer" role="menuitem"><i className="fa-brands fa-github" /> GitHub</a>
                  <a href="https://linkedin.com/in/scottadams" target="_blank" rel="noreferrer" role="menuitem"><i className="fa-brands fa-linkedin-in" /> LinkedIn</a>
                  <a href="mailto:scottadamsx@gmail.com" role="menuitem"><i className="fa-solid fa-envelope" /> Email</a>
                  <Link to="/admin/login" role="menuitem" className="admin"><i className="fa-solid fa-lock" /> Admin</Link>
                </div>
              </div>
              <div className="xpd-sm-foot">St. John's, NL · available for work</div>
            </div>
          )}
        </div>
        <div className="xpd-tasks">
          {open.map((id) => {
            const w = byId(id);
            return w && (
              <button type="button" key={id} className={`xpd-task${id === top && !minimized.includes(id) ? " active" : ""}`} onClick={() => (minimized.includes(id) || id !== top ? focus(id) : minimize(id))}>
                <i className={`fa-solid ${w.icon}`} /> <span>{w.title}</span>
              </button>
            );
          })}
        </div>
        <div className="xpd-tray"><i className="fa-solid fa-volume-high" /><i className="fa-solid fa-wifi" /><Clock /></div>
      </footer>
    </div>
  );
}
