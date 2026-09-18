import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { ease } from "../lib/motion";

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

/* Scroll-reveal wrapper (respects reduced-motion via MotionConfig in main.jsx). */
export function Reveal({ children, className = "", delay = 0 }) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.2 }}
      transition={{ duration: 0.6, ease: ease.out, delay }}
    >
      {children}
    </motion.div>
  );
}
