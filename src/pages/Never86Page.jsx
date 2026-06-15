import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ease } from "../lib/motion";
import { ScrollProgress, Reveal } from "../components/Reveal";

const FEATURES = [
  { icon: "📋", title: "Order Management", desc: "Streamlined ticket flow from table to kitchen to delivery." },
  { icon: "🗣️", title: "Staff Communication", desc: "Real-time messaging between FOH, BOH, and management." },
  { icon: "📊", title: "Analytics", desc: "Revenue, waste, and performance insights at a glance." },
  { icon: "🎛️", title: "Custom POS", desc: "Built around your menu — not the other way around." },
  { icon: "📱", title: "Mobile Ready", desc: "Works on any device, anywhere on the floor." },
  { icon: "🔗", title: "Integrations", desc: "Connects with the tools your restaurant already uses." },
];

export default function Never86Page() {
  return (
    <div className="lp">
      <ScrollProgress />

      {/* Hero */}
      <header className="lp-subhero">
        <span className="lp-kicker">cat never86/README</span>
        <h1 className="lp-subhero-title">NEVER<em>86</em></h1>
        <p className="lp-subhero-sub">
          A restaurant management platform built for independents who are tired of being
          boxed in by cookie-cutter POS tools. Built for the floor, not the boardroom.
        </p>
        <div className="lp-subhero-cta">
          <a href="https://never86.ca" target="_blank" rel="noreferrer" className="pill pill-dark">
            visit never86.ca <i className="fa-solid fa-arrow-up-right-from-square" />
          </a>
          <Link to="/" className="pill pill-ghost"><i className="fa-solid fa-arrow-left" /> back home</Link>
        </div>
      </header>

      {/* Hero image */}
      <section className="lp-section" style={{ paddingTop: 0 }}>
        <motion.div
          initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.2 }} transition={{ duration: 0.7, ease: ease.out }}
          style={{ borderRadius: "var(--t-r)", overflow: "hidden", border: "1px solid var(--t-line-br)", boxShadow: "0 40px 90px -50px #000" }}
        >
          <img src="/images/never86_website_concept.png" alt="NEVER86 dashboard" loading="lazy" style={{ width: "100%", display: "block" }} />
        </motion.div>
      </section>

      {/* About */}
      <section className="lp-section" style={{ paddingTop: 0 }}>
        <Reveal>
          <div style={{ maxWidth: "62ch" }}>
            <span className="lp-kicker">the problem</span>
            <h2 className="lp-h2">Restaurants deserve better tools</h2>
            <p className="lp-section-sub" style={{ marginTop: "1rem" }}>
              Most restaurant software was built in boardrooms by people who&apos;ve never worked a
              Saturday dinner rush. NEVER86 is different. Every feature was designed with real
              input from the people who actually use it: servers, cooks, and managers.
            </p>
            <p className="lp-section-sub" style={{ marginTop: "1rem" }}>
              The name comes from &ldquo;86&rdquo; — restaurant slang for when you&apos;re out of something.
              We built this so operators never have to 86 efficiency, communication, or profit again.
            </p>
          </div>
        </Reveal>
      </section>

      {/* Features */}
      <section className="lp-section" style={{ paddingTop: 0 }}>
        <Reveal>
          <span className="lp-kicker">features --list</span>
          <h2 className="lp-h2">Built for the floor</h2>
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

      {/* CTA */}
      <section className="lp-section" style={{ paddingTop: 0 }}>
        <Reveal>
          <div className="lp-cta-box">
            <h3>Ready to see it in action?</h3>
            <p>Head over to never86.ca to learn more and get in touch.</p>
            <a href="https://never86.ca" target="_blank" rel="noreferrer" className="pill pill-dark">
              open never86.ca <i className="fa-solid fa-arrow-up-right-from-square" />
            </a>
          </div>
        </Reveal>
      </section>
    </div>
  );
}
