import test from "node:test";
import assert from "node:assert/strict";
import {
  JOURNAL_CLEANUP_PROMPT,
  handleJournalCleanup,
  journalCleanupStatus,
  maskJournalEmoji,
  validateAndRestoreCleanup,
} from "./_journalCleanup.js";

function response() {
  return {
    statusCode: 200,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };
}

function request(text = "I has a thought.") {
  return { method: "POST", headers: { authorization: "Bearer test" }, body: { feature: "journal_cleanup", text } };
}

const readyEnv = { ANTHROPIC_API_KEY: "test-key", JOURNAL_CLEANUP_ENABLED: "1", SUPABASE_URL: "https://example.test", SUPABASE_ANON_KEY: "anon" };
const verify = async () => true;
const toolResult = (cleaned_text) => ({
  ok: true,
  json: async () => ({ content: [{ type: "tool_use", name: "return_cleaned_journal", input: { cleaned_text } }] }),
});

test("prompt metadata is versioned and grounded", () => {
  assert.equal(JOURNAL_CLEANUP_PROMPT.name, "journal-cleanup");
  assert.equal(JOURNAL_CLEANUP_PROMPT.version, 1);
  assert.match(JOURNAL_CLEANUP_PROMPT.text, /Use only the supplied text/i);
  assert.match(JOURNAL_CLEANUP_PROMPT.text, /Never invent/i);
  assert.match(JOURNAL_CLEANUP_PROMPT.text, /Never generate emoji/i);
});

test("emoji are masked and restored exactly", () => {
  const masked = maskJournalEmoji("Good day 👍🏽. Family 👨‍👩‍👧‍👦.");
  assert.equal(masked.emoji.length, 2);
  assert.equal(validateAndRestoreCleanup({ cleaned_text: masked.maskedText }, masked.emoji), "Good day 👍🏽. Family 👨‍👩‍👧‍👦.");
  assert.throws(() => validateAndRestoreCleanup({ cleaned_text: `${masked.maskedText} 🙂` }, masked.emoji), /generated emoji/);
  assert.throws(() => validateAndRestoreCleanup({ cleaned_text: "No placeholders" }, masked.emoji), /placeholders/);
});

test("availability requires both the server key and feature flag", () => {
  assert.equal(journalCleanupStatus(readyEnv).available, true);
  assert.equal(journalCleanupStatus({ ...readyEnv, ANTHROPIC_API_KEY: "" }).available, false);
  assert.equal(journalCleanupStatus({ ...readyEnv, JOURNAL_CLEANUP_ENABLED: "0" }).available, false);
});

test("cleanup authenticates, validates, and returns provenance", async () => {
  const res = response();
  await handleJournalCleanup(request(), res, {
    env: readyEnv,
    verify,
    request: async () => toolResult("I have a thought."),
  });
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.cleanedText, "I have a thought.");
  assert.equal(res.body.provenance.prompt, "journal-cleanup");
  assert.equal(res.body.provenance.promptVersion, 1);
});

test("one invalid result gets one corrective retry", async () => {
  const modelCalls = [];
  const res = response();
  await handleJournalCleanup(request(), res, {
    env: readyEnv,
    verify,
    request: async (_url, options) => {
      modelCalls.push(JSON.parse(options.body));
      return modelCalls.length === 1 ? toolResult("") : toolResult("I have a thought.");
    },
  });
  assert.equal(res.statusCode, 200);
  assert.equal(modelCalls.length, 2);
  assert.match(modelCalls[1].system, /previous result failed validation/i);
});

test("provider failure does not retry or expose provider detail", async () => {
  let calls = 0;
  const res = response();
  await handleJournalCleanup(request(), res, {
    env: readyEnv,
    verify,
    request: async () => {
      calls += 1;
      return { ok: false, status: 429, json: async () => ({ error: { message: "sensitive upstream detail" } }) };
    },
  });
  assert.equal(calls, 1);
  assert.equal(res.statusCode, 429);
  assert.equal(res.body.error, "Journal cleanup failed. Try again.");
});
