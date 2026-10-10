import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("./JournalPage.jsx", import.meta.url), "utf8");

test("both journal editors share counts, timer, cleanup, and undo controls", () => {
  assert.equal((source.match(/<WritingTools/g) || []).length, 2);
  assert.match(source, /journalWritingCounts\(body\)/);
  assert.match(source, /Clean up writing/);
  assert.match(source, /Undo cleanup/);
  assert.match(source, /cleanupResponseIsCurrent/);
});

test("journal index count comes from rendered pagination state", () => {
  assert.match(source, /entryPage\.visible\.length < sortedEntries\.length/);
  assert.match(source, /entryPage\.visible\.length.*of.*sortedEntries\.length/s);
});

test("saved AI cleanup displays provenance and manual body input clears pending cleanup", () => {
  assert.match(source, /Cleaned with AI/);
  assert.match(source, /setComposeCleanup\(null\)/);
  assert.match(source, /setEditCleanup\(null\)/);
  assert.match(source, /journalProvenanceForSave/);
});

test("new and edited journal entries both support disclosed browser voice typing", () => {
  assert.equal((source.match(/onTranscript=\{/g) || []).length, 2);
  assert.match(source, /window\.SpeechRecognition \|\| window\.webkitSpeechRecognition/);
  assert.match(source, /Speak entry/);
  assert.match(source, /Stop speaking/);
  assert.match(source, /audio may be processed by your browser provider/);
  assert.match(source, /Save it, then review the people and proposed Orbit updates/);
  assert.match(source, /submitDisabled=\{!entry\.trim\(\) \|\| composeSpeaking\}/);
  assert.match(source, /submitDisabled=\{!editForm\.entry\.trim\(\) \|\| editSpeaking\}/);
  assert.match(source, /setStopping\(true\)[\s\S]*recognitionRef\.current\?\.stop\(\)[\s\S]*return;/);
  assert.match(source, /recognition\.onend = \(\) => \{ setRecording\(false\); setStopping\(false\); onRecordingChange\(false\)/);
  assert.match(source, /disabled=\{stopping\}/);
});
