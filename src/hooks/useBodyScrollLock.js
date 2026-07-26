import { useEffect } from "react";

/**
 * Freeze the page behind a full-screen sheet/modal while it's open.
 *
 * Without this, iOS Safari happily scrolls the document under a fixed overlay
 * once the sheet's own body hits its end — which is what made the Plan → day
 * view look "broken" on the phone: you'd swipe and the app header would slide
 * in over the sheet. Nested locks are counted, so two stacked modals don't
 * unlock the page when only the top one closes.
 */
let lockCount = 0;
let saved = null;

export function useBodyScrollLock(active) {
  useEffect(() => {
    if (!active) return undefined;
    if (lockCount === 0) {
      const { body } = document;
      saved = { overflow: body.style.overflow, touchAction: body.style.touchAction };
      body.style.overflow = "hidden";
      body.style.touchAction = "none";
    }
    lockCount++;
    return () => {
      lockCount--;
      if (lockCount === 0 && saved) {
        document.body.style.overflow = saved.overflow;
        document.body.style.touchAction = saved.touchAction;
        saved = null;
      }
    };
  }, [active]);
}

export default useBodyScrollLock;
