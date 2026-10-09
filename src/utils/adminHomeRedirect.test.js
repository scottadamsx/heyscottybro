import test from "node:test";
import assert from "node:assert/strict";
import { adminHomeDestination } from "./adminHomeRedirect.js";

test("the home route redirects only an established authenticated session", () => {
  assert.equal(adminHomeDestination({ user: { id: "owner-1" } }), "/admin/today");
  assert.equal(adminHomeDestination(null), null);
  assert.equal(adminHomeDestination({}), null);
  assert.equal(adminHomeDestination({ user: {} }), null);
});
