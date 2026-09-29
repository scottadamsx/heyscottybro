import { test } from "node:test";
import assert from "node:assert/strict";
import {
  clearSessionThenCleanupStaging,
  closePendingTurnForPersistence,
  createSessionHistoryGate,
  createSessionMutationGate,
  FRODO_CLEAR_CONFIRMATION,
  FRODO_CLEAR_SUCCESS,
  flushSessionSnapshot,
  ownerBoundLegacyChatKey,
  ownerBoundLegacyClearMarkerKey,
  persistSessionPhase,
  readOwnerBoundLegacyChat,
  requireSuccessfulSessionSave,
  removeOwnerBoundLegacyChat,
  saveSessionThenCleanupEvicted,
  selectDurableOrLegacyChat,
  shouldRemoveLegacyChat,
  suppressAndRemoveOwnerBoundLegacyChat,
  UNOWNED_LEGACY_CHAT_KEY,
  unownedLegacyChatWarning,
  verifiedOwnerLegacyFallback,
} from "./chatSessionPolicy.js";

test("a failed history load locks send and persistence until a successful retry", () => {
  const gate = createSessionHistoryGate();
  assert.equal(gate.canUse(), false);
  gate.fail();
  assert.equal(gate.canUse(), false);
  assert.equal(gate.needsRetry(), true);
  gate.begin();
  assert.equal(gate.canUse(), false);
  gate.ready();
  assert.equal(gate.canUse(), true);
  assert.equal(gate.needsRetry(), false);
});

test("confirmed Clear exclusively blocks every conversation mutation until settlement", () => {
  const gate = createSessionMutationGate();
  assert.equal(gate.canMutate(), true);
  assert.equal(gate.beginClear(), true);
  assert.equal(gate.isClearing(), true);
  assert.equal(gate.canMutate(), false, "send/stage/input mutations stay locked during Clear");
  assert.equal(gate.beginClear(), false, "a repeated Clear cannot start");
  gate.finishClear();
  assert.equal(gate.isClearing(), false);
  assert.equal(gate.canMutate(), true, "failure or success unlocks an explicit retry");
});

test("Clear copy describes the durable row and current session without an every-device promise", () => {
  assert.match(FRODO_CLEAR_CONFIRMATION, /saved conversation/i);
  assert.match(FRODO_CLEAR_CONFIRMATION, /this chat session/i);
  assert.match(FRODO_CLEAR_SUCCESS, /saved conversation/i);
  assert.doesNotMatch(`${FRODO_CLEAR_CONFIRMATION} ${FRODO_CLEAR_SUCCESS}`, /every device|all devices/i);
});

test("unowned and other-owner legacy chats are never read, imported, or deleted", () => {
  const values = new Map();
  const reads = [];
  const storage = {
    getItem(key) { reads.push(key); return values.get(key) ?? null; },
    removeItem(key) { values.delete(key); },
  };
  const unowned = JSON.stringify({ displayMsgs: ["owner A private chat"], apiHistory: ["secret"] });
  values.set(UNOWNED_LEGACY_CHAT_KEY, unowned);
  values.set(ownerBoundLegacyChatKey("owner-a"), JSON.stringify({
    ownerId: "owner-a",
    displayMsgs: [{ role: "user", text: "owner A attributed chat" }],
    apiHistory: [{ role: "user", content: "owner A history" }],
  }));
  values.set(ownerBoundLegacyChatKey("owner-b"), JSON.stringify({
    ownerId: "owner-a",
    displayMsgs: ["wrong envelope owner"],
    apiHistory: [],
  }));

  const ownerA = readOwnerBoundLegacyChat(storage, "owner-a");
  const ownerB = readOwnerBoundLegacyChat(storage, "owner-b");
  const ownerC = readOwnerBoundLegacyChat(storage, "owner-c");
  const warning = unownedLegacyChatWarning(storage);

  assert.deepEqual(ownerA, {
    key: ownerBoundLegacyChatKey("owner-a"),
    displayMsgs: [{ role: "user", text: "owner A attributed chat" }],
    apiHistory: [{ role: "user", content: "owner A history" }],
  });
  assert.equal(ownerB, null, "B cannot claim A's attributed envelope");
  assert.equal(ownerC, null, "an owner with no attributed backup never falls back to the global payload");
  assert.match(warning, /without account ownership is quarantined/i);
  assert.doesNotMatch(warning, /owner A private chat|secret/);
  assert.equal(reads.filter((key) => key === UNOWNED_LEGACY_CHAT_KEY).length, 1, "global data is checked only for quarantine presence");
  assert.equal(values.get(UNOWNED_LEGACY_CHAT_KEY), unowned, "unowned evidence remains quarantined in place");

  removeOwnerBoundLegacyChat(storage, "owner-a");
  assert.equal(values.has(ownerBoundLegacyChatKey("owner-a")), false);
  assert.equal(values.get(UNOWNED_LEGACY_CHAT_KEY), unowned, "safe-owner cleanup never deletes unowned data");
});

