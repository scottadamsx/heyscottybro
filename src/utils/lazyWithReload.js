import { lazy } from "react";

/**
 * Resilient React.lazy for a hashed-chunk SPA on Vercel.
 *
 * Every deploy changes chunk hashes. A tab opened before a deploy still holds
 * the OLD index.html, so navigating to a not-yet-loaded lazy route requests an
 * old chunk hash that no longer exists — Vercel's SPA rewrite then returns
 * index.html (200 text/html) for it, and the browser throws
 * "'text/html' is not a valid JavaScript MIME type" and the page white-screens.
 *
 * The fix: on that specific failure, reload once. The reload fetches the fresh
 * index.html (which references the new hashes), so the second load succeeds.
 * A sessionStorage guard prevents an infinite loop if a chunk is genuinely
 * missing (build error, not a stale deploy); the guard clears the next time any
 * chunk loads successfully, so the next deploy can self-heal too.
 */
const RELOAD_KEY = "hsb-chunk-reload";

function isStaleChunkError(err) {
  const msg = String((err && (err.message || err)) || "");
  return /Failed to fetch dynamically imported module|error loading dynamically imported module|not a valid JavaScript MIME type|Importing a module script failed|ChunkLoadError|Loading chunk [\w-]+ failed/i.test(msg);
}

/**
 * Reload the page once to pick up the fresh index.html + new chunk hashes.
 * Returns true if a reload was triggered, false if one already happened (so the
 * caller lets the real error surface instead of looping).
 */
export function reloadOnceForStaleChunk() {
  try {
    if (sessionStorage.getItem(RELOAD_KEY)) return false;
    sessionStorage.setItem(RELOAD_KEY, String(Date.now()));
  } catch { /* sessionStorage blocked — still worth one reload */ }
  window.location.reload();
  return true;
}

export function lazyWithReload(factory) {
  return lazy(() =>
    factory()
      .then((mod) => {
        // A chunk loaded cleanly — we're on a fresh manifest; re-arm the guard.
        try { sessionStorage.removeItem(RELOAD_KEY); } catch { /* noop */ }
        return mod;
      })
      .catch((err) => {
        if (isStaleChunkError(err) && reloadOnceForStaleChunk()) {
          return new Promise(() => {}); // hang until the reload replaces the page
        }
        throw err; // not a stale chunk, or already retried — let the ErrorBoundary show it
      }),
  );
}
