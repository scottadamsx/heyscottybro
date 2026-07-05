import { useEffect, useMemo, useRef } from "react";
import { shellHead, COMPLETE_JS } from "../../games/kiwi/shell";

/**
 * Runs one Kiwi game inside a sandboxed iframe, byte-identical to how it runs
 * in Kiwi's engage panel: same paper-&-clay skin, same kiwiComplete contract.
 * Completion arrives via postMessage -> onComplete({bonus, score, won}).
 */
export default function GameFrame({ game, best = 0, onComplete }) {
  const ref = useRef(null);
  const cbRef = useRef(onComplete);
  cbRef.current = onComplete;

  const srcDoc = useMemo(() => {
    const html = game.render(0.5); // usd stake -> "50 pts" via the port's reward()
    return `<!doctype html><html><head>${shellHead(false)}</head><body>` +
      `<script>window.__KIWI_BEST=${Number(best) || 0};<\/script>` +
      html + COMPLETE_JS + `</body></html>`;
  }, [game, best]);

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
      title={game.title}
      className="arcade-frame"
      sandbox="allow-scripts"
      srcDoc={srcDoc}
    />
  );
}
