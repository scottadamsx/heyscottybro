import test, { beforeEach } from "node:test";
import assert from "node:assert/strict";
import {
  loadJournalCleanupStatus,
  requestJournalCleanup,
  resetJournalCleanupStatusCache,
} from "./journalCleanup.js";

beforeEach(resetJournalCleanupStatusCache);
const authHeaders = async () => ({ Authorization: "Bearer test" });
const jsonResponse = (body, ok = true, status = ok ? 200 : 500) => ({ ok, status, json: async () => body });

test("status fails closed and caches availability", async () => {
  let calls = 0;
  const request = async () => { calls += 1; return jsonResponse({ journalCleanup: { available: true } }); };
  assert.deepEqual(await loadJournalCleanupStatus({ request, authHeaders }), { available: true });
  assert.deepEqual(await loadJournalCleanupStatus({ request, authHeaders }), { available: true });
  assert.equal(calls, 1);
  resetJournalCleanupStatusCache();
  assert.deepEqual(await loadJournalCleanupStatus({ request: async () => { throw new Error("offline"); }, authHeaders }), { available: false });
});

test("cleanup sends only operation and body and validates the response", async () => {
  let sent;
  const result = await requestJournalCleanup("Private body", {
    authHeaders,
    request: async (_url, options) => {
      sent = JSON.parse(options.body);
      return jsonResponse({ cleanedText: "Private body.", provenance: { prompt: "journal-cleanup" } });
    },
  });
  assert.deepEqual(sent, { feature: "journal_cleanup", text: "Private body" });
  assert.equal(result.cleanedText, "Private body.");
  await assert.rejects(
    requestJournalCleanup("x", { authHeaders, request: async () => jsonResponse({ cleanedText: "" }) }),
    /invalid result/i,
  );
});