test("legacy chat is retained until a session save succeeds", () => {
  assert.equal(shouldRemoveLegacyChat({ legacyPresent: true, saveSucceeded: false }), false);
  assert.equal(shouldRemoveLegacyChat({ legacyPresent: true, saveSucceeded: true }), true);
  assert.equal(shouldRemoveLegacyChat({ legacyPresent: false, saveSucceeded: true }), false);
});

test("malformed owner-bound legacy chat remains untouched and cannot become migratable", () => {
  for (const malformed of [
    { ownerId: "owner-a", displayMsgs: "private transcript", apiHistory: [] },
    { ownerId: "owner-a", displayMsgs: [], apiHistory: { role: "user" } },
    { ownerId: "owner-a", displayMsgs: null, apiHistory: [] },
  ]) {
    const key = ownerBoundLegacyChatKey("owner-a");
    const raw = JSON.stringify(malformed);
    const values = new Map([[key, raw]]);
    const storage = {
      getItem(candidate) { return values.get(candidate) ?? null; },
      removeItem(candidate) { values.delete(candidate); },
    };

    const recovered = readOwnerBoundLegacyChat(storage, "owner-a");
    assert.equal(recovered, null);
    assert.equal(values.get(key), raw, "invalid attributed evidence stays available for explicit recovery");
    assert.equal(shouldRemoveLegacyChat({ legacyPresent: Boolean(recovered?.key), saveSucceeded: true }), false);
    assert.equal(values.get(key), raw, "an unrelated later save cannot authorize deletion");
  }
});

test("nested malformed owner-bound legacy chat remains untouched", () => {
  const malformedHistories = [
    { displayMsgs: [null], apiHistory: [] },
    { displayMsgs: [{ role: "future", text: "private" }], apiHistory: [] },
    { displayMsgs: [{ role: "user", text: "private" }], apiHistory: [{}] },
    { displayMsgs: [{ role: "user", text: "private" }], apiHistory: [{ role: "user", content: null }] },
    { displayMsgs: [{ role: "user", text: "private" }], apiHistory: [{ role: "user", content: ["bad block"] }] },
  ];

  for (const malformed of malformedHistories) {
    const key = ownerBoundLegacyChatKey("owner-a");
    const raw = JSON.stringify({ ownerId: "owner-a", ...malformed });
    const values = new Map([[key, raw]]);
    const storage = {
      getItem(candidate) { return values.get(candidate) ?? null; },
      removeItem(candidate) { values.delete(candidate); },
    };

    const recovered = readOwnerBoundLegacyChat(storage, "owner-a");
    assert.equal(recovered, null);
    assert.equal(values.get(key), raw);
    assert.equal(shouldRemoveLegacyChat({ legacyPresent: Boolean(recovered?.key), saveSucceeded: true }), false);
  }
});

