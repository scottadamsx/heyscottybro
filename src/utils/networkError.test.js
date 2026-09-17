import { test } from "node:test";
import assert from "node:assert/strict";
import { isNetworkError } from "./networkError.js";

test("fetch's own TypeErrors count", () => {
  assert.equal(isNetworkError(new TypeError("Load failed")), true);
  assert.equal(isNetworkError(new TypeError("Failed to fetch")), true);
});

test("supabase-js error objects wrapping a failed fetch count", () => {
  assert.equal(isNetworkError({ message: "TypeError: Load failed", details: "", hint: "", code: "" }), true);
  assert.equal(isNetworkError({ message: "TypeError: Failed to fetch" }), true);
  assert.equal(isNetworkError({ message: "FetchError: fetch failed" }), false);
  assert.equal(isNetworkError({ message: "TypeError: NetworkError when attempting to fetch resource." }), true);
});

test("real database answers are not retried", () => {
  assert.equal(isNetworkError({ message: "new row violates row-level security policy", code: "42501" }), false);
  assert.equal(isNetworkError({ message: "Could not find the 'duration_min' column", code: "PGRST204" }), false);
  assert.equal(isNetworkError(new TypeError("x is not a function")), false);
  assert.equal(isNetworkError(null), false);
});
