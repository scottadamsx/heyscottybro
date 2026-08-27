/**
 * Renders a popover into document.body, positioned against an anchor element.
 * Why: the date/time pickers used to be `position: absolute` inside cards and
 * list rows, so any later sibling with a background (task rows, cards with a
 * transform) painted over them — the "sliced calendar" bug on Projects.
 * A portal sits above everything; position is fixed, recomputed on scroll and
 * resize, flipped above the anchor when there's no room below, and clamped to
 * the viewport.
 */
import { useLayoutEffect, useState } from "react";
import { createPortal } from "react-dom";

export default function PopoverPortal({ anchorRef, popRef, open, children, align = "left", gap = 6 }) {
  const [pos, setPos] = useState(null);

  useLayoutEffect(() => {
    if (!open) { setPos(null); return undefined; }
    const place = () => {
      const a = anchorRef.current?.getBoundingClientRect();
      const p = popRef.current;
      if (!a || !p) return;
      const pw = p.offsetWidth, ph = p.offsetHeight;
      const vw = window.innerWidth, vh = window.innerHeight;
      let top = a.bottom + gap;
      if (top + ph > vh - 8 && a.top - gap - ph > 8) top = a.top - gap - ph; // flip up
      top = Math.max(8, Math.min(top, vh - ph - 8));
      let left = align === "right" ? a.right - pw : a.left;
      left = Math.max(8, Math.min(left, vw - pw - 8));
      setPos({ top, left });
    };
    place();
    const raf = requestAnimationFrame(place);
    window.addEventListener("scroll", place, true);
    window.addEventListener("resize", place);
    return () => { cancelAnimationFrame(raf); window.removeEventListener("scroll", place, true); window.removeEventListener("resize", place); };
  }, [open, anchorRef, popRef, align, gap]);

  if (!open) return null;
  return createPortal(
    <div ref={popRef} className="popover-portal" style={{ position: "fixed", zIndex: 1200, top: pos?.top ?? -9999, left: pos?.left ?? -9999, visibility: pos ? "visible" : "hidden" }}>
      {children}
    </div>,
    document.body,
  );
}
