import { test } from "node:test";
import assert from "node:assert/strict";
import {
  commitRuntimeThreadSnapshot,
  commandCenterThreadsFromSessions,
  createAgentRuntimeMutationGate,
  createAgentRuntimeSessionGate,
  persistRuntimeCheckpoint,
} from "./agentRuntimeSessionPolicy.js";

function createDeferredRenderHarness(initialThreads) {
  let currentThreads = initialThreads;
  let renderedThreads = initialThreads;
  const pendingRenders = [];
  const persisted = [];

  return {
    commit(agentId, update) {
      const result = commitRuntimeThreadSnapshot({
        currentThreads,
        agentId,
        ...update,
        publishThreads(nextThreads) {
          currentThreads = nextThreads;
          // Model React deferring the visible commit until after this call.
          pendingRenders.push(() => { renderedThreads = nextThreads; });
        },
        persistThread(id, thread) {
          persisted.push({ id, thread });
        },
      });
      return result;
    },
    rendered() { return renderedThreads; },
    persisted,
    flushRender() { pendingRenders.shift()?.(); },
  };
}

test("a delayed history load blocks the attempted first send from overwriting durable state", async () => {
  let releaseLoad;
  const delayedLoad = new Promise((resolve) => { releaseLoad = resolve; });
  const gate = createAgentRuntimeSessionGate();
  const durable = { display: ["stored owner thread"] };
  let visible = {};
  let saveCalls = 0;

  gate.begin();
  const hydration = delayedLoad.then((sessions) => {
    visible = commandCenterThreadsFromSessions(sessions);
    gate.ready();
  });

  if (gate.canMutate()) {
    saveCalls += 1;
    visible.frodo = { display: ["premature send"] };
  }
  assert.equal(saveCalls, 0);
  assert.deepEqual(durable.display, ["stored owner thread"]);

  releaseLoad({ "frodo:cc": durable });
  await hydration;
  assert.equal(gate.canMutate(), true);
  assert.deepEqual(visible.frodo.display, ["stored owner thread"]);
});

test("failed hydration remains locked until a successful retry", () => {
  const gate = createAgentRuntimeSessionGate();
  gate.begin();
  gate.fail();
  assert.equal(gate.canMutate(), false);
  gate.begin();
  assert.equal(gate.canMutate(), false);
  gate.ready();
  assert.equal(gate.canMutate(), true);
});

test("an agent Clear blocks same-thread sends, repeated Clear, and Overseer without blocking peers", () => {
  const gate = createAgentRuntimeMutationGate();
  assert.equal(gate.beginClear("galadriel"), true);
  assert.equal(gate.isClearing("galadriel"), true);
  assert.equal(gate.canMutate("galadriel"), false);
  assert.equal(gate.beginClear("galadriel"), false);
  assert.equal(gate.canMutate("banker"), true, "unrelated agent threads remain independent");
  gate.finishClear("galadriel");
  assert.equal(gate.canMutate("galadriel"), true);
});

test("only Command Center session keys hydrate runtime threads", () => {
  assert.deepEqual(commandCenterThreadsFromSessions({
    frodo: { display: ["floating"] },
    "frodo:cc": { display: ["command"] },
    "bilbo:cc": { display: ["archive"] },
  }), {
    frodo: { display: ["command"] },
    bilbo: { display: ["archive"] },
  });
});

test("completed agent turn persists its exact snapshot before a deferred render", async () => {
  const initial = {
    frodo: {
      convo: [{ role: "user", content: "hello" }],
      display: [{ role: "user", text: "hello" }],
    },
  };
  const history = [
    ...initial.frodo.convo,
    { role: "assistant", content: "hi" },
  ];
  const harness = createDeferredRenderHarness(initial);

  const result = harness.commit("frodo", {
    convo: history,
    displayMessage: { role: "assistant", text: "hi" },
  });
  await result.persistence;

  assert.equal(harness.rendered(), initial);
  assert.deepEqual(harness.persisted, [{ id: "frodo", thread: result.thread }]);
  assert.deepEqual(result.thread, {
    convo: history,
    display: [
      { role: "user", text: "hello" },
      { role: "assistant", text: "hi" },
    ],
  });
  harness.flushRender();
  assert.equal(harness.rendered(), result.threads);
});

test("failed agent turn persists committed history and its error before render", async () => {
  const initial = {
    banker: {
      convo: [{ role: "user", content: "reconcile" }],
      display: [{ role: "user", text: "reconcile" }],
    },
  };
  const partial = [
    ...initial.banker.convo,
    { role: "assistant", content: [{ type: "tool_use", id: "tool-1" }] },
    { role: "user", content: [{ type: "tool_result", tool_use_id: "tool-1", content: "done" }] },
    { role: "assistant", content: [{ type: "text", text: "(turn interrupted: offline)" }] },
  ];
  const harness = createDeferredRenderHarness(initial);

  const result = harness.commit("banker", {
    convo: partial,
    displayMessage: { role: "error", text: "offline" },
  });
  await result.persistence;

  assert.equal(harness.rendered(), initial);
  assert.deepEqual(harness.persisted[0], { id: "banker", thread: result.thread });
  assert.equal(result.thread.convo, partial);
  assert.deepEqual(result.thread.display.at(-1), { role: "error", text: "offline" });
});