test("auth drift cannot substitute B legacy data or display A's fallback", async () => {
  const legacyA = { key: "owner-a-key", displayMsgs: ["A private"], apiHistory: [] };
  let requestedOwner = null;
  await assert.rejects(
    verifiedOwnerLegacyFallback(legacyA, "owner-a", async (ownerId) => {
      requestedOwner = ownerId;
      return "owner-b";
    }),
    /fallback was cancelled/,
  );
  assert.equal(requestedOwner, "owner-a", "verification stays bound to A and never looks up B's legacy key");
});

test("Clear tombstone suppresses legacy bytes when their cleanup fails, then permits retry", () => {
  const ownerId = "owner-a";
  const legacyKey = ownerBoundLegacyChatKey(ownerId);
  const markerKey = ownerBoundLegacyClearMarkerKey(ownerId);
  const raw = JSON.stringify({
    ownerId,
    displayMsgs: [{ role: "user", text: "must stay cleared" }],
    apiHistory: [{ role: "user", content: "must stay cleared" }],
  });
  const values = new Map([[legacyKey, raw]]);
  let failLegacyRemoval = true;
  const storage = {
    getItem(key) { return values.get(key) ?? null; },
    setItem(key, value) { values.set(key, value); },
    removeItem(key) {
      if (key === legacyKey && failLegacyRemoval) throw new Error("legacy cleanup denied");
      values.delete(key);
    },
  };

  assert.throws(
    () => suppressAndRemoveOwnerBoundLegacyChat(storage, ownerId),
    /legacy cleanup denied/,
  );
  assert.equal(values.get(legacyKey), raw, "recoverable legacy bytes remain untouched");
  assert.equal(values.get(markerKey), "1", "the authoritative empty state survives reload");
  assert.equal(readOwnerBoundLegacyChat(storage, ownerId), null, "reload cannot display or migrate cleared bytes");

  failLegacyRemoval = false;
  suppressAndRemoveOwnerBoundLegacyChat(storage, ownerId);
  assert.equal(values.has(legacyKey), false);
  assert.equal(values.has(markerKey), false);
});

test("Clear still removes legacy bytes when marker storage fails", () => {
  const ownerId = "owner-a";
  const legacyKey = ownerBoundLegacyChatKey(ownerId);
  const values = new Map([[legacyKey, "private bytes"]]);
  const storage = {
    getItem(key) { return values.get(key) ?? null; },
    setItem() { throw new Error("marker denied"); },
    removeItem(key) { values.delete(key); },
  };

  assert.throws(() => suppressAndRemoveOwnerBoundLegacyChat(storage, ownerId), /marker denied/);
  assert.equal(values.has(legacyKey), false, "marker failure never skips deletion");
});

test("authoritative empty durable history defeats legacy bytes when every cleanup step fails", () => {
  const legacy = {
    key: "legacy",
    displayMsgs: [{ role: "user", text: "cleared private chat" }],
    apiHistory: [{ role: "user", content: "cleared private chat" }],
  };
  const selected = selectDurableOrLegacyChat({ display: [], convo: [] }, legacy);
  assert.deepEqual(selected, { displayMsgs: [], apiHistory: [] });
});

test("settled snapshots invoke durable save immediately without a debounce", async () => {
  let called = false;
  let release;
  const pending = new Promise((resolve) => { release = resolve; });
  const save = (agentId, snapshot) => {
    called = true;
    assert.equal(agentId, "frodo");
    assert.deepEqual(snapshot, { display: ["reply"], convo: ["history"] });
    return pending;
  };

  const flushed = flushSessionSnapshot({
    save,
    agentId: "frodo",
    display: ["reply"],
    convo: ["history"],
  });
  assert.equal(called, true, "save starts in the same call, before any timer can fire");
  release();
  await flushed;
});

test("a false accepted-turn save stops before model execution", () => {
  const events = ["save:false"];
  assert.throws(
    () => requireSuccessfulSessionSave(false, "Accepted turn"),
    /Accepted turn could not be saved.*stopped before continuing/,
  );
  assert.deepEqual(events, ["save:false"], "no model call follows the failed checkpoint");
});

