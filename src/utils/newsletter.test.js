import { test } from "node:test";
import assert from "node:assert/strict";
import { validateEmail, subscribe, isDuplicateError } from "./newsletter.js";

const fakeClient = (result, calls = []) => ({
  from(table) {
    return { insert(row) { calls.push({ table, row }); return typeof result === "function" ? result() : Promise.resolve(result); } };
  },
});

test("validateEmail trims and accepts a normal address", () => {
  assert.deepEqual(validateEmail("  a@b.co "), { ok: true, email: "a@b.co" });
});

test("validateEmail rejects empty and malformed input with a message", () => {
  for (const bad of ["", "   ", "scott", "a@b", "a b@c.com", "@b.com", null]) {
    const v = validateEmail(bad);
    assert.equal(v.ok, false, String(bad));
    assert.ok(v.error.length > 0);
  }
});

test("subscribe inserts email + source, without asking for the row back", async () => {
  const calls = [];
  const r = await subscribe(fakeClient({ error: null, status: 201 }, calls), " x@y.com ", "footer");
  assert.deepEqual(r, { status: "subscribed" });
  assert.deepEqual(calls, [{ table: "newsletter_signups", row: { email: "x@y.com", source: "footer" } }]);
});

test("a duplicate (23505 / 409) is the friendly 'already' success", async () => {
  assert.deepEqual(await subscribe(fakeClient({ error: { code: "23505", message: "duplicate key value" }, status: 409 }), "x@y.com"), { status: "already" });
  assert.deepEqual(await subscribe(fakeClient({ error: { message: "Conflict" }, status: 409 }), "x@y.com"), { status: "already" });
  assert.equal(isDuplicateError(null), false);
});

test("any other failure throws a readable error — never a fake success", async () => {
  await assert.rejects(subscribe(fakeClient({ error: { code: "42501", message: "permission denied" }, status: 401 }), "x@y.com"), /Sign-up failed: permission denied/);
  await assert.rejects(subscribe(fakeClient(() => Promise.reject(new Error("Failed to fetch"))), "x@y.com"), /Couldn't reach/);
  await assert.rejects(subscribe(fakeClient({ error: { message: "TypeError: Failed to fetch" }, status: 0 }), "x@y.com"), /Couldn.t reach/);
  await assert.rejects(subscribe(fakeClient({ error: null }), "nope"), /doesn.t look like an email/);
});
