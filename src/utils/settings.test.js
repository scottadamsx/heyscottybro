import test, { beforeEach } from "node:test";
import assert from "node:assert/strict";
import { getJournalCleanupEnabled, setJournalCleanupEnabled } from "./settings.js";

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
