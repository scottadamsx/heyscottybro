import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { ease } from "../lib/motion";

/* Thin top scroll-progress bar — shared by all public pages. */
export function ScrollProgress() {
  const [w, setW] = useState(0);
  useEffect(() => {
    const onScroll = () => {
      const h = document.documentElement;
      const max = h.scrollHeight - h.clientHeight;
      setW(max > 0 ? (h.scrollTop / max) * 100 : 0);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  return <div className="scroll-progress" style={{ width: `${w}%` }} />;
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
