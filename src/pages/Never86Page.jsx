import { Link } from "react-router-dom";

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
    <main className="project-page">
      <div className="container">
        {/* Header */}
        <div className="project-page-hero">
          <div className="section-label" style={{ justifyContent: "center" }}>Live Product</div>
          <h1 className="section-title" style={{ fontSize: "clamp(2.5rem, 6vw, 4rem)", textAlign: "center" }}>
            <span style={{ color: "var(--red)" }}>NEVER</span>
            <span style={{ color: "var(--text-primary)" }}>86</span>
          </h1>
          <p className="section-desc" style={{ textAlign: "center", margin: "1rem auto 2rem" }}>
            A restaurant management platform built for independents who are tired of being
            boxed in by cookie-cutter POS tools. Built for the floor, not the boardroom.
          </p>
          <div style={{ display: "flex", gap: "1rem", justifyContent: "center", flexWrap: "wrap" }}>
            <a href="https://never86.ca" target="_blank" rel="noreferrer" className="btn-primary">
              <i className="fa-solid fa-arrow-up-right-from-square" /> Visit never86.ca
            </a>
            <Link to="/" className="btn-secondary">
              <i className="fa-solid fa-arrow-left" /> Back to Home
            </Link>
          </div>
        </div>

        {/* Hero image */}
        <div className="project-page-img">
          <img src="/images/never86_website_concept.png" alt="NEVER86 dashboard" />
        </div>

        {/* About */}
        <div style={{ maxWidth: "740px", margin: "3.5rem auto 0", textAlign: "center" }}>
          <div className="section-label" style={{ justifyContent: "center" }}>The Problem</div>
          <h2 className="section-title">Restaurants deserve better tools</h2>
          <p style={{ color: "var(--text-secondary)", lineHeight: "1.8", marginBottom: "1.25rem" }}>
            Most restaurant software was built in boardrooms by people who&apos;ve never worked a
            Saturday dinner rush. NEVER86 is different. Every feature was designed with real
            input from the people who actually use it: servers, cooks, and managers.
          </p>
          <p style={{ color: "var(--text-secondary)", lineHeight: "1.8" }}>
            The name comes from &ldquo;86&rdquo; — restaurant slang for when you&apos;re out of something.
            We built this so operators never have to 86 efficiency, communication, or profit again.
          </p>
        </div>

        {/* Features */}
        <div style={{ margin: "4rem 0" }}>
          <div className="section-label" style={{ justifyContent: "center", marginBottom: "0.875rem" }}>Features</div>
          <h2 className="section-title" style={{ textAlign: "center", marginBottom: "2rem" }}>Built for the floor</h2>
          <div className="feature-grid">
            {FEATURES.map((f) => (
              <div className="feature-item glass-card" key={f.title}>
                <div className="feature-item-icon">{f.icon}</div>
                <div className="feature-item-title">{f.title}</div>
                <div className="feature-item-desc">{f.desc}</div>
              </div>
            ))}
          </div>
        </div>

        {/* CTA */}
        <div style={{
          textAlign: "center",
          padding: "3rem",
          background: "linear-gradient(135deg, rgba(244,67,54,0.08) 0%, rgba(99,102,241,0.08) 100%)",
          borderRadius: "var(--radius-xl)",
          border: "1px solid var(--border-subtle)",
          margin: "2rem 0"
        }}>
          <h3 style={{ fontSize: "1.5rem", fontWeight: "800", marginBottom: "0.75rem" }}>Ready to see it in action?</h3>
          <p style={{ color: "var(--text-secondary)", marginBottom: "1.5rem" }}>
            Head over to never86.ca to learn more and get in touch.
          </p>
          <a href="https://never86.ca" target="_blank" rel="noreferrer" className="btn-primary">
            <i className="fa-solid fa-arrow-up-right-from-square" /> Open never86.ca
          </a>
        </div>
      </div>
    </main>
  );
}
