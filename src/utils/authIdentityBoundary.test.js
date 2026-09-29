import { test } from "node:test";
import assert from "node:assert/strict";
import {
  bindEstablishedOwnerId,
  captureEstablishedOwnerId,
  ownerIdFromSession,
  protectedAuthTransition,
  resolveOwnerBoundAuthHeaders,
  runOwnerBoundOperation,
  verifyEstablishedOwnerId,
} from "./authIdentityBoundary.js";

const session = (id) => ({ user: { id } });

test("direct account replacement clears render identity and terminates the old runtime", () => {
  assert.deepEqual(protectedAuthTransition("owner-a", session("owner-b")), {
    action: "reload",
    ownerId: null,
    status: "loading",
  });
});

test("identity loss reloads but same-owner token refresh stays mounted", () => {
  assert.equal(protectedAuthTransition("owner-a", null).action, "reload");
  assert.deepEqual(protectedAuthTransition("owner-a", session("owner-a")), {
    action: "render",
    ownerId: "owner-a",
    status: "authed",
  });
});

test("initial signed-in and signed-out states render without a reload", () => {
  assert.equal(ownerIdFromSession(session("owner-a")), "owner-a");
  assert.deepEqual(protectedAuthTransition(undefined, session("owner-a")), {
    action: "render",
    ownerId: "owner-a",
    status: "authed",
  });
  assert.deepEqual(protectedAuthTransition(undefined, null), {
    action: "render",
    ownerId: null,
    status: "unauthed",
  });
});

test("an operation captures one established owner and rejects later auth drift", () => {
  bindEstablishedOwnerId("owner-a");
  const captured = captureEstablishedOwnerId();
  assert.equal(verifyEstablishedOwnerId(captured, "owner-a"), "owner-a");

  bindEstablishedOwnerId("owner-b");
  assert.throws(
    () => verifyEstablishedOwnerId(captured, "owner-b"),
    /authenticated owner changed.*cancelled/i,
  );
  bindEstablishedOwnerId(null);
  assert.throws(() => captureEstablishedOwnerId(), /owner is not established/i);
});

for (const kind of ["read", "write"]) {
  test(`a deferred owner check blocks a ${kind} tool side effect after account drift`, async () => {
    let release;
    const verified = new Promise((resolve) => { release = resolve; });
    let sideEffects = 0;
    const operation = runOwnerBoundOperation(
      "owner-a",
      async () => verified,
      async () => { sideEffects += 1; return kind; },
    );

    release("owner-b");
    await assert.rejects(operation, /authenticated owner changed.*cancelled/i);
    assert.equal(sideEffects, 0);
  });
}

test("private request headers are released only for the captured owner", async () => {
  bindEstablishedOwnerId("owner-a");
  const headers = await resolveOwnerBoundAuthHeaders("owner-a", async () => ({
    data: { session: { user: { id: "owner-a" }, access_token: "token-a" } },
    error: null,
  }));
  assert.deepEqual(headers, { Authorization: "Bearer token-a" });

  bindEstablishedOwnerId("owner-b");
  await assert.rejects(
    resolveOwnerBoundAuthHeaders("owner-a", async () => ({
      data: { session: { user: { id: "owner-b" }, access_token: "token-b" } },
      error: null,
    })),
    /authenticated owner changed.*cancelled/i,
  );

  bindEstablishedOwnerId("owner-a");
  await assert.rejects(
    resolveOwnerBoundAuthHeaders("owner-a", async () => ({
      data: { session: { user: { id: "owner-a" } } },
      error: null,
    })),
    /no access token.*cancelled/i,
  );
  bindEstablishedOwnerId(null);
});
