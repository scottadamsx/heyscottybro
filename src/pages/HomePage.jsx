import { useRef } from "react";
import { Link } from "react-router-dom";

const PROJECTS = [
  {
    id: "never86",
    tag: "live",
    tagLabel: "Live Product",
    title: "NEVER86",
    desc: "A restaurant management platform built for independents — putting communication, customization, and efficiency front and center.",
    emoji: "🍽️",
    img: "/images/never86_website_concept.png",
    primary: { label: "Visit Site", href: "https://never86.ca", external: true },
    secondary: { label: "Learn More", to: "/never86" },
  },
  {
    id: "sjhc",
    tag: "live",
    tagLabel: "Live Community",
    title: "St. John's Hike Club",
    desc: "More than a walking group — a community movement exploring Newfoundland's most stunning trails.",
    emoji: "🥾",
    img: "/images/hikeclub.JPG",
    primary: { label: "Visit Site", href: "https://stjohnshikeclub.com", external: true },
    secondary: { label: "Learn More", to: "/sjhc" },
  },
  {
    id: "minecraft-trivia",
    tag: "game",
    tagLabel: "Game",
    title: "Minecraft Trivia",
    desc: "How well do you know the world of Minecraft? Test your knowledge across blocks, mobs, biomes and more.",
    emoji: "⛏️",
    primary: { label: "Play Now", to: "/games/minecraft-trivia" },
    secondary: { label: "All Games", to: "/games" },
  },
  {
    id: "monopoly",
    tag: "game",
    tagLabel: "Game",
    title: "Monopoly Banker",
    desc: "The digital Monopoly bank. No more paper money, no more arguments. Clean, fast, fun.",
    emoji: "🎩",
    primary: { label: "Play Now", to: "/games/monopoly-banker" },
    secondary: { label: "All Games", to: "/games" },
  },
  {
    id: "tictactoe",
    tag: "game",
    tagLabel: "Game",
    title: "Tic-Tac-Toe",
    desc: "Classic Tic-Tac-Toe with score tracking. Challenge a friend or just kill time between deploys.",
    emoji: "⭕",
    primary: { label: "Play Now", to: "/games/tictactoe" },
    secondary: { label: "All Games", to: "/games" },
  },
  {
    id: "planner",
    tag: "admin",
    tagLabel: "Admin Tool",
    title: "Personal Planner",
    desc: "My all-in-one personal CRM — reminders, calendar, journal, and budget. Password protected.",
    emoji: "📋",
    primary: { label: "Open Planner", to: "/admin/login" },
  },
];

const SKILLS = [
  { icon: "🐍", name: "Python" },
  { icon: "⚛️", name: "React" },
  { icon: "🟨", name: "JavaScript" },
  { icon: "🎨", name: "CSS / HTML" },
  { icon: "🐘", name: "PostgreSQL" },
  { icon: "⚡", name: "Supabase" },
  { icon: "🌿", name: "Flask" },
  { icon: "📦", name: "Git / GitHub" },
  { icon: "🐦", name: "TypeScript" },
  { icon: "🎮", name: "Godot" },
];

