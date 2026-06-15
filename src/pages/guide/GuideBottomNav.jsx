import { useEffect, useState } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import { GUIDE_NAV } from "./guideNav";

/* Mobile-only floating bottom nav: Prev · Contents · Next.
   "Contents" opens a slide-up sheet listing every guide page. */
export default function GuideBottomNav() {
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);

  // Close the sheet whenever the route changes.
  useEffect(() => { setOpen(false); }, [pathname]);

  const idx = Math.max(0, GUIDE_NAV.findIndex((p) => p.to === pathname));
  const prev = idx > 0 ? GUIDE_NAV[idx - 1] : null;
  const next = idx < GUIDE_NAV.length - 1 ? GUIDE_NAV[idx + 1] : null;

  return (
    <>
      <nav className="lp-gnav" aria-label="Guide navigation">
        {prev
          ? <Link className="lp-gnav-btn" to={prev.to}><i className="fa-solid fa-chevron-left" /> Prev</Link>
          : <span className="lp-gnav-btn disabled"><i className="fa-solid fa-chevron-left" /> Prev</span>}
        <button className="lp-gnav-btn center" onClick={() => setOpen(true)} aria-haspopup="dialog" aria-expanded={open}>
          <i className="fa-solid fa-list-ul" /> Contents
        </button>
        {next
          ? <Link className="lp-gnav-btn" to={next.to}>Next <i className="fa-solid fa-chevron-right" /></Link>
          : <span className="lp-gnav-btn disabled">Next <i className="fa-solid fa-chevron-right" /></span>}
      </nav>

      <div className={`lp-gnav-sheet${open ? " open" : ""}`} role="dialog" aria-label="Guide contents" aria-modal="true">
        <div className="lp-gnav-sheet-backdrop" onClick={() => setOpen(false)} />
        <div className="lp-gnav-sheet-panel">
          <div className="lp-gnav-sheet-grip" />
          <div className="lp-gnav-sheet-title">Guide pages</div>
          {GUIDE_NAV.map((p) => (
            <NavLink key={p.to} to={p.to} end={p.end} onClick={() => setOpen(false)}>{p.label}</NavLink>
          ))}
        </div>
      </div>
    </>
  );
}