test("a false post-tool save stops before any later model or tool side effect", () => {
  const events = ["model:one", "tool:one", "checkpoint:false"];
  assert.throws(
    () => requireSuccessfulSessionSave(false, "Completed tool work"),
    /Completed tool work could not be saved/,
  );
  assert.deepEqual(events, ["model:one", "tool:one", "checkpoint:false"]);
});

test("a false terminal save remains an actionable failure", () => {
  assert.throws(
    () => requireSuccessfulSessionSave(false, "Final reply"),
    /Final reply could not be saved; the turn was stopped/,
  );
});

test("an in-flight turn is stored with an assistant closure for safe next-turn recovery", () => {
  const stored = closePendingTurnForPersistence([{ role: "user", content: "hello" }]);
  assert.equal(stored.at(-1).role, "assistant");
  assert.match(stored.at(-1).content[0].text, /turn interrupted before a reply/);
});

test("closing an already closed checkpoint replaces the note instead of appending two assistant turns", () => {
  const first = closePendingTurnForPersistence([{ role: "user", content: "hello" }], "turn interrupted before tool work");
  const second = closePendingTurnForPersistence(first, "turn interrupted after tool work");
  assert.equal(second.length, 2);
  assert.match(second.at(-1).content[0].text, /after tool work/);
});

test("terminal and error-state save failures settle to false without rejecting", async () => {
  assert.equal(await persistSessionPhase({ save: async () => false, phase: "Final reply", required: false }), false);
  assert.equal(await persistSessionPhase({ save: async () => { throw new Error("offline"); }, phase: "Error state", required: false }), false);
});

test("evicted attachments are removed only after the replacement snapshot saves", async () => {
  const events = [];
  const result = await saveSessionThenCleanupEvicted({
    save: async () => { events.push("save"); },
    agentId: "frodo",
    display: [],
    convo: [],
    evictedPaths: ["owner/_staging/old.png"],
    removeEvicted: async (paths) => { events.push(`remove:${paths[0]}`); },
  });
  assert.deepEqual(events, ["save", "remove:owner/_staging/old.png"]);
  assert.equal(result.cleanupError, null);

  let removed = false;
  await assert.rejects(saveSessionThenCleanupEvicted({
    save: async () => { throw new Error("save denied"); },
    agentId: "frodo",
    display: [],
    convo: [],
    evictedPaths: ["owner/_staging/old.png"],
    removeEvicted: async () => { removed = true; },
  }), /save denied/);
  assert.equal(removed, false);
});

test("clear deletes the session before staging and preserves cleanup failures", async () => {
  const events = [];
  const result = await clearSessionThenCleanupStaging({
    clearSession: async () => { events.push("session"); },
    clearLegacy: async () => { events.push("legacy"); },
    clearStaging: async () => { events.push("staging"); throw new Error("cleanup denied"); },
  });
  assert.deepEqual(events, ["session", "legacy", "staging"]);
  assert.equal(result.cleared, true, "the durable deletion boundary is explicit despite cleanup warnings");
  assert.equal(result.legacyError, null);
  assert.match(result.cleanupError.message, /cleanup denied/);

  let stagingCalled = false;
  let legacyCalled = false;
  await assert.rejects(clearSessionThenCleanupStaging({
    clearSession: async () => { throw new Error("clear denied"); },
    clearLegacy: async () => { legacyCalled = true; },
    clearStaging: async () => { stagingCalled = true; },
  }), /clear denied/);
  assert.equal(legacyCalled, false, "a failed DB clear retains the only legacy backup");
  assert.equal(stagingCalled, false);
});

test("post-clear cleanup attempts both legacy and staging and returns retry details", async () => {
  const events = [];
  const result = await clearSessionThenCleanupStaging({
    clearSession: async () => { events.push("session"); },
    clearLegacy: async () => { events.push("legacy"); throw new Error("legacy denied"); },
    clearStaging: async () => { events.push("staging"); },
  });
  assert.deepEqual(events, ["session", "legacy", "staging"]);
  assert.equal(result.cleared, true);
  assert.match(result.legacyError.message, /legacy denied/);
  assert.equal(result.cleanupError, null);
});
