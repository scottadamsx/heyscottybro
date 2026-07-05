import { useEffect, useMemo, useRef } from "react";
import { earnActivityHtml } from "../../games/kiwi/earnContent";

/**
 * Runs ANY Kiwi engage activity (game, survey, article, quick-pulse question,
 * even the lab stubs) in a sandboxed iframe — the document is built by Kiwi's
 * own earnActivityHtml dispatcher, ported verbatim, so ordering and behavior
 * match Kiwi exactly (kiwiComplete defined before body scripts, best score
 * injected as __KIWI_BEST). Completion posts back via parent.postMessage.
 */
export default function GameFrame({ opp, kiwiQ, best = 0, onComplete }) {
  const ref = useRef(null);
  const cbRef = useRef(onComplete);
  cbRef.current = onComplete;

  const srcDoc = useMemo(
    () => earnActivityHtml(opp, 0.5, { bestScore: best, kiwiQ }),
    [opp, kiwiQ, best],
  );

  useEffect(() => {
    const onMsg = (e) => {
      if (e.source !== ref.current?.contentWindow) return;
      const d = e.data;
      if (d && d.__hsbArcade && d.type === "complete") cbRef.current?.(d);
    };
    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
  }, []);

  return (
    <iframe
      ref={ref}
      title={opp.title || opp.id}
      className="arcade-frame"
      sandbox="allow-scripts"
      srcDoc={srcDoc}
    />
  );
}
