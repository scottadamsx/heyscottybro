import { test } from "node:test";
import assert from "node:assert/strict";
import {
  BANKER_SESSION_VERSION,
  beginOwnerBoundBankerTurn,
  cancelOwnerBoundBankerClear,
  clearOwnerBoundBankerSession,
  ownerBoundBankerSessionKey,
  persistOwnerBoundBankerSnapshot,
  prepareOwnerBoundBankerClear,
  readOwnerBoundBankerSession,
  subscribeOwnerBoundBankerSession,
  UNOWNED_BANKER_SESSION_KEY,
  writeOwnerBoundBankerSession,
} from "./bankerSessionPolicy.js";

function memoryStorage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return {
    values,
    getItem(key) { return values.get(key) ?? null; },
    setItem(key, value) { values.set(key, value); },
    removeItem(key) { values.delete(key); },
  };
}

test("Griphook restores only the established owner's versioned conversation", () => {
  const storage = memoryStorage();
  const session = {
    display: [{ role: "user", text: "owner A gold" }],
    history: [{ role: "user", content: "owner A gold" }],
  };
  writeOwnerBoundBankerSession(storage, "owner-a", session, 1_000);

  assert.deepEqual(readOwnerBoundBankerSession(storage, "owner-a", { now: 1_100 }), {
    ...session,
    warning: "",
    writable: true,
  });
  assert.deepEqual(readOwnerBoundBankerSession(storage, "owner-b", { now: 1_100 }), {
    display: [],
    history: [],
    warning: "",
    writable: true,
  });
});

test("an unowned legacy Griphook backup is quarantined without exposing its content", () => {
  const storage = memoryStorage({
    [UNOWNED_BANKER_SESSION_KEY]: JSON.stringify({ display: [{ text: "private A balance" }] }),
  });

  const result = readOwnerBoundBankerSession(storage, "owner-b");
  assert.deepEqual(result.display, []);
  assert.deepEqual(result.history, []);
  assert.equal(result.writable, true);
  assert.match(result.warning, /without account ownership is quarantined/i);
  assert.doesNotMatch(result.warning, /private A balance/);
  assert.equal(storage.values.has(UNOWNED_BANKER_SESSION_KEY), true, "unattributable evidence remains untouched");
});

test("malformed, mismatched, and future Griphook sessions fail closed and remain untouched", () => {
  const key = ownerBoundBankerSessionKey("owner-a");
  const invalid = [
    "not json",
    JSON.stringify({ version: BANKER_SESSION_VERSION + 1, ownerId: "owner-a", savedAt: 1, display: [], history: [] }),
    JSON.stringify({ version: BANKER_SESSION_VERSION, ownerId: "owner-b", savedAt: 1, display: [], history: [] }),
    JSON.stringify({ version: BANKER_SESSION_VERSION, ownerId: "owner-a", savedAt: 1, display: [null], history: [] }),
  ];

  for (const raw of invalid) {
    const storage = memoryStorage({ [key]: raw });
    const result = readOwnerBoundBankerSession(storage, "owner-a", { now: 2 });
    assert.deepEqual(result.display, []);
    assert.equal(result.writable, false);
    assert.match(result.warning, /unsupported format/i);
    assert.equal(storage.values.get(key), raw);
  }
});

test("nested malformed Griphook messages stay locked and byte-for-byte untouched", () => {
  const key = ownerBoundBankerSessionKey("owner-a");
  const invalid = [
    { display: [{ role: "future", text: "private" }], history: [] },
    { display: [{ role: "user", text: "private" }], history: [{}] },
    { display: [{ role: "user", text: "private" }], history: [{ role: "user", content: null }] },
    { display: [{ role: "user", text: "private" }], history: [{ role: "user", content: [null] }] },
    { display: [{ role: "user", text: "private" }], history: [{ role: "user", content: ["bad block"] }] },
  ];

  for (const histories of invalid) {
    const raw = JSON.stringify({
      version: BANKER_SESSION_VERSION,
      ownerId: "owner-a",
      savedAt: 1,
      ...histories,
    });
    const storage = memoryStorage({ [key]: raw });
    const result = readOwnerBoundBankerSession(storage, "owner-a", { now: 2 });
    assert.deepEqual(result.display, []);
    assert.deepEqual(result.history, []);
    assert.equal(result.writable, false);
    assert.equal(storage.values.get(key), raw);
  }
});

test("expiry and Clear remove only the established owner's Griphook key", () => {
  const aKey = ownerBoundBankerSessionKey("owner-a");
  const bKey = ownerBoundBankerSessionKey("owner-b");
  const envelope = (ownerId) => JSON.stringify({
    version: BANKER_SESSION_VERSION,
    ownerId,
    savedAt: 1,
    display: [{ role: "user" }],
    history: [],
  });
  const storage = memoryStorage({ [aKey]: envelope("owner-a"), [bKey]: envelope("owner-b") });

  readOwnerBoundBankerSession(storage, "owner-a", { now: 10, ttlMs: 1 });
  assert.equal(storage.values.has(aKey), false);
  assert.equal(storage.values.has(bKey), true);

  clearOwnerBoundBankerSession(storage, "owner-b");
  assert.equal(storage.values.has(bKey), false);
});

