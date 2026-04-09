import { Link } from "react-router-dom";

const FEATURES = [
  { icon: "🥾", title: "Group Hikes", desc: "Weekly organized hikes across Newfoundland's most stunning trails." },
  { icon: "🌿", title: "Local Community", desc: "Real people, real connections, real adventures in St. John's." },
  { icon: "👕", title: "Exclusive Merch", desc: "Custom-designed activewear and accessories for members." },
  { icon: "🤝", title: "Local Partnerships", desc: "Collaborating with local businesses to support the community." },
  { icon: "📸", title: "Adventure Content", desc: "Photos, stories, and memories from every trail we conquer." },
  { icon: "🌊", title: "Coastal Exploration", desc: "Discover the wild, rugged coastlines of the Avalon Peninsula." },
];

export default function SJHCPage() {
  return (
    <main className="project-page">
      <div className="container">
        {/* Header */}
        <div className="project-page-hero">
          <div className="section-label" style={{ justifyContent: "center" }}>Live Community</div>
          <h1 className="section-title" style={{ fontSize: "clamp(2rem, 5vw, 3.5rem)", textAlign: "center" }}>
            St. John&apos;s Hike Club
          </h1>
          <p className="section-desc" style={{ textAlign: "center", margin: "1rem auto 2rem" }}>
            More than a walking group — it&apos;s a community movement. We explore Newfoundland&apos;s
            most stunning trails, host group hikes, design exclusive merch, and partner with
            local businesses to promote adventure, connection, and well-being.
          </p>
          <div style={{ display: "flex", gap: "1rem", justifyContent: "center", flexWrap: "wrap" }}>
            <a href="https://stjohnshikeclub.com" target="_blank" rel="noreferrer" className="btn-primary" style={{ background: "linear-gradient(135deg, #4caf50, #2e7d32)" }}>
              <i className="fa-solid fa-arrow-up-right-from-square" /> Visit stjohnshikeclub.com
            </a>
            <Link to="/" className="btn-secondary">
              <i className="fa-solid fa-arrow-left" /> Back to Home
            </Link>
          </div>
        </div>

        {/* Photo grid */}
        <div className="photo-grid">
          <img src="/images/hike4.1.JPG" alt="Group hike" />
          <img src="/images/exec_team1.JPG" alt="Executive team" />
          <img src="/images/sponsors1.JPG" alt="Sponsors" />
          <img src="/images/kaleb_claire.JPG" alt="Hikers" />
        </div>

        {/* About */}
        <div style={{ maxWidth: "740px", margin: "3.5rem auto 0", textAlign: "center" }}>
          <div className="section-label" style={{ justifyContent: "center" }}>The Story</div>
          <h2 className="section-title">Come for the views,<br />stay for the vibe</h2>
          <p style={{ color: "var(--text-secondary)", lineHeight: "1.8", marginBottom: "1.25rem" }}>
            St. John&apos;s Hike Club started with a simple idea: get people outside. Newfoundland
            is one of the most breathtaking places on earth, and most locals haven&apos;t even
            scratched the surface of what&apos;s in their own backyard.
          </p>
          <p style={{ color: "var(--text-secondary)", lineHeight: "1.8" }}>
            We organize group hikes, design merch that people actually want to wear, partner
            with local businesses, and build a community around something we all love — the outdoors.
          </p>
        </div>

        {/* Features */}
        <div style={{ margin: "4rem 0" }}>
          <div className="section-label" style={{ justifyContent: "center", marginBottom: "0.875rem" }}>What We Do</div>
          <h2 className="section-title" style={{ textAlign: "center", marginBottom: "2rem" }}>More than a hike</h2>
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

        {/* More photos */}
        <div className="photo-grid" style={{ gridTemplateColumns: "repeat(2, 1fr)" }}>
          <img src="/images/forks2.jpg" alt="Trail" style={{ height: "260px" }} />
          <img src="/images/hikeclub.JPG" alt="Hike Club" style={{ height: "260px" }} />
        </div>

        {/* CTA */}
        <div style={{
          textAlign: "center",
          padding: "3rem",
          background: "linear-gradient(135deg, rgba(76,175,80,0.08) 0%, rgba(34,211,238,0.06) 100%)",
          borderRadius: "var(--radius-xl)",
          border: "1px solid rgba(76,175,80,0.2)",
          margin: "3rem 0"
        }}>
          <h3 style={{ fontSize: "1.5rem", fontWeight: "800", marginBottom: "0.75rem" }}>
            Ready to hit the trails?
          </h3>
          <p style={{ color: "var(--text-secondary)", marginBottom: "1.5rem" }}>
            Visit the full SJHC site to join hikes, see our schedule, and get in touch.
          </p>
          <a href="https://stjohnshikeclub.com" target="_blank" rel="noreferrer" className="btn-primary" style={{ background: "linear-gradient(135deg, #4caf50, #2e7d32)" }}>
            <i className="fa-solid fa-arrow-up-right-from-square" /> Open stjohnshikeclub.com
          </a>
        </div>
      </div>
    </main>
  );
}
