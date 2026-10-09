import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createAgentSessionsStore,
  createOwnerScopedSessionReader,
} from "./agentSessionsCore.js";
import { createSessionHistoryGate } from "../utils/chatSessionPolicy.js";

const deferred = () => {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
};

const baseStore = (overrides = {}) => createAgentSessionsStore({
  getUserId: async () => "owner-1",
  selectRows: async () => ({ data: [] }),
  upsertRow: async () => ({ error: null }),
  deleteRow: async () => ({ error: null }),
  now: () => "2026-09-29T00:00:00.000Z",
  ...overrides,
});

test("session load requires authentication instead of silently returning an empty map", async () => {
  let queried = false;
  const store = baseStore({
    getUserId: async () => { throw new Error("Not authenticated"); },
    selectRows: async () => { queried = true; return { data: [] }; },
  });

  await assert.rejects(store.load(), /Couldn't load chat history: Not authenticated/);
  assert.equal(queried, false);
});

test("session save and clear expose authentication failures", async () => {
  const store = baseStore({ getUserId: async () => { throw new Error("Not authenticated"); } });
  await assert.rejects(store.save("frodo", { display: [], convo: [] }), /isn't saving \(frodo\): Not authenticated/);
  await assert.rejects(store.clear("frodo"), /Couldn't clear chat history \(frodo\): Not authenticated/);
});

test("load maps rows and exposes database failures", async () => {
  const store = baseStore({
    selectRows: async () => ({
      data: [{ agent_id: "frodo", display: [{ role: "user" }], convo: null }],
    }),
  });
  assert.deepEqual(await store.load(), {
    frodo: { display: [{ role: "user" }], convo: [] },
  });

  const failing = baseStore({ selectRows: async () => ({ error: { message: "database offline" } }) });
  await assert.rejects(failing.load(), /Couldn't load chat history: database offline/);

  const malformed = baseStore({ selectRows: async () => ({ data: { future: "shape" } }) });
  await assert.rejects(malformed.load(), /session store returned an unsupported response/);
});

test("Frodo reloads its persisted tier-handoff display note", async () => {
  const note = { role: "note", text: "Frodo passed this to Gandalf — tool budget reached." };
  const store = baseStore({
    selectRows: async () => ({
      data: [{ agent_id: "frodo", display: [note], convo: [] }],
    }),
  });

  const sessions = await store.load();
  assert.equal(sessions.frodo.display[0], note);
});

test("session read cache is isolated by the owner captured before lookup", async () => {
  let owner = "owner-a";
  const queries = [];
  const cache = new Map();
  const store = baseStore({
    getUserId: async () => owner,
    selectRows: async (userId) => {
      queries.push(userId);
      return {
        data: [{
          agent_id: "frodo",
          display: [{ role: "user", text: `${userId} private transcript` }],
          convo: [],
        }],
      };
    },
  });
  const read = createOwnerScopedSessionReader({
    captureOwner: store.captureLoadOwner,
    loadForOwner: store.loadForOwner,
    cacheRead: (key, _collection, load) => {
      if (!cache.has(key)) cache.set(key, Promise.resolve().then(load));
      return cache.get(key);
    },
  });

  const firstOwner = await read();
  owner = "owner-b";
  const secondOwner = await read();

  assert.equal(firstOwner.frodo.display[0].text, "owner-a private transcript");
  assert.equal(secondOwner.frodo.display[0].text, "owner-b private transcript");
  assert.deepEqual(queries, ["owner-a", "owner-b"]);
});

test("malformed stored history fails closed before the chat becomes writable", async () => {
  let writes = 0;
  const store = baseStore({
    selectRows: async () => ({
      data: [{ agent_id: "frodo", display: { future: "shape" }, convo: [] }],
    }),
    upsertRow: async () => { writes += 1; return { error: null }; },
  });

  await assert.rejects(
    store.load(),
    /stored display history has an unsupported format; no data was changed/,
  );
  assert.equal(writes, 0);

  const malformedConvo = baseStore({
    selectRows: async () => ({
      data: [{ agent_id: "frodo", display: [], convo: { future: "shape" } }],
    }),
  });
  await assert.rejects(malformedConvo.load(), /stored model history has an unsupported format/);
});

test("nested null and primitive history messages fail closed without a write", async () => {
  for (const [field, invalidMessage] of [
    ["display", null],
    ["display", "future display encoding"],
    ["convo", null],
    ["convo", "future model encoding"],
  ]) {
    let writes = 0;
    const row = { agent_id: "frodo", display: [], convo: [] };
    row[field] = [{ role: "user", text: "valid prefix" }, invalidMessage];
    const store = baseStore({
      selectRows: async () => ({ data: [row] }),
      upsertRow: async () => { writes += 1; return { error: null }; },
    });

    await assert.rejects(store.load(), new RegExp(`stored ${field === "display" ? "display" : "model"} history contains an unsupported message`));
    assert.equal(writes, 0, `${field} validation must fail before history becomes writable`);
  }
});

test("invalid model content keeps hydration locked and performs zero writes", async () => {
  for (const content of [
    null,
    { future: "unsupported container" },
    [null],
    ["unsupported block"],
  ]) {
    let writes = 0;
    const gate = createSessionHistoryGate();
    gate.begin();
    const store = baseStore({
      selectRows: async () => ({
        data: [{
          agent_id: "frodo",
          display: [{ role: "user", text: "safe" }],
          convo: [{ role: "assistant", content }],
        }],
      }),
      upsertRow: async () => { writes += 1; return { error: null }; },
    });

    try {
      await store.load();
      gate.ready();
      assert.fail("invalid model content unexpectedly hydrated");
    } catch (error) {
      gate.fail();
      assert.match(error.message, /stored model history contains an unsupported message/);
    }
    assert.equal(gate.canUse(), false);
    assert.equal(gate.needsRetry(), true);
    assert.equal(writes, 0);
  }
});

test("invalid durable roles and malformed model blocks fail closed", async () => {
  for (const row of [
    { agent_id: "frodo", display: [{ role: "future", text: "private" }], convo: [] },
    { agent_id: "frodo", display: [], convo: [{ role: "future", content: "private" }] },
    { agent_id: "frodo", display: [], convo: [{ role: "user", content: [{ payload: "missing type" }] }] },
    { agent_id: "frodo", display: [], convo: [{ role: "user", content: ["bad block"] }] },
  ]) {
    const store = baseStore({ selectRows: async () => ({ data: [row] }) });
    await assert.rejects(store.load(), /contains an unsupported message/);
  }
});

test("valid history messages preserve forward-compatible unknown fields", async () => {
  const displayMessage = {
    role: "assistant",
    text: "kept",
    future_display_metadata: { renderer: 7 },
  };
  const convoMessage = {
    role: "assistant",
    content: [{ type: "future_content", payload: { version: 4 } }],
    future_model_metadata: ["kept"],
  };
  const store = baseStore({
    selectRows: async () => ({
      data: [{ agent_id: "frodo", display: [displayMessage], convo: [convoMessage] }],
    }),
  });

  const sessions = await store.load();
  assert.equal(sessions.frodo.display[0], displayMessage);
  assert.equal(sessions.frodo.convo[0], convoMessage);
  assert.deepEqual(sessions.frodo, {
    display: [displayMessage],
    convo: [convoMessage],
  });
});

test("saves for one agent execute in call order", async () => {
  const first = deferred();
  const second = deferred();
  const firstStarted = deferred();
  const secondStarted = deferred();
  const started = [];
  const store = baseStore({
    upsertRow: async (row) => {
      started.push(row.display[0]);
      if (row.display[0] === "older") {
        firstStarted.resolve();
        return first.promise;
      }
      secondStarted.resolve();
      return second.promise;
    },
  });

  const older = store.save("frodo", { display: ["older"], convo: [] });
  const newer = store.save("frodo", { display: ["newer"], convo: [] });
  await firstStarted.promise;
  assert.deepEqual(started, ["older"]);

  first.resolve({ error: null });
  await older;
  await secondStarted.promise;
  assert.deepEqual(started, ["older", "newer"]);
  second.resolve({ error: null });
  await newer;
});

test("a failed save does not poison the next save", async () => {
  let calls = 0;
  const store = baseStore({
    upsertRow: async () => (++calls === 1
      ? { error: { message: "temporary failure" } }
      : { error: null }),
  });

  const first = store.save("frodo", { display: [1], convo: [] });
  const second = store.save("frodo", { display: [2], convo: [] });
  await assert.rejects(first, /temporary failure/);
  await second;
  assert.equal(calls, 2);
});

test("clear waits for an older save so deletion is terminal", async () => {
  const saveGate = deferred();
  const saveStarted = deferred();
  const clearStarted = deferred();
  const events = [];
  const store = baseStore({
    upsertRow: async () => { events.push("save:start"); saveStarted.resolve(); await saveGate.promise; events.push("save:end"); return { error: null }; },
    deleteRow: async () => { events.push("clear"); clearStarted.resolve(); return { error: null }; },
  });

  const save = store.save("frodo", { display: [1], convo: [] });
  const clear = store.clear("frodo");
  await saveStarted.promise;
  assert.deepEqual(events, ["save:start"]);
  saveGate.resolve();
  await clearStarted.promise;
  await Promise.all([save, clear]);
  assert.deepEqual(events, ["save:start", "save:end", "clear"]);
});

test("different agents are not blocked by each other's saves", async () => {
  const frodoGate = deferred();
  const started = [];
  const store = baseStore({
    upsertRow: async (row) => {
      started.push(row.agent_id);
      if (row.agent_id === "frodo") await frodoGate.promise;
      return { error: null };
    },
  });

  const frodo = store.save("frodo", { display: [], convo: [] });
  const sam = store.save("sam:cc", { display: [], convo: [] });
  await sam;
  assert.deepEqual(started, ["frodo", "sam:cc"]);
  frodoGate.resolve();
  await frodo;
});

test("queued mutations retain the owner captured at their call boundary", async () => {
  let owner = "old-owner";
  const rows = [];
  const deletes = [];
  const store = baseStore({
    getUserId: () => Promise.resolve(owner),
    upsertRow: async (row) => { rows.push(row); return { error: null }; },
    deleteRow: async (userId, agentId) => { deletes.push([userId, agentId]); return { error: null }; },
  });

  const oldSave = store.save("frodo", { display: ["old conversation"], convo: [] });
  owner = "new-owner";
  const newSave = store.save("frodo", { display: ["new conversation"], convo: [] });
  await Promise.all([oldSave, newSave]);
  assert.deepEqual(rows.map((row) => [row.user_id, row.display[0]]), [
    ["old-owner", "old conversation"],
    ["new-owner", "new conversation"],
  ]);

  owner = "old-owner";
  const oldClear = store.clear("frodo");
  owner = "new-owner";
  await oldClear;
  assert.deepEqual(deletes, [["old-owner", "frodo"]]);
});

test("deferred auth drift rejects A-started session work before any B query or mutation", async () => {
  for (const action of ["load", "save", "clear"]) {
    let establishedOwner = "owner-a";
    const auth = deferred();
    const calls = { select: 0, upsert: 0, delete: 0 };
    const store = baseStore({
      captureOwnerId: () => establishedOwner,
      getUserId: () => auth.promise,
      verifyOwnerId: async (ownerId) => ownerId,
      selectRows: async () => { calls.select += 1; return { data: [] }; },
      upsertRow: async () => { calls.upsert += 1; return { error: null }; },
      deleteRow: async () => { calls.delete += 1; return { error: null }; },
    });

    const operation = action === "load"
      ? store.load()
      : action === "save"
        ? store.save("frodo", { display: [], convo: [] })
        : store.clear("frodo");
    establishedOwner = "owner-b";
    auth.resolve("owner-b");

    await assert.rejects(operation, /authenticated owner changed/);
    assert.deepEqual(calls, { select: 0, upsert: 0, delete: 0 }, `${action} must fail before touching B's rows`);
  }
});

test("owner drift while queued aborts immediately before the session write", async () => {
  let establishedOwner = "owner-a";
  const verify = deferred();
  let writes = 0;
  const store = baseStore({
    captureOwnerId: () => establishedOwner,
    getUserId: async (expectedOwnerId) => expectedOwnerId,
    verifyOwnerId: async () => verify.promise,
    upsertRow: async () => { writes += 1; return { error: null }; },
  });

  const save = store.save("frodo", { display: [{ role: "user" }], convo: [] });
  establishedOwner = "owner-b";
  verify.resolve("owner-b");

  await assert.rejects(save, /authenticated owner changed/);
  assert.equal(writes, 0);
});

test("mutation cache hooks invalidate both before enqueue and after settlement", async () => {
  const gate = deferred();
  const started = deferred();
  const events = [];
  const store = baseStore({
    onMutationStart: () => events.push("invalidate:start"),
    onMutationSettled: () => events.push("invalidate:settled"),
    upsertRow: async () => { events.push("write:start"); started.resolve(); await gate.promise; return { error: null }; },
  });

  const save = store.save("frodo", { display: [], convo: [] });
  await started.promise;
  events.push("read:cached-while-write-pending");
  gate.resolve();
  await save;
  assert.deepEqual(events, [
    "invalidate:start",
    "write:start",
    "read:cached-while-write-pending",
    "invalidate:settled",
  ]);
});

test("load waits for an earlier owner save before querying hydrated history", async () => {
  const saveGate = deferred();
  const saveStarted = deferred();
  const barrierReached = deferred();
  const events = [];
  const store = baseStore({
    upsertRow: async () => {
      events.push("save:start");
      saveStarted.resolve();
      await saveGate.promise;
      events.push("save:end");
      return { error: null };
    },
    selectRows: async () => {
      events.push("load:query");
      return { data: [] };
    },
    onLoadBarrier: ({ pendingCount }) => {
      events.push(`load:barrier:${pendingCount}`);
      barrierReached.resolve();
    },
  });

  const save = store.save("frodo", { display: ["latest"], convo: [] });
  await saveStarted.promise;
  const load = store.load();
  await barrierReached.promise;
  assert.deepEqual(events, ["save:start", "load:barrier:1"]);

  saveGate.resolve();
  await Promise.all([save, load]);
  assert.deepEqual(events, ["save:start", "load:barrier:1", "save:end", "load:query"]);
});
