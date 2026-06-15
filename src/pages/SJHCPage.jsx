import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ease } from "../lib/motion";
import { ScrollProgress, Reveal } from "../components/Reveal";

const FEATURES = [
  { icon: "🥾", title: "Group Hikes", desc: "Weekly organized hikes across Newfoundland's most stunning trails." },
  { icon: "🌿", title: "Local Community", desc: "Real people, real connections, real adventures in St. John's." },
  { icon: "👕", title: "Exclusive Merch", desc: "Custom-designed activewear and accessories for members." },
  { icon: "🤝", title: "Local Partnerships", desc: "Collaborating with local businesses to support the community." },
  { icon: "📸", title: "Adventure Content", desc: "Photos, stories, and memories from every trail we conquer." },
  { icon: "🌊", title: "Coastal Exploration", desc: "Discover the wild, rugged coastlines of the Avalon Peninsula." },
];

const PHOTOS = [
  { src: "/images/hike4.1.JPG", alt: "Group hike" },
  { src: "/images/exec_team1.JPG", alt: "Executive team" },
  { src: "/images/sponsors1.JPG", alt: "Sponsors" },
  { src: "/images/kaleb_claire.JPG", alt: "Hikers" },
];

export default function SJHCPage() {
  return (
    <div className="lp">
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
          {PHOTOS.map((p, i) => (
            <motion.img key={p.src} src={p.src} alt={p.alt} loading="lazy"
              initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }}
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
              <div className="lp-feature-icon">{f.icon}</div>
              <div className="lp-feature-title">{f.title}</div>
              <div className="lp-feature-desc">{f.desc}</div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* More photos */}
      <section className="lp-section" style={{ paddingTop: 0 }}>
        <div className="lp-photos" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(min(320px, 100%), 1fr))" }}>
          <motion.img src="/images/forks2.jpg" alt="Trail" loading="lazy" style={{ height: 300 }}
            initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: 0.2 }} transition={{ duration: 0.5, ease: ease.out }} />
          <motion.img src="/images/hikeclub.JPG" alt="Hike Club" loading="lazy" style={{ height: 300 }}
            initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: 0.2 }} transition={{ duration: 0.5, ease: ease.out, delay: 0.06 }} />
        </div>
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
    </div>
  );
}
