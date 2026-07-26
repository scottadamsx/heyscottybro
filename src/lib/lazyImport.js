/**
 * Resilient dynamic import.
 *
 * Code-split chunks are hashed per build. When a new version is deployed while
 * a tab is still open (or a service worker is holding a stale cache), the chunk
 * the running page asks for no longer exists — the host answers the SPA
 * fallback, and the browser refuses it with:
 *
 *   "'text/html' is not a valid JavaScript MIME type"
 *   / "Failed to fetch dynamically imported module"
 *
 * That is exactly how `consult_archivist` "broke": nothing was wrong with
 * Bilbo, the lazily-imported archivist chunk just couldn't load. So: retry
 * once past any cache, and if it still fails, reload the page ONCE (guarded in
 * sessionStorage so a genuinely broken deploy can't put us in a reload loop).
 */
const RELOAD_FLAG = "hsb_chunk_reload";

const isChunkError = (err) =>
  /valid JavaScript MIME type|Failed to fetch dynamically imported module|error loading dynamically imported module|Importing a module script failed/i
    .test(err?.message || "");

export async function lazyImport(loader, label = "module") {
  try {
    return await loader();
  } catch (err) {
    if (!isChunkError(err)) throw err;

    // One retry — a transient network blip on a slow phone connection is the
    // common case and doesn't need a reload.
    try {
      return await loader();
    } catch { /* fall through to the reload path */ }

    let alreadyReloaded = false;
    try {
      alreadyReloaded = sessionStorage.getItem(RELOAD_FLAG) === "1";
      sessionStorage.setItem(RELOAD_FLAG, "1");
    } catch { /* private mode — treat as not-yet-reloaded */ }

    if (!alreadyReloaded) {
      window.location.reload();
      // Never resolves; the page is going away.
      await new Promise(() => {});
    }
    throw new Error(`This tab is running an old version of the app and couldn't load ${label}. Reload the page and try again.`);
  }
}

/** Call once the app has booted successfully, so the next stale chunk can reload again. */
export function clearChunkReloadFlag() {
  try { sessionStorage.removeItem(RELOAD_FLAG); } catch { /* noop */ }
}
