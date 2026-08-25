import assert from "node:assert/strict";
import { trimHistory, isRestartableUserTurn } from "./loop.js";

const u = (content) => ({ role: "user", content });
const a = (content) => ({ role: "assistant", content });
const toolResult = () => u([{ type: "tool_result", tool_use_id: "t1", content: "x".repeat(400) }]);
const big = (n) => "y".repeat(n);

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
  assert.equal(out[0].role, "user");
  assert.ok(isRestartableUserTurn(out[0]));
}

// Over budget with ONLY tool-exchange turns after the cut: must NOT collapse to
// the last message (the old bug) — falls back to the budget slice.
{
  const msgs = [u(big(500)), a([{ type: "tool_use", id: "t1", name: "x", input: {} }]), toolResult(), a([{ type: "tool_use", id: "t2", name: "x", input: {} }]), toolResult(), a("done")];
  const out = trimHistory(msgs, 900);
  assert.ok(out.length >= 2, `collapsed to ${out.length} message(s)`);
}

// A user turn whose content is an array with a text block counts as restartable.
{
  const msgs = [u(big(800)), a("r1"), u([{ type: "image", source: {} }, { type: "text", text: "see this" }]), a("r2"), u("q"), a("r3")];
  const out = trimHistory(msgs, 400);
  assert.equal(out[0].role, "user");
  assert.ok(Array.isArray(out[0].content) || typeof out[0].content === "string");
  assert.ok(isRestartableUserTurn(out[0]));
}

// tool_result-only user turns are not restartable.
assert.equal(isRestartableUserTurn(toolResult()), false);
assert.equal(isRestartableUserTurn(u("x")), true);

console.log("loop.test.js: all trimHistory tests passed");
