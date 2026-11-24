import { useEffect, useState } from "react";

/* Thin top scroll-progress bar — shared by the long public pages (guide, sjhc,
 * never86, games). Decorative (aria-hidden): the scrollbar already tells
 * assistive tech where you are. Drawn with transform so it never reflows; the
 * easing is dropped under prefers-reduced-motion (home.css). Empty when the
 * page doesn't scroll. */
export function ScrollProgress() {
  const [p, setP] = useState(0);
  useEffect(() => {
    let frame = 0;
    const measure = () => {
      frame = 0;
      const h = document.documentElement;
      const max = h.scrollHeight - h.clientHeight;
      setP(max > 0 ? Math.min(1, Math.max(0, h.scrollTop / max)) : 0);
    };
    const onScroll = () => { if (!frame) frame = requestAnimationFrame(measure); };
    measure();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);
  return <div className="scroll-progress" aria-hidden="true" style={{ transform: `scaleX(${p})` }} />;
}

/* Static wrapper (was a scroll-reveal; sections no longer fade in on scroll). */
export function Reveal({ children, className = "" }) {
  return <div className={className}>{children}</div>;
}