test("completed Overseer turn persists the same snapshot published to React", async () => {
  const initial = {
    galadriel: {
      convo: [],
      display: [{ role: "user", text: "Run yesterday's summary." }],
    },
  };
  const history = [{ role: "assistant", content: "Summary filed." }];
  const harness = createDeferredRenderHarness(initial);

  const result = harness.commit("galadriel", {
    convo: history,
    displayMessage: { role: "assistant", text: "Summary filed." },
  });
  await result.persistence;

  assert.equal(harness.rendered(), initial);
  assert.equal(harness.persisted[0].thread, result.thread);
  assert.deepEqual(harness.persisted[0], {
    id: "galadriel",
    thread: {
      convo: history,
      display: [
        { role: "user", text: "Run yesterday's summary." },
        { role: "assistant", text: "Summary filed." },
      ],
    },
  });
});

test("failed Overseer turn preserves prior history and persists its error", async () => {
  const priorHistory = [{ role: "assistant", content: "Earlier summary." }];
  const initial = {
    galadriel: {
      convo: priorHistory,
      display: [{ role: "user", text: "Run yesterday's summary." }],
    },
  };
  const harness = createDeferredRenderHarness(initial);

  const result = harness.commit("galadriel", {
    displayMessage: { role: "error", text: "Overseer unavailable." },
  });
  await result.persistence;

  assert.equal(harness.rendered(), initial);
  assert.equal(result.thread.convo, priorHistory);
  assert.deepEqual(harness.persisted[0], {
    id: "galadriel",
    thread: {
      convo: priorHistory,
      display: [
        { role: "user", text: "Run yesterday's summary." },
        { role: "error", text: "Overseer unavailable." },
      ],
    },
  });
});

for (const surface of ["direct agent", "Overseer"]) {
  test(`${surface} persists a closed accepted turn before terminal work`, async () => {
    const persisted = [];
    const history = [{ role: "user", content: `${surface} request` }];
    const thread = { convo: history, display: [{ role: "user", text: `${surface} request` }] };

    const checkpoint = await persistRuntimeCheckpoint({
      agentId: surface === "Overseer" ? "galadriel" : "frodo",
      thread,
      history,
      persistThread: async (id, snapshot) => { persisted.push({ id, snapshot }); return true; },
    });

    assert.equal(persisted.length, 1);
    assert.equal(checkpoint.convo.at(-1).role, "assistant");
    assert.match(checkpoint.convo.at(-1).content[0].text, /turn interrupted before a reply/);
    assert.deepEqual(persisted[0].snapshot, checkpoint);
  });

  test(`${surface} persists every tool checkpoint in order before terminal settlement`, async () => {
    const events = [];
    const thread = { convo: [], display: [{ role: "user", text: "act" }] };
    const first = [
      { role: "user", content: "act" },
      { role: "assistant", content: [{ type: "tool_use", id: "one" }] },
      { role: "user", content: [{ type: "tool_result", tool_use_id: "one", content: "done one" }] },
    ];
    const second = [
      ...first,
      { role: "assistant", content: [{ type: "tool_use", id: "two" }] },
      { role: "user", content: [{ type: "tool_result", tool_use_id: "two", content: "done two" }] },
    ];
    const persistThread = async (_id, snapshot) => {
      events.push(snapshot);
      return true;
    };

    await persistRuntimeCheckpoint({ agentId: surface, thread, history: first, persistThread, note: "interrupted after tool one" });
    await persistRuntimeCheckpoint({ agentId: surface, thread, history: second, persistThread, note: "interrupted after tool two" });

    assert.equal(events.length, 2);
    assert.equal(events[0].convo.at(-2).content[0].content, "done one");
    assert.equal(events[1].convo.at(-2).content[0].content, "done two");
    assert.equal(events[0].convo.at(-1).role, "assistant");
    assert.equal(events[1].convo.at(-1).role, "assistant");
  });
}

for (const failedValue of [false, undefined, null]) {
  test(`runtime checkpoint rejects non-confirming save result ${String(failedValue)}`, async () => {
    let laterWork = 0;
    await assert.rejects(
      persistRuntimeCheckpoint({
        agentId: "frodo",
        thread: { convo: [], display: [] },
        history: [{ role: "user", content: "act" }],
        persistThread: async () => failedValue,
        phase: "Before first tool",
      }),
      /Before first tool could not be saved.*stopped before continuing/i,
    );
    assert.equal(laterWork, 0);
  });
}

test("runtime checkpoint propagates a rejected save and starts no later work", async () => {
  let laterWork = 0;
  await assert.rejects(
    persistRuntimeCheckpoint({
      agentId: "frodo",
      thread: { convo: [], display: [] },
      history: [{ role: "user", content: "act" }],
      persistThread: async () => { throw new Error("storage offline"); },
      phase: "Accepted turn",
    }),
    /storage offline/,
  );
  assert.equal(laterWork, 0);
});
