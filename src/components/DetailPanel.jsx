import { useEffect, useRef } from "react";
import { useDetailPanel } from "../contexts/DetailPanelContext";

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * The detail-panel host: an overlay from the right edge (a full-screen sheet
 * on phones), rendered once by the shell. Content comes from
 * DetailPanelContext; pages supply read-first summaries, never forms.
 */
export default function DetailPanel() {
  const { panel, closePanel } = useDetailPanel();
  const panelRef = useRef(null);
  const restoreRef = useRef(null);

  useEffect(() => {
    if (!panel) return undefined;
    restoreRef.current = document.activeElement;
    panelRef.current?.focus();
    const onKey = (e) => {
      if (e.key === "Escape") {
        closePanel();
        return;
      }
      if (e.key !== "Tab" || !panelRef.current) return;
      const items = [...panelRef.current.querySelectorAll(FOCUSABLE)];
      if (!items.length) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      restoreRef.current?.focus?.();
    };
  }, [panel, closePanel]);

  if (!panel) return null;
  return (
    <div className="detail-panel-wrap">
      <button
        type="button"
        className="detail-panel-backdrop"
        aria-label="Close panel"
        onClick={closePanel}
      />
      <section
        className="detail-panel"
        role="dialog"
        aria-modal="true"
        aria-label={panel.title}
        ref={panelRef}
        tabIndex={-1}
      >
        <header className="detail-panel-head">
          <h2>{panel.title}</h2>
          <button
            type="button"
            className="icon-x"
            onClick={closePanel}
            aria-label="Close panel"
          >
            <i className="fa-solid fa-xmark" aria-hidden="true" />
          </button>
        </header>
        <div className="detail-panel-body">{panel.content}</div>
      </section>
    </div>
  );
}
