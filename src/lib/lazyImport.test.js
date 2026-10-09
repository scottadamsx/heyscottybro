import test from "node:test";
import assert from "node:assert/strict";
import {
  CHUNK_RELOAD_FLAG,
  chunkReloadFlag,
  clearChunkReloadFlag,
  lazyImport,
} from "./lazyImport.js";

function browserHarness() {
  const values = new Map();
  let reloads = 0;
  const previousStorage = globalThis.sessionStorage;
  const previousWindow = globalThis.window;
  globalThis.sessionStorage = {
    get length() { return values.size; },
    getItem: (key) => values.get(key) ?? null,
    key: (index) => [...values.keys()][index] ?? null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: (key) => values.delete(key),
  };
  globalThis.window = { location: { reload: () => { reloads += 1; } } };
  return {
    values,
    reloads: () => reloads,
    restore() {
      if (previousStorage === undefined) delete globalThis.sessionStorage;
      else globalThis.sessionStorage = previousStorage;
      if (previousWindow === undefined) delete globalThis.window;
      else globalThis.window = previousWindow;
    },
  };
}

const chunkError = () => new TypeError("Failed to fetch dynamically imported module");

test("a successful import rearms stale-chunk recovery", async () => {
  const browser = browserHarness();
  try {
    const flag = chunkReloadFlag("Bilbo");
    browser.values.set(flag, "1");
    const module = { ready: true };
    assert.equal(await lazyImport(async () => module, "Bilbo"), module);
    assert.equal(browser.values.has(flag), false);
    assert.equal(browser.reloads(), 0);
  } finally { browser.restore(); }
});

test("a transient chunk failure retries once and success rearms recovery", async () => {
  const browser = browserHarness();
  try {
    const flag = chunkReloadFlag("Bilbo");
    browser.values.set(flag, "1");
    let calls = 0;
    const module = await lazyImport(async () => {
      calls += 1;
      if (calls === 1) throw chunkError();
      return { ready: true };
    }, "Bilbo");
    assert.equal(module.ready, true);
    assert.equal(calls, 2);
    assert.equal(browser.values.has(flag), false);
    assert.equal(browser.reloads(), 0);
  } finally { browser.restore(); }
});

test("ordinary failures are not retried or converted into reloads", async () => {
  const browser = browserHarness();
  try {
    let calls = 0;
    await assert.rejects(lazyImport(async () => { calls += 1; throw new Error("module bug"); }), /module bug/);
    assert.equal(calls, 1);
    assert.equal(browser.reloads(), 0);
  } finally { browser.restore(); }
});

test("a non-chunk retry failure surfaces without reloading", async () => {
  const browser = browserHarness();
  try {
    let calls = 0;
    await assert.rejects(lazyImport(async () => {
      calls += 1;
      if (calls === 1) throw chunkError();
      throw new Error("module evaluated and failed");
    }), /module evaluated and failed/);
    assert.equal(calls, 2);
    assert.equal(browser.reloads(), 0);
  } finally { browser.restore(); }
});

test("persistent chunk failures reload at most once per armed cycle", async () => {
  const browser = browserHarness();
  try {
    const first = lazyImport(async () => { throw chunkError(); }, "Bilbo");
    const state = await Promise.race([
      first.then(() => "resolved", () => "rejected"),
      new Promise((resolve) => setTimeout(() => resolve("pending"), 10)),
    ]);
    assert.equal(state, "pending", "the first call waits for the page reload");
    assert.equal(browser.reloads(), 1);
    assert.equal(browser.values.get(chunkReloadFlag("Bilbo")), "1");

    await assert.rejects(
      lazyImport(async () => { throw chunkError(); }, "Bilbo"),
      /old version.*Bilbo/i,
    );
    assert.equal(browser.reloads(), 1, "the guard prevents a reload loop");
  } finally { browser.restore(); }
});

test("inaccessible session storage fails safely without starting a reload loop", async () => {
  const browser = browserHarness();
  const workingStorage = globalThis.sessionStorage;
  globalThis.sessionStorage = {
    get length() { throw new Error("storage blocked"); },
    getItem() { throw new Error("storage blocked"); },
    key() { throw new Error("storage blocked"); },
    setItem() { throw new Error("storage blocked"); },
    removeItem() { throw new Error("storage blocked"); },
  };
  try {
    await assert.rejects(
      lazyImport(async () => { throw chunkError(); }, "Bilbo"),
      /old version.*Bilbo/i,
    );
    assert.equal(browser.reloads(), 0, "an unguarded reload would be able to loop forever");
  } finally {
    globalThis.sessionStorage = workingStorage;
    browser.restore();
  }
});

test("a healthy module cannot rearm a different broken module", async () => {
  const browser = browserHarness();
  try {
    const first = lazyImport(async () => { throw chunkError(); }, "Bilbo");
    const state = await Promise.race([
      first.then(() => "resolved", () => "rejected"),
      new Promise((resolve) => setTimeout(() => resolve("pending"), 10)),
    ]);
    assert.equal(state, "pending");
    assert.equal(browser.reloads(), 1);

    await lazyImport(async () => ({ ready: true }), "Banker");
    assert.equal(browser.values.get(chunkReloadFlag("Bilbo")), "1");

    await assert.rejects(
      lazyImport(async () => { throw chunkError(); }, "Bilbo"),
      /old version.*Bilbo/i,
    );
    assert.equal(browser.reloads(), 1, "Bilbo remains guarded after Banker succeeds");
  } finally { browser.restore(); }
});

test("module keys are stable, bounded, ASCII-only, and collision-resistant", () => {
  const longLabel = `${"The Archivist (Bilbo) 🧙 ".repeat(20)}A`;
  const key = chunkReloadFlag(longLabel);
  assert.equal(key, chunkReloadFlag(longLabel));
  assert.match(key, /^[a-z0-9:_-]+$/);
  assert.ok(key.length <= CHUNK_RELOAD_FLAG.length + 42);
  assert.notEqual(key, chunkReloadFlag(`${"The Archivist (Bilbo) 🧙 ".repeat(20)}B`));
});

test("the compatibility clear removes the legacy base and all keyed guards", () => {
  const browser = browserHarness();
  try {
    browser.values.set(CHUNK_RELOAD_FLAG, "1");
    browser.values.set(chunkReloadFlag("Bilbo"), "1");
    browser.values.set(chunkReloadFlag("Banker"), "1");
    browser.values.set("unrelated", "keep");
    clearChunkReloadFlag();
    assert.deepEqual([...browser.values], [["unrelated", "keep"]]);
  } finally { browser.restore(); }
});
