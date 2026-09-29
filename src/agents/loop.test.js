import assert from "node:assert/strict";
import {
  callClaude,
  executeToolBatchWithCheckpoints,
  isRestartableUserTurn,
  toolBatchCheckpointHistory,
  trimHistory,
} from "./loop.js";

const u = (content) => ({ role: "user", content });
const a = (content) => ({ role: "assistant", content });
const toolUse = (id = "t1") => a([{ type: "tool_use", id, name: "x", input: {} }]);
const toolResult = (id = "t1", extra = []) => u([{ type: "tool_result", tool_use_id: id, content: "x".repeat(400) }, ...extra]);
const big = (n) => "y".repeat(n);

/** Every trimmed history must open on a clean user turn — never an assistant
 *  turn, never a user turn carrying tool_results (orphaned results). */
const assertSane = (out, label) => {
  assert.ok(out.length > 0, `${label}: empty`);
  assert.equal(out[0].role, "user", `${label}: starts with ${out[0].role}`);
  assert.ok(isRestartableUserTurn(out[0]), `${label}: starts on a tool_result turn`);
};

// Under budget: untouched.
{
  const msgs = [u("hi"), a("hello")];
  assert.equal(trimHistory(msgs, 1000), msgs);
}

// Over budget with string turns: drops from the front and lands on a user turn.
{
  const msgs = [u(big(500)), a(big(500)), u(big(500)), a(big(500)), u("last"), a("ok")];
  const out = trimHistory(msgs, 1300);
  assert.ok(out.length < msgs.length);
  assertSane(out, "string turns");
}

// Tail full of tool exchanges after the cut: fall BACK to the last clean user
// turn before the cut rather than slicing to a tool_result/assistant turn.
{
  const msgs = [u(big(500)), toolUse("t1"), toolResult("t1"), toolUse("t2"), toolResult("t2"), a("done")];
  const out = trimHistory(msgs, 900);
  assertSane(out, "tool tail");
  assert.equal(out.length, msgs.length, "only clean turn is the first: keep everything");
}

// History whose only clean user turn is the first, with a later clean turn
// available: slice to the later one.
{
  const msgs = [u(big(600)), toolUse("t1"), toolResult("t1"), a("r1"), u("follow-up"), toolUse("t2"), toolResult("t2"), a("r2")];
  const out = trimHistory(msgs, 1400);
  assertSane(out, "later clean turn");
  assert.equal(out[0].content, "follow-up");
}

// A user turn whose content is an array with a text block counts as restartable.
{
  const msgs = [u(big(800)), a("r1"), u([{ type: "image", source: {} }, { type: "text", text: "see this" }]), a("r2"), u("q"), a("r3")];
  const out = trimHistory(msgs, 400);
  assertSane(out, "image+text turn");
}

// [handoff] / [system] text riding on a tool_result turn does NOT make it clean.
{
  const handoff = toolResult("t1", [{ type: "text", text: "[handoff] Sam is taking over." }]);
  const system = toolResult("t2", [{ type: "text", text: "[system] Stop calling tools now." }]);
  assert.equal(isRestartableUserTurn(handoff), false);
  assert.equal(isRestartableUserTurn(system), false);
  const msgs = [u(big(600)), toolUse("t1"), handoff, toolUse("t2"), system, a("done")];
  const out = trimHistory(msgs, 900);
  assertSane(out, "handoff tail");
  assert.equal(out[0].content, msgs[0].content);
}

// Mixed: an older clean turn is dropped, a later one after the cut wins.
{
  const msgs = [u(big(700)), a("r1"), toolUse("t1"), toolResult("t1"), a("r2"), u("second"), a("r3"), u("third"), a("r4")];
  const out = trimHistory(msgs, 900);
  assertSane(out, "mixed");
  assert.ok(["second", "third"].includes(out[0].content));
  // no orphaned tool_result anywhere in the output
  const orphan = out.findIndex((m, i) => i === 0 && Array.isArray(m.content) && m.content.some((b) => b.type === "tool_result"));
  assert.equal(orphan, -1);
}

// tool_result-only user turns are not restartable; empty arrays are not either.
assert.equal(isRestartableUserTurn(toolResult()), false);
assert.equal(isRestartableUserTurn(u([])), false);
assert.equal(isRestartableUserTurn(u("x")), true);
assert.equal(isRestartableUserTurn(a("x")), false);

