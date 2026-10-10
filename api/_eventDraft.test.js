import test from "node:test";
import assert from "node:assert/strict";
import { eventDraftStatus, handleEventDraft, validateEventDraft } from "./_eventDraft.js";

function response() {
  return { statusCode: 200, body: null, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } };
}

const valid = { title: "Dinner", date: "2026-10-10", end_date: "", start_time: "18:00", end_time: "", description: "Dinner with McKenna" };

test("event drafting requires its independent server switch and provider key", () => {
  assert.deepEqual(eventDraftStatus({ ANTHROPIC_API_KEY: "key" }), { available: false });
  assert.deepEqual(eventDraftStatus({ EVENT_DRAFTING_ENABLED: "1" }), { available: false });
  assert.deepEqual(eventDraftStatus({ ANTHROPIC_API_KEY: "key", EVENT_DRAFTING_ENABLED: "1" }), { available: true });
});

test("structured event fields are bounded and date/time validated", () => {
  assert.deepEqual(validateEventDraft(valid), valid);
  assert.throws(() => validateEventDraft({ ...valid, date: "2026-02-30" }), /date/);
  assert.throws(() => validateEventDraft({ ...valid, end_time: "25:99" }), /time/);
  assert.throws(() => validateEventDraft({ ...valid, extra: "project" }), /unexpected/);
  assert.throws(() => validateEventDraft({ ...valid, end_date: "2026-10-09" }), /before/);
});

test("draft endpoint sends only the disclosed description and local date context and returns a preview", async () => {
  let requestBody;
  const res = response();
  await handleEventDraft({ body: { description: "Dinner tomorrow", referenceDate: "2026-10-09", timezone: "America/St_Johns" } }, res, {
    env: { ANTHROPIC_API_KEY: "test-key", EVENT_DRAFTING_ENABLED: "1" },
    verify: async () => true,
    request: async (_url, options) => {
      requestBody = JSON.parse(options.body);
      return { ok: true, json: async () => ({ content: [{ type: "tool_use", name: "return_event_draft", input: valid }] }) };
    },
  });
  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body.draft, valid);
  assert.equal(res.body.provenance.prompt, "event-form-draft");
  assert.deepEqual(requestBody.messages, [{ role: "user", content: JSON.stringify({ description: "Dinner tomorrow", referenceDate: "2026-10-09", timezone: "America/St_Johns" }) }]);
});

test("draft endpoint does not call a provider when the separate switch is disabled", async () => {
  let calls = 0;
  const res = response();
  await handleEventDraft({ body: { description: "Dinner", referenceDate: "2026-10-09", timezone: "UTC" } }, res, {
    env: { ANTHROPIC_API_KEY: "test-key" }, verify: async () => true,
    request: async () => { calls += 1; },
  });
  assert.equal(res.statusCode, 503);
  assert.equal(calls, 0);
});
