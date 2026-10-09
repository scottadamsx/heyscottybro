import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  STALE_CHUNK_RELOAD_KEY, clearStaleChunkReloadGuard, isStaleChunkError, reloadOnceForStaleChunk,
} from "./lazyWithReload.js";

function withBrowser(fn) {
  const oldWindow = globalThis.window;
  const oldStorage = globalThis.sessionStorage;
  const entries = new Map();
  let reloads = 0;
  globalThis.sessionStorage = {
    getItem: (key) => entries.get(key) || null,
    setItem: (key, value) => entries.set(key, String(value)),
    removeItem: (key) => entries.delete(key),
  };
  globalThis.window = { location: { reload: () => { reloads += 1; } } };
  try { return fn({ entries, reloads: () => reloads }); }
  finally {
    if (oldWindow === undefined) delete globalThis.window; else globalThis.window = oldWindow;
    if (oldStorage === undefined) delete globalThis.sessionStorage; else globalThis.sessionStorage = oldStorage;
  }
}

test("recognizes the browser's reported module-script failure but not component errors", () => {
  assert.equal(isStaleChunkError(new Error("Importing a module script failed.")), true);
  assert.equal(isStaleChunkError(new Error("Dashboard render failed")), false);
});

test("a stale chunk reloads once, re-arms after success, and never loops", () => withBrowser(({ entries, reloads }) => {
  assert.equal(reloadOnceForStaleChunk(), true);
  assert.equal(reloads(), 1);
  assert.equal(entries.has(STALE_CHUNK_RELOAD_KEY), true);
  assert.equal(reloadOnceForStaleChunk(), false);
  assert.equal(reloads(), 1);
  clearStaleChunkReloadGuard();
  assert.equal(entries.has(STALE_CHUNK_RELOAD_KEY), false);
  assert.equal(reloadOnceForStaleChunk(), true);
  assert.equal(reloads(), 2);
}));

test("every admin route uses the shared guarded lazy loader", () => {
  const source = readFileSync(new URL("../pages/admin/adminRoutes.jsx", import.meta.url), "utf8");
  assert.match(source, /import \{ lazyWithReload \} from "\.\.\/\.\.\/utils\/lazyWithReload"/);
  assert.doesNotMatch(source, /import \{ lazy, Suspense \} from "react"/);
  assert.match(source, /const DashboardPage\s+= lazyWithReload\(/);
  assert.match(source, /const BrainReaderPage\s+= lazyWithReload\(/);
});
