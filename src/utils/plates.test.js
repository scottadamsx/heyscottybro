import { test } from "node:test";
import assert from "node:assert/strict";
import { loadHint, loadableTotal, perSide, platesForSide, platesText, totalFor } from "./plates.js";

test("per side and back again", () => {
  assert.equal(perSide(135), 45);
  assert.equal(perSide(140), 47.5);
  assert.equal(perSide(45), 0);
  assert.equal(perSide(30), null, "lighter than the bar");
  assert.equal(totalFor(47.5), 140);
  assert.equal(totalFor(20, 35), 75, "a lighter bar");
});

test("totals snap to what plates can make", () => {
  assert.equal(loadableTotal(142), 140);
  assert.equal(loadableTotal(143), 145);
  assert.equal(loadableTotal(46), 45);
  assert.equal(loadableTotal(20), 45, "never below the bar");
});

test("plates for one side, heaviest first", () => {
  assert.deepEqual(platesForSide(47.5), [45, 2.5]);
  assert.deepEqual(platesForSide(100), [45, 45, 10]);
  assert.deepEqual(platesForSide(0), []);
  assert.equal(platesText(100), "2×45 + 10");
  assert.equal(platesText(47.5), "45 + 2.5");
});

test("the hint says what to put on the bar", () => {
  assert.equal(loadHint(140, { barbell: true }), "45 lb bar + 47.5 a side (45 + 2.5)");
  assert.equal(loadHint(45, { barbell: true }), "Just the 45 lb bar");
  assert.equal(loadHint(30, { barbell: true }), "Less than the 45 lb bar on its own");
  assert.equal(loadHint(140, { barbell: false }), null, "dumbbells and machines get no hint");
  assert.equal(loadHint(0, { barbell: true }), null);
  assert.equal(loadHint(95, { barbell: true, barLb: 35 }), "35 lb bar + 30 a side (25 + 5)");
});
