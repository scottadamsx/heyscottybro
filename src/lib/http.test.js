import test from "node:test";
import assert from "node:assert/strict";
import { callClaude } from "../agents/loop.js";
import { parseJsonResponse, readJsonOrThrow } from "./http.js";

function response({ body = "", status = 200, ok = status >= 200 && status < 300, url = "https://app.test/api/chat", contentType = "application/json" } = {}) {
  return {
    ok,
    status,
    url,
    headers: { get: (name) => name.toLowerCase() === "content-type" ? contentType : null },
    text: async () => body,
  };
}

test("guarded parsing accepts JSON and an empty successful body", async () => {
  assert.deepEqual(await parseJsonResponse(response({ body: '{"ok":true}' })), { ok: true });
  assert.deepEqual(await parseJsonResponse(response({ body: "" })), {});
});

test("an HTML API response reports status, URL, MIME type, and readable text", async () => {
  await assert.rejects(
    parseJsonResponse(response({
      body: "<html><h1>Function crashed</h1><p>Request ID abc</p></html>",
      status: 502,
      ok: false,
      contentType: "text/html; charset=utf-8",
    })),
    (err) => {
      assert.match(err.message, /API 502/);
      assert.match(err.message, /https:\/\/app\.test\/api\/chat/);
      assert.match(err.message, /text\/html/);
      assert.match(err.message, /Function crashed Request ID abc/);
      assert.doesNotMatch(err.message, /<html>/);
      return true;
    },
  );
});

test("JSON error payloads retain the server's actionable message", async () => {
  await assert.rejects(
    readJsonOrThrow(response({ body: '{"error":{"message":"Not authenticated"}}', status: 401, ok: false }), "Chat failed"),
    /Not authenticated/,
  );
});

test("the live agent call path rejects an HTML platform response clearly", async () => {
  const previousFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => {
    calls += 1;
    return response({ body: "<!doctype html><title>Upstream timeout</title>", status: 502, ok: false, contentType: "text/html" });
  };
  try {
    await assert.rejects(
      callClaude({ model: "test", messages: [] }, { Authorization: "Bearer test" }),
      /API 502.*text\/html.*Upstream timeout/,
    );
    assert.equal(calls, 1, "a non-retryable 502 response is parsed once");
  } finally {
    globalThis.fetch = previousFetch;
  }
});