export default function HomePage() {
  const carouselRef = useRef(null);

  const scrollCarousel = (dir) => {
    if (!carouselRef.current) return;
    carouselRef.current.scrollBy({ left: dir * 340, behavior: "smooth" });
  };

  // Drag-to-scroll
  let isDown = false, startX = 0, scrollLeft = 0;
  const onMouseDown = (e) => {
    isDown = true;
    carouselRef.current.classList.add("active");
    startX = e.pageX - carouselRef.current.offsetLeft;
    scrollLeft = carouselRef.current.scrollLeft;
  };
  const onMouseLeave = () => { isDown = false; };
  const onMouseUp = () => { isDown = false; };
  const onMouseMove = (e) => {
    if (!isDown) return;
    e.preventDefault();
    const x = e.pageX - carouselRef.current.offsetLeft;
    carouselRef.current.scrollLeft = scrollLeft - (x - startX) * 1.5;
  };

  return (
    <main>
      {/* ── Hero ───────────────────────────────────── */}
      <section className="hero">
        <div className="hero-bg" />
        <div className="hero-glow-1" />
        <div className="hero-glow-2" />
        <div className="hero-grid-overlay" />

        <div className="container">
          <div className="hero-content">
            <div className="hero-text">
              <div className="hero-badge">
                St. John&apos;s, NL · Open to opportunities
              </div>

              <h1 className="hero-title">
                Hi, I&apos;m{" "}
                <span className="gradient-text">Scott Adams</span>
              </h1>

              <p className="hero-subtitle">
                Junior software developer, student &amp; founder.
                I build systems that make life smoother — from restaurant platforms
                to hiking communities to tools I actually use every day.
              </p>

              <div className="hero-actions">
                <a href="#projects" className="btn-primary">
                  <i className="fa-solid fa-rocket" /> See My Work
                </a>
                <a href="mailto:scottadamsx@gmail.com" className="btn-secondary">
                  <i className="fa-solid fa-envelope" /> Get In Touch
                </a>
              </div>

              <div className="hero-stats">
                <div>
                  <div className="hero-stat-value">2+</div>
                  <div className="hero-stat-label">Live Products</div>
                </div>
                <div>
                  <div className="hero-stat-value">6+</div>
                  <div className="hero-stat-label">Projects Built</div>
                </div>
                <div>
                  <div className="hero-stat-value">∞</div>
                  <div className="hero-stat-label">Ideas Brewing</div>
                </div>
              </div>
            </div>

            <div className="hero-photo">
              <div className="hero-photo-frame">
                <img src="/images/scott_headshot.JPEG" alt="Scott Adams" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Projects Carousel ──────────────────────── */}
      <section className="projects-section" id="projects">
        <div className="container">
          <div className="section-label">Portfolio</div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: "1rem", marginBottom: "2rem" }}>
            <div>
              <h2 className="section-title">Things I&apos;ve Built</h2>
              <p className="section-desc">
                From live products to personal tools — here&apos;s what I&apos;ve been working on.
              </p>
            </div>
            <div style={{ display: "flex", gap: "0.625rem" }}>
              <button onClick={() => scrollCarousel(-1)} className="btn-secondary" style={{ padding: "0.5rem 0.875rem" }} aria-label="Scroll left">
                <i className="fa-solid fa-chevron-left" />
              </button>
              <button onClick={() => scrollCarousel(1)} className="btn-secondary" style={{ padding: "0.5rem 0.875rem" }} aria-label="Scroll right">
                <i className="fa-solid fa-chevron-right" />
              </button>
            </div>
          </div>

          <div
            className="carousel-track"
            ref={carouselRef}
            onMouseDown={onMouseDown}
            onMouseLeave={onMouseLeave}
            onMouseUp={onMouseUp}
            onMouseMove={onMouseMove}
          >
            {PROJECTS.map((p) => (
              <div className="project-card" key={p.id}>
                <div className="project-card-img">
                  {p.img ? (
                    <img src={p.img} alt={p.title} />
                  ) : (
                    <div className="project-card-img-placeholder">{p.emoji}</div>
                  )}
                </div>
                <div className="project-card-body">
                  <div className={`project-card-tag tag-${p.tag}`}>{p.tagLabel}</div>
                  <div className="project-card-title">{p.title}</div>
                  <div className="project-card-desc">{p.desc}</div>
                  <div className="project-card-actions">
                    {p.primary.external ? (
                      <a href={p.primary.href} target="_blank" rel="noreferrer" className="card-btn-primary">
                        {p.primary.label}
                      </a>
                    ) : (
                      <Link to={p.primary.to} className="card-btn-primary">
                        {p.primary.label}
                      </Link>
                    )}
                    {p.secondary && (
                      p.secondary.href ? (
                        <a href={p.secondary.href} target="_blank" rel="noreferrer" className="card-btn-secondary">
                          {p.secondary.label}
                        </a>
                      ) : (
                        <Link to={p.secondary.to} className="card-btn-secondary">
                          {p.secondary.label}
                        </Link>
                      )
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── About + Skills ─────────────────────────── */}
      <section className="about-section section-gap">
        <div className="container">
          <div className="about-grid">
            <div>
              <div className="section-label">About Me</div>
              <h2 className="section-title">Building ideas<br />from the Rock</h2>
              <p style={{ color: "var(--text-secondary)", lineHeight: "1.75", marginBottom: "1.25rem" }}>
                I&apos;m Scott — a junior software developer, student, and founder based in
                St. John&apos;s, Newfoundland. I build things because I genuinely love it.
                Whether it&apos;s a restaurant platform, a community hiking site, or my own
                personal tools — I care about execution.
              </p>
              <p style={{ color: "var(--text-secondary)", lineHeight: "1.75", marginBottom: "1.75rem" }}>
                Outside of code, I&apos;m the founder of St. John&apos;s Hike Club, a solo artist
                (scotty.3xe), and someone who believes the best software is invisible —
                it just works.
              </p>
              <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap" }}>
                <a href="https://github.com/scotty3xe" target="_blank" rel="noreferrer" className="btn-secondary">
                  <i className="fa-brands fa-github" /> GitHub
                </a>
                <a href="https://linkedin.com/in/scottadams" target="_blank" rel="noreferrer" className="btn-secondary">
                  <i className="fa-brands fa-linkedin-in" /> LinkedIn
                </a>
              </div>
            </div>

            <div>
              <div className="section-label">Skills</div>
              <h2 className="section-title">What I work with</h2>
              <div className="skills-grid">
                {SKILLS.map((s) => (
                  <div className="skill-item" key={s.name}>
                    <span className="skill-icon">{s.icon}</span>
                    <span>{s.name}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Music CTA ──────────────────────────────── */}
      <section style={{ padding: "5rem 0", background: "linear-gradient(135deg, rgba(99,102,241,0.06) 0%, rgba(34,211,238,0.04) 100%)" }}>
        <div className="container" style={{ textAlign: "center", maxWidth: "700px", margin: "0 auto" }}>
          <div className="section-label" style={{ justifyContent: "center" }}>Music</div>
          <h2 className="section-title">SCOTTY 3XE</h2>
          <p style={{ color: "var(--text-secondary)", lineHeight: "1.75", marginBottom: "2rem" }}>
            The artistic side. Sharp lyricism, concept-driven storytelling, and sonic
            experimentation. Solo and collab — always with purpose.
          </p>
          <div style={{ display: "flex", gap: "1rem", justifyContent: "center", flexWrap: "wrap" }}>
            <a
              href="https://open.spotify.com/artist/2cLUqlaPtqUPBAMn5gdRbe"
              target="_blank"
              rel="noreferrer"
              className="btn-primary"
            >
              <i className="fa-brands fa-spotify" /> Listen on Spotify
            </a>
            <a
              href="https://music.apple.com/us/artist/scotty-3xe/1822133331"
              target="_blank"
              rel="noreferrer"
              className="btn-secondary"
            >
              <i className="fa-brands fa-apple" /> Apple Music
            </a>
          </div>
        </div>
      </section>

      {/* ── Contact CTA ────────────────────────────── */}
      <section style={{ padding: "5rem 0" }}>
        <div className="container" style={{ textAlign: "center", maxWidth: "650px", margin: "0 auto" }}>
          <div className="section-label" style={{ justifyContent: "center" }}>Contact</div>
          <h2 className="section-title">Let&apos;s build something</h2>
          <p style={{ color: "var(--text-secondary)", lineHeight: "1.75", marginBottom: "2rem" }}>
            Whether it&apos;s a project, a collab, or just a conversation — my inbox is open.
          </p>
          <a href="mailto:scottadamsx@gmail.com" className="btn-primary" style={{ fontSize: "1rem", padding: "0.875rem 2rem" }}>
            <i className="fa-solid fa-paper-plane" /> scottadamsx@gmail.com
          </a>
        </div>
      </section>
    </main>
  );
}
