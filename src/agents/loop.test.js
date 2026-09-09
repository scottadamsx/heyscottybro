import assert from "node:assert/strict";
import { trimHistory, isRestartableUserTurn } from "./loop.js";

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

console.log("loop.test.js: all trimHistory tests passed");