test("Griphook turns and Clear remain exclusive after the Money page unmounts", () => {
  const ownerId = "owner-exclusive";
  const storage = memoryStorage({ [ownerBoundBankerSessionKey(ownerId)]: "saved" });
  const finishTurn = beginOwnerBoundBankerTurn(ownerId);

  assert.throws(() => beginOwnerBoundBankerTurn(ownerId), /already working/i);
  assert.throws(() => prepareOwnerBoundBankerClear(ownerId), /still working/i);
  finishTurn();
  finishTurn(); // settlement is idempotent

  const preparation = prepareOwnerBoundBankerClear(ownerId);
  assert.throws(() => beginOwnerBoundBankerTurn(ownerId), /being cleared/i);
  clearOwnerBoundBankerSession(storage, ownerId, preparation);
  assert.equal(storage.values.has(ownerBoundBankerSessionKey(ownerId)), false);

  const laterTurn = beginOwnerBoundBankerTurn(ownerId);
  laterTurn();
});

test("a cancelled global preflight releases Griphook for later work", () => {
  const ownerId = "owner-cancelled-clear";
  const preparation = prepareOwnerBoundBankerClear(ownerId);
  cancelOwnerBoundBankerClear(preparation);
  const finishTurn = beginOwnerBoundBankerTurn(ownerId);
  finishTurn();
});

test("a remounted Money view observes later checkpoints from the older turn", () => {
  const ownerId = "owner-remount";
  const storage = memoryStorage();
  const observed = [];
  const unsubscribe = subscribeOwnerBoundBankerSession(ownerId, () => {
    observed.push(readOwnerBoundBankerSession(storage, ownerId, { now: 3 }));
  });

  writeOwnerBoundBankerSession(storage, ownerId, {
    display: [{ role: "user", text: "accepted" }],
    history: [{ role: "user", content: "accepted" }, { role: "assistant", content: "interrupted checkpoint" }],
  }, 1);
  writeOwnerBoundBankerSession(storage, ownerId, {
    display: [{ role: "user", text: "accepted" }, { role: "banker", text: "finished" }],
    history: [{ role: "user", content: "accepted" }, { role: "assistant", content: "finished" }],
  }, 2);

  assert.equal(observed.length, 2);
  assert.equal(observed[1].display.at(-1).text, "finished");
  assert.equal(observed[1].history.at(-1).content, "finished");

  unsubscribe();
  writeOwnerBoundBankerSession(storage, ownerId, {
    display: [{ role: "user", text: "later" }],
    history: [{ role: "user", content: "later" }],
  }, 3);
  assert.equal(observed.length, 2, "an unmounted view receives no later owner updates");
});

test("Griphook Clear publishes the empty owner snapshot", () => {
  const ownerId = "owner-clear-publish";
  const storage = memoryStorage();
  writeOwnerBoundBankerSession(storage, ownerId, {
    display: [{ role: "user", text: "private" }],
    history: [{ role: "user", content: "private" }],
  }, 1);
  let latest = null;
  const unsubscribe = subscribeOwnerBoundBankerSession(ownerId, () => {
    latest = readOwnerBoundBankerSession(storage, ownerId, { now: 2 });
  });
  const preparation = prepareOwnerBoundBankerClear(ownerId);
  clearOwnerBoundBankerSession(storage, ownerId, preparation);
  assert.deepEqual(latest.display, []);
  assert.deepEqual(latest.history, []);
  unsubscribe();
});

test("a successful retry restores Griphook after a transient storage failure", () => {
  const ownerId = "owner-retry";
  const storage = memoryStorage();
  const originalSet = storage.setItem;
  let attempts = 0;
  storage.setItem = (key, value) => {
    attempts += 1;
    if (attempts === 1) throw new Error("temporary quota error");
    originalSet(key, value);
  };
  const snapshot = {
    display: [{ role: "user", text: "keep this" }],
    history: [{ role: "user", content: "keep this" }],
  };

  const failed = persistOwnerBoundBankerSnapshot(storage, ownerId, snapshot, 1);
  assert.deepEqual(failed, {
    saved: false,
    writable: false,
    warning: "Griphook's conversation isn't saving: temporary quota error",
  });

  const recovered = persistOwnerBoundBankerSnapshot(storage, ownerId, snapshot, 2);
  assert.deepEqual(recovered, { saved: true, writable: true, warning: "" });
  assert.deepEqual(readOwnerBoundBankerSession(storage, ownerId, { now: 3 }), {
    ...snapshot,
    warning: "",
    writable: true,
  });
});
