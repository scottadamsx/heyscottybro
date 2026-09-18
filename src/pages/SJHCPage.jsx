import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ease } from "../lib/motion";
import { ScrollProgress, Reveal } from "../components/Reveal";

const FEATURES = [
  { icon: "fa-person-hiking", title: "Group Hikes", desc: "Weekly organized hikes across Newfoundland's most stunning trails." },
  { icon: "fa-leaf", title: "Local Community", desc: "Real people, real connections, real adventures in St. John's." },
  { icon: "fa-shirt", title: "Exclusive Merch", desc: "Custom-designed activewear and accessories for members." },
  { icon: "fa-handshake", title: "Local Partnerships", desc: "Collaborating with local businesses to support the community." },
  { icon: "fa-camera", title: "Adventure Content", desc: "Photos, stories, and memories from every trail we conquer." },
  { icon: "fa-water", title: "Coastal Exploration", desc: "Discover the wild, rugged coastlines of the Avalon Peninsula." },
];

// width/height = the files' real pixel size, so the browser reserves the box
// before the image arrives (CSS sets the displayed size: .lp-photos img).
const PHOTOS = [
  { src: "/images/hike4.1.JPG", alt: "Group hike", w: 1200, h: 800 },
  { src: "/images/exec_team1.JPG", alt: "Executive team", w: 800, h: 1200 },
  { src: "/images/sponsors1.JPG", alt: "Sponsors", w: 1200, h: 800 },
  { src: "/images/kaleb_claire.JPG", alt: "Hikers", w: 800, h: 1200 },
];

/* Only what the public pages already say about the club (this page, the home
   page's Hike Club window, stjohnshikeclub.com links) — nothing invented. */
const FAQ = [
  ["How do I join a hike?", "Hikes, the schedule and sign-ups all live on stjohnshikeclub.com — that's the place to see what's coming up and get in touch with the club."],
  ["Does it cost anything?", "The 2026 season is 18 free group hikes, backed by local sponsors like Quidi Vidi and The Oat Company. For anything beyond the group hikes (like merch), check stjohnshikeclub.com."],
  ["Who runs the club?", "St. John's Hike Club is a community non-profit founded by Scott Adams, run with an executive team and supported by local business partners."],
  ["Where do the hikes go?", "Trails around St. John's and across Newfoundland — including the rugged coastline of the Avalon Peninsula."],
  ["How big is it?", "More than 4,400 people follow the club on Instagram, and group hikes regularly draw 80+ people."],
];

export default function SJHCPage() {
  return (
    <main className="lp" id="main" tabIndex={-1}>
      <ScrollProgress />

      {/* Hero */}
      <header className="lp-subhero">
        <span className="lp-kicker">cat hike-club/README</span>
        <h1 className="lp-subhero-title">St. John&apos;s <em>Hike Club</em></h1>
        <p className="lp-subhero-sub">
          More than a walking group — it&apos;s a community movement. We explore Newfoundland&apos;s
          most stunning trails, host group hikes, design exclusive merch, and partner with
          local businesses to promote adventure, connection, and well-being.
        </p>
        <div className="lp-subhero-cta">
          <a href="https://stjohnshikeclub.com" target="_blank" rel="noreferrer" className="pill pill-dark">
            visit stjohnshikeclub.com <i className="fa-solid fa-arrow-up-right-from-square" />
          </a>
          <Link to="/" className="pill pill-ghost"><i className="fa-solid fa-arrow-left" /> back home</Link>
        </div>
      </header>

      {/* Photo grid */}
      <section className="lp-section" style={{ paddingTop: 0 }}>
        <div className="lp-photos">
          {/* First row sits in the opening viewport: load it straight away. */}
          {PHOTOS.map((p, i) => (
            <motion.img key={p.src} src={p.src} alt={p.alt} width={p.w} height={p.h} decoding="async"
              loading={i < 2 ? "eager" : "lazy"} fetchpriority={i === 0 ? "high" : undefined}
              // The opening row is the page's largest paint: show it at once instead of fading in.
              initial={i < 2 ? false : { opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.2 }} transition={{ duration: 0.5, ease: ease.out, delay: i * 0.06 }} />
          ))}
        </div>
      </section>

      {/* About */}
      <section className="lp-section" style={{ paddingTop: 0 }}>
        <Reveal>
          <div style={{ maxWidth: "62ch" }}>
            <span className="lp-kicker">the story</span>
            <h2 className="lp-h2">Come for the views,<br />stay for the vibe</h2>
            <p className="lp-section-sub" style={{ marginTop: "1rem" }}>
              St. John&apos;s Hike Club started with a simple idea: get people outside. Newfoundland
              is one of the most breathtaking places on earth, and most locals haven&apos;t even
              scratched the surface of what&apos;s in their own backyard.
            </p>
            <p className="lp-section-sub" style={{ marginTop: "1rem" }}>
              We organize group hikes, design merch that people actually want to wear, partner
              with local businesses, and build a community around something we all love — the outdoors.
            </p>
          </div>
        </Reveal>
      </section>

      {/* Features */}
      <section className="lp-section" style={{ paddingTop: 0 }}>
        <Reveal>
          <span className="lp-kicker">what-we-do --list</span>
          <h2 className="lp-h2">More than a hike</h2>
        </Reveal>
        <div className="lp-feature-grid">
          {FEATURES.map((f, i) => (
            <motion.div className="lp-feature" key={f.title}
              initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.2 }} transition={{ duration: 0.45, ease: ease.out, delay: (i % 3) * 0.06 }}>
              <div className="lp-feature-icon"><i className={`fa-solid ${f.icon}`} aria-hidden="true" /></div>
              <div className="lp-feature-title">{f.title}</div>
              <div className="lp-feature-desc">{f.desc}</div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* More photos */}
      <section className="lp-section" style={{ paddingTop: 0 }}>
        <div className="lp-photos" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(min(320px, 100%), 1fr))" }}>
          <motion.img src="/images/hikeclub.JPG" alt="Hike Club" width={1200} height={800} loading="lazy" decoding="async" style={{ height: 300 }}
            initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: 0.2 }} transition={{ duration: 0.5, ease: ease.out }} />
        </div>
      </section>

      {/* FAQ */}
      <section className="lp-section" style={{ paddingTop: 0 }} aria-labelledby="sjhc-faq">
        <Reveal>
          <span className="lp-kicker">faq --short</span>
          <h2 className="lp-h2" id="sjhc-faq">Common questions</h2>
          <div className="lp-faq pub-faq-narrow">
            {FAQ.map(([q, a]) => (
              <details key={q}>
                <summary>{q}</summary>
                <p>{a}</p>
              </details>
            ))}
          </div>
        </Reveal>
      </section>

      {/* CTA */}
      <section className="lp-section" style={{ paddingTop: 0 }}>
        <Reveal>
          <div className="lp-cta-box">
            <h3>Ready to hit the trails?</h3>
            <p>Visit the full SJHC site to join hikes, see our schedule, and get in touch.</p>
            <a href="https://stjohnshikeclub.com" target="_blank" rel="noreferrer" className="pill pill-dark">
              open stjohnshikeclub.com <i className="fa-solid fa-arrow-up-right-from-square" />
            </a>
          </div>
        </Reveal>
      </section>
    </main>
  );
}
