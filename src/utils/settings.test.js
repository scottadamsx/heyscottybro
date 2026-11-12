import test, { beforeEach } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { getJournalCleanupEnabled, setJournalCleanupEnabled } from "./settings.js";

const settingsSource = readFileSync(new URL("./settings.js", import.meta.url), "utf8");

const memory = new Map();
globalThis.localStorage = {
  getItem: (key) => memory.get(key) ?? null,
  setItem: (key, value) => memory.set(key, String(value)),
  removeItem: (key) => memory.delete(key),
};
beforeEach(() => memory.clear());

test("journal cleanup connector defaults off and round-trips a versioned envelope", () => {
  assert.equal(getJournalCleanupEnabled(), false);
  assert.equal(setJournalCleanupEnabled(true), true);
  assert.equal(getJournalCleanupEnabled(), true);
  assert.deepEqual(JSON.parse(memory.get("setting:journalCleanup")), { schema: 1, enabled: true });
});

test("an unreadable future connector setting fails closed and is quarantined", () => {
  const original = console.error;
  console.error = () => {};
  try {
    memory.set("setting:journalCleanup", JSON.stringify({ schema: 2, enabled: true }));
    assert.equal(getJournalCleanupEnabled(), false);
    assert.match(memory.get("setting:journalCleanup:unreadable"), /"schema":2/);
    assert.equal(memory.has("setting:journalCleanup"), false);
  } finally {
    console.error = original;
  }
});

test("useHiddenPages memoizes its parse on the raw string (BUG-077)", () => {
  // A fresh JSON.parse per render gives the hook a new array identity every
  // render; the command palette memoizes its result groups on that identity,
  // so its cursor-reset effect fired after every render and the first mouse
  // move after scrolling snapped the results list back to the top.
  const hookAt = settingsSource.indexOf("export function useHiddenPages()");
  assert.notEqual(hookAt, -1);
  const hookBody = settingsSource.slice(hookAt, settingsSource.indexOf("\n}", hookAt));
  assert.match(hookBody, /useMemo\(\(\) => parseHiddenPages\(raw\), \[raw\]\)/);
  assert.doesNotMatch(hookBody, /return parseHiddenPages\(/);
});
