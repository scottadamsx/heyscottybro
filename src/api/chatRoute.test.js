import test from "node:test";
import assert from "node:assert/strict";
import { handleChatRoute } from "../../api/chat.js";

function response() {
  return {
    statusCode: 200,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };
}

test("GET status is authenticated and reports only feature availability", async () => {
  const denied = response();
  await handleChatRoute({ method: "GET" }, denied, { verify: async () => false });
  assert.equal(denied.statusCode, 401);

  const allowed = response();
  await handleChatRoute({ method: "GET" }, allowed, {
    verify: async () => true,
    status: () => ({ available: true }),
    draftStatus: () => ({ available: false }),
  });
  assert.deepEqual(allowed.body, { journalCleanup: { available: true }, eventDrafting: { available: false } });
});

test("event draft requests dispatch only to the dedicated handler", async () => {
  let received;
  const res = response();
  await handleChatRoute({ method: "POST", body: JSON.stringify({ feature: "event_draft", description: "Dinner tomorrow" }) }, res, {
    draft: async (req, responseObject) => { received = req.body; return responseObject.status(202).json({ accepted: true }); },
  });
  assert.deepEqual(received, { feature: "event_draft", description: "Dinner tomorrow" });
  assert.equal(res.statusCode, 202);
});

test("journal cleanup operation dispatches to its guarded handler", async () => {
  let received;
  const res = response();
  await handleChatRoute({ method: "POST", body: JSON.stringify({ feature: "journal_cleanup", text: "private" }) }, res, {
    cleanup: async (req, responseObject) => { received = req.body; return responseObject.status(204).json({}); },
  });
  assert.deepEqual(received, { feature: "journal_cleanup", text: "private" });
  assert.equal(res.statusCode, 204);
});

test("existing generic proxy requests remain untouched", async () => {
  const original = { method: "POST", body: { model: "existing", messages: [] } };
  let received;
  const res = response();
  await handleChatRoute(original, res, {
    proxy: async (req, responseObject) => { received = req; return responseObject.status(202).json({ proxied: true }); },
  });
  assert.equal(received, original);
  assert.deepEqual(res.body, { proxied: true });
});
