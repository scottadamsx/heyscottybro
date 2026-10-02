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
