import { useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import "../styles/public.css";

/* The public 404 — same terminal look as /guide and /sjhc. */
export default function NotFoundPage() {
  const { pathname } = useLocation();
  useEffect(() => {
    const prev = document.title;
    document.title = "Page not found — heyScottyBro";
    return () => { document.title = prev; };
  }, []);

  return (
    <main className="lp pub-404" id="main" tabIndex={-1}>
      <header className="lp-subhero">
        <span className="lp-kicker">exit 404</span>
        <h1 className="lp-subhero-title">404 · <em>page not found</em></h1>
        <div className="pub-404-term" role="presentation">
          <span className="pub-404-prompt">$</span> cd <span className="pub-404-path">{pathname}</span>
          <br />
          <span className="pub-404-err">no such file or directory</span>
        </div>
        <p className="lp-subhero-sub">
          That link is broken, moved, or never existed. Nothing&apos;s wrong on your end — here are a few
          good places to pick up from.
        </p>
        <nav className="lp-subhero-cta" aria-label="Where to go next">
          <Link to="/" className="pill pill-dark"><i className="fa-solid fa-house" aria-hidden="true" /> home</Link>
          <Link to="/guide" className="pill pill-ghost"><i className="fa-solid fa-book" aria-hidden="true" /> read the guide</Link>
          <Link to="/admin/login" className="pill pill-ghost"><i className="fa-solid fa-lock" aria-hidden="true" /> sign in</Link>
        </nav>
      </header>
    </main>
  );
}
