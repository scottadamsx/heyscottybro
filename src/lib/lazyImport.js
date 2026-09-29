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
export const CHUNK_RELOAD_FLAG = "hsb_chunk_reload";
const MAX_LABEL_SLUG_LENGTH = 32;
const knownReloadFlags = new Set();

export const isChunkImportError = (err) =>
  /valid JavaScript MIME type|Failed to fetch dynamically imported module|error loading dynamically imported module|Importing a module script failed/i
    .test(err?.message || "");

function labelHash(value) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36).padStart(7, "0");
}

/** Stable, ASCII-only and bounded sessionStorage key for one lazy module. */
export function chunkReloadFlag(label = "module") {
  const source = String(label || "module");
  const slug = source
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, MAX_LABEL_SLUG_LENGTH) || "module";
  return `${CHUNK_RELOAD_FLAG}:${slug}:${labelHash(source)}`;
}

function rearmChunkRecovery(label) {
  clearChunkReloadFlag(label);
}

export async function lazyImport(loader, label = "module") {
  try {
    const loaded = await loader();
    rearmChunkRecovery(label);
    return loaded;
  } catch (err) {
    if (!isChunkImportError(err)) throw err;

    // One retry — a transient network blip on a slow phone connection is the
    // common case and doesn't need a reload.
    try {
      const loaded = await loader();
      rearmChunkRecovery(label);
      return loaded;
    } catch (retryErr) {
      // A different failure on retry is the real failure. Reloading for an
      // ordinary application exception hides the cause and cannot repair it.
      if (!isChunkImportError(retryErr)) throw retryErr;
    }

    let alreadyReloaded = false;
    let reloadGuardPersisted = false;
    const reloadFlag = chunkReloadFlag(label);
    knownReloadFlags.add(reloadFlag);
    try {
      alreadyReloaded = sessionStorage.getItem(reloadFlag) === "1";
      if (!alreadyReloaded) {
        sessionStorage.setItem(reloadFlag, "1");
        // Some locked-down storage shims fail silently. Reload only after the
        // guard can be read back, otherwise the next page could loop forever.
        reloadGuardPersisted = sessionStorage.getItem(reloadFlag) === "1";
      }
    } catch { /* inaccessible storage cannot safely guard a reload */ }

    if (!alreadyReloaded && reloadGuardPersisted) {
      window.location.reload();
      // Never resolves; the page is going away.
      await new Promise(() => {});
    }
    throw new Error(`This tab is running an old version of the app and couldn't load ${label}. Reload the page and try again.`, { cause: err });
  }
}

/**
 * Rearm one successfully loaded module. With no label, retain the legacy
 * public behavior by clearing the old global key and every known keyed guard.
 */
export function clearChunkReloadFlag(label) {
  try {
    const keys = new Set([CHUNK_RELOAD_FLAG]);
    if (label !== undefined) {
      keys.add(chunkReloadFlag(label));
    } else {
      knownReloadFlags.forEach((key) => keys.add(key));
      for (let index = 0; index < sessionStorage.length; index += 1) {
        const key = sessionStorage.key(index);
        if (key?.startsWith(`${CHUNK_RELOAD_FLAG}:`)) keys.add(key);
      }
    }
    keys.forEach((key) => sessionStorage.removeItem(key));
    if (label !== undefined) knownReloadFlags.delete(chunkReloadFlag(label));
    else knownReloadFlags.clear();
  } catch { /* noop */ }
}