// A captured-owner resolver fails before any private request is transmitted.
{
  const originalFetch = globalThis.fetch;
  let fetches = 0;
  globalThis.fetch = async () => { fetches += 1; throw new Error("should not fetch"); };
  try {
    await assert.rejects(
      callClaude({ messages: [] }, {}, { resolveHeaders: async () => { throw new Error("owner changed"); } }),
      /owner changed/,
    );
    assert.equal(fetches, 0);
  } finally {
    globalThis.fetch = originalFetch;
  }
}

// Every model request resolves fresh auth instead of reusing the first token.
{
  const originalFetch = globalThis.fetch;
  let resolved = 0;
  const sent = [];
  globalThis.fetch = async (_url, options) => {
    sent.push(options.headers.Authorization);
    return {
      ok: true,
      status: 200,
      url: "/api/chat",
      headers: { get: () => "application/json" },
      text: async () => JSON.stringify({ content: [] }),
    };
  };
  try {
    const resolveHeaders = async () => ({ Authorization: `Bearer fresh-${++resolved}` });
    await callClaude({ messages: [] }, {}, { resolveHeaders });
    await callClaude({ messages: [] }, {}, { resolveHeaders });
    assert.deepEqual(sent, ["Bearer fresh-1", "Bearer fresh-2"]);
  } finally {
    globalThis.fetch = originalFetch;
  }
}

const toolBlocks = [
  { type: "tool_use", id: "tool-1", name: "first_write", input: {} },
  { type: "tool_use", id: "tool-2", name: "second_write", input: {} },
];
const baseHistory = [u("make both changes")];

// A partial checkpoint always balances every tool_use and marks uncertainty.
{
  const history = toolBatchCheckpointHistory({
    baseHistory,
    assistantContent: toolBlocks,
    toolBlocks,
    activeIndex: 0,
  });
  const results = history.at(-1).content;
  assert.equal(results.length, 2);
  assert.equal(results[0].tool_use_id, "tool-1");
  assert.match(results[0].content, /outcome was not durably confirmed/i);
  assert.match(results[1].content, /was not started/i);
}

// Production's shared batch runner cannot execute even tool one until the
// write-ahead checkpoint succeeds.
{
  let executions = 0;
  await assert.rejects(executeToolBatchWithCheckpoints({
    baseHistory,
    assistantContent: toolBlocks,
    toolBlocks,
    checkpoint: async () => { throw new Error("database offline"); },
    execute: async () => { executions += 1; return { success: true }; },
  }), /could not be saved/i);
  assert.equal(executions, 0);
}

// Tool one must be durably confirmed before tool two can start.
{
  const events = [];
  await assert.rejects(executeToolBatchWithCheckpoints({
    baseHistory,
    assistantContent: toolBlocks,
    toolBlocks,
    checkpoint: async (_history, details) => {
      events.push(`checkpoint:${details.stage}:${details.index}`);
      if (details.stage === "after" && details.index === 0) throw new Error("save denied");
    },
    execute: async (block) => { events.push(`tool:${block.id}`); return { success: true }; },
  }), /could not be saved/i);
  assert.deepEqual(events, ["checkpoint:before:0", "tool:tool-1", "checkpoint:after:0"]);
}

// A nested consultant's partial history is awaited and stored in the parent
// tool result before that consultant can continue to its next model request.
{
  const events = [];
  const oneConsult = [{ type: "tool_use", id: "consult-1", name: "consult_banker", input: {} }];
  await executeToolBatchWithCheckpoints({
    baseHistory,
    assistantContent: oneConsult,
    toolBlocks: oneConsult,
    checkpoint: async (history, details) => {
      events.push(`checkpoint:${details.stage}`);
      if (details.stage === "progress") assert.match(history.at(-1).content[0].content, /nested write complete/);
    },
    execute: async (_block, checkpointProgress) => {
      events.push("nested:write");
      await checkpointProgress({ status: "in_progress", history: ["nested write complete"] });
      events.push("nested:next-model");
      return { success: true };
    },
  });
  assert.deepEqual(events, [
    "checkpoint:before",
    "nested:write",
    "checkpoint:progress",
    "nested:next-model",
    "checkpoint:after",
  ]);
}

console.log("loop.test.js: loop, auth and checkpoint tests passed");
