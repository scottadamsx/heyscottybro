import test from "node:test";
import assert from "node:assert/strict";
import { nextStatus, nextStatusLabel, statusLabel, kindLabel, excerpt, titleFromText } from "./binHelpers.js";

test("bin status cycles new -> picked_up -> done -> new", () => {
  assert.equal(nextStatus("new"), "picked_up");
  assert.equal(nextStatus("picked_up"), "done");
  assert.equal(nextStatus("done"), "new");
  assert.equal(nextStatus("bogus"), "new");
});

test("bin status action labels match the flow", () => {
  assert.equal(nextStatusLabel("new"), "Mark picked up");
  assert.equal(nextStatusLabel("picked_up"), "Mark done");
  assert.equal(nextStatusLabel("done"), "Back to New");
  assert.equal(statusLabel("picked_up"), "Picked up");
  assert.equal(kindLabel("file"), "File");
});

test("excerpt takes the first non-empty line and caps length", () => {
  assert.equal(excerpt("\n\n  hello world  \nsecond line"), "hello world");
  assert.equal(excerpt(""), "");
  assert.equal(excerpt(null), "");
  const long = excerpt("x".repeat(300), 10);
  assert.equal(long.length, 10);
  assert.ok(long.endsWith("…"));
});

test("titleFromText uses up to six words", () => {
  assert.equal(titleFromText("one two three four five six seven"), "one two three four five six");
  assert.equal(titleFromText("   "), "Untitled");
});
