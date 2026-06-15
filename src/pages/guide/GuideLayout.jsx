import { useEffect } from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import { ScrollProgress } from "../../components/Reveal";
import { STEPS } from "./steps";
import GuideBottomNav from "./GuideBottomNav";

export default function GuideLayout() {
  const { pathname } = useLocation();

  // Jump to top whenever you switch sub-pages.
  useEffect(() => { window.scrollTo({ top: 0 }); }, [pathname]);

  return (
    <div className="lp">
      <ScrollProgress />

      <header className="lp-subhero">
        <span className="lp-kicker">cat vibrant-software.md</span>
        <h1 className="lp-subhero-title">Scotty&apos;s Guide to<br /><em>Vibrant Software</em></h1>
        <p className="lp-subhero-sub">
          A plain-English guide to how I turn an idea into real, working software — planned carefully
          with you in the loop the whole way, so it&apos;s seamless the first time.
        </p>
        <div className="lp-subhero-cta">
          <Link to="/" className="pill pill-ghost"><i className="fa-solid fa-arrow-left" /> back home</Link>
        </div>
      </header>

      <section className="lp-section" style={{ paddingTop: "1rem" }}>
        <div className="lp-guide-layout">
          <nav className="lp-guide-toc" aria-label="Guide pages">
            <span className="lp-guide-toc-title">Pages</span>
            <NavLink to="/guide" end>Get started</NavLink>
            <NavLink to="/guide/setup">Set up accounts</NavLink>

            <span className="lp-guide-toc-title" style={{ marginTop: "0.9rem" }}>The steps</span>
            {STEPS.map((s) => (
              <NavLink key={s.slug} to={`/guide/step/${s.slug}`}>
                <span className="lp-guide-toc-num">{s.num}</span> {s.title}
              </NavLink>
            ))}

            <span className="lp-guide-toc-title" style={{ marginTop: "0.9rem" }}>More</span>
            <NavLink to="/guide/toolkit">The toolkit</NavLink>
            <NavLink to="/guide/help">Help &amp; FAQ</NavLink>
          </nav>

          <div className="lp-guide-body">
            <Outlet />
          </div>
        </div>
      </section>

      <GuideBottomNav />
    </div>
  );
}
