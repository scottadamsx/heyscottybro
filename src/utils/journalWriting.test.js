import test from "node:test";
import assert from "node:assert/strict";
import {
  autoPauseIdleTimer,
  cleanupResponseIsCurrent,
  countGraphemes,
  countJournalWords,
  createWritingTimer,
  elapsedWritingMs,
  formatWritingDuration,
  journalProvenanceForSave,
  journalTextDiff,
  pauseWritingTimer,
  resumeWritingTimer,
  writingTimerInput,
  writingTimerMetadata,
} from "./journalWriting.js";

test("grapheme counts match visible characters with a code-point fallback", () => {
  assert.equal(countGraphemes(""), 0);
  assert.equal(countGraphemes("a b\n"), 4);
  assert.equal(countGraphemes("e\u0301"), 1);
  assert.equal(countGraphemes("👨‍👩‍👧‍👦"), 1);
  assert.equal(countGraphemes("😀", null), 1);
});

test("cleanup responses fail closed after typing, closing, or switching entries", () => {
  const base = { submittedBody: "draft", currentBody: "draft", requestedEntryId: 7, currentEntryId: 7, open: true };
  assert.equal(cleanupResponseIsCurrent(base), true);
  assert.equal(cleanupResponseIsCurrent({ ...base, currentBody: "changed" }), false);
  assert.equal(cleanupResponseIsCurrent({ ...base, open: false }), false);
  assert.equal(cleanupResponseIsCurrent({ ...base, currentEntryId: 8 }), false);
});

test("comparison marks changed text with explicit removed and added segments", () => {
  assert.deepEqual(journalTextDiff("I has a plan.", "I have a plan."), [
    { type: "same", text: "I " },
    { type: "removed", text: "has" },
    { type: "added", text: "have" },
    { type: "same", text: " a plan." },
  ]);
});

test("provenance is saved only while the body exactly matches an accepted suggestion", () => {
  const cleanup = {
    suggestion: "Corrected text.",
    provenance: {
      feature: "journal_cleanup",
      model: "configured-model",
      prompt: "journal-cleanup",
      promptVersion: 1,
      generatedAt: "2026-10-01T00:00:00.000Z",
    },
  };
  assert.equal(journalProvenanceForSave(cleanup, "Changed text."), null);
  assert.deepEqual(journalProvenanceForSave(cleanup, " Corrected text. ", "2026-10-01T00:01:00.000Z"), {
    ...cleanup.provenance,
    acceptedAt: "2026-10-01T00:01:00.000Z",
  });
});

test("word counts follow the app-owned Unicode token rule", () => {
  assert.equal(countJournalWords(""), 0);
  assert.equal(countJournalWords("  \n\t"), 0);
  assert.equal(countJournalWords("hello,world"), 2);
  assert.equal(countJournalWords("can't Scott’s mother-in-law"), 3);
  assert.equal(countJournalWords("-edge- can't- -word"), 3);
  assert.equal(countJournalWords("cafe\u0301 123 😀 中文"), 3);
});

test("timer starts on body input and honours manual pause precedence", () => {
  let timer = createWritingTimer();
  timer = writingTimerInput(timer, 1000);
  assert.equal(timer.status, "running");
  assert.equal(elapsedWritingMs(timer, 3500), 2500);
  timer = pauseWritingTimer(timer, 3500, "manual");
  assert.equal(timer.elapsedMs, 2500);
  assert.equal(writingTimerInput(timer, 5000), timer);
  timer = resumeWritingTimer(timer, 6000);
  assert.equal(elapsedWritingMs(timer, 7000), 3500);
});

test("automatic idle pause counts only through the threshold and input resumes it", () => {
  let timer = writingTimerInput(createWritingTimer(), 0);
  timer = writingTimerInput(timer, 10_000);
  assert.equal(autoPauseIdleTimer(timer, 69_999), timer);
  timer = autoPauseIdleTimer(timer, 75_000);
  assert.equal(timer.status, "paused");
  assert.equal(timer.elapsedMs, 70_000);
  timer = writingTimerInput(timer, 80_000);
  assert.equal(timer.status, "running");
});

test("persisted metadata restores paused and duration formatting crosses one hour", () => {
  const running = writingTimerInput(createWritingTimer(), 100);
  const meta = writingTimerMetadata(running, 5200);
  assert.deepEqual(meta, { elapsedMs: 5100, pauseReason: "automatic" });
  assert.deepEqual(createWritingTimer(meta), { elapsedMs: 5100, status: "paused", pauseReason: "automatic", startedAt: null, lastInputAt: null });
  assert.equal(formatWritingDuration(5000), "00:05");
  assert.equal(formatWritingDuration(3_661_000), "1:01:01");
});
