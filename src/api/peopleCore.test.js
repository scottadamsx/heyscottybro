import assert from "node:assert/strict";
import test from "node:test";
import {
  buildNewPersonDoc, flattenPersonDoc, mergePersonUpdate, parseFactsString,
} from "./peopleCore.js";

test("parseFactsString reads label: value pairs and tolerates empty input", () => {
  assert.deepEqual(parseFactsString("Work: Anderson's Butcher; Gym: wants to train together"), [
    { k: "Work", v: "Anderson's Butcher" },
    { k: "Gym", v: "wants to train together" },
  ]);
  assert.deepEqual(parseFactsString(""), []);
  assert.deepEqual(parseFactsString(undefined), []);
  // A value may itself contain a colon; only the first one splits.
  assert.deepEqual(parseFactsString("Shift: 9:30 start"), [{ k: "Shift", v: "9:30 start" }]);
});

test("parseFactsString rejects a segment with no label or no value", () => {
  assert.throws(() => parseFactsString("just some words"), /needs a label and a value/);
  assert.throws(() => parseFactsString("Work:"), /needs a label and a value/);
  assert.throws(() => parseFactsString(42), /facts must be text/);
});

test("buildNewPersonDoc saves the same shape as the People UI's Add People form", () => {
  const doc = buildNewPersonDoc({
    name: "  Aaron Burke ",
    how: "Used to work with him at Anderson's Butcher",
    facts: "Gym: wants to work out together",
  }, "2026-10-28T16:00:00.000Z");
  assert.deepEqual(doc, {
    name: "Aaron Burke",
    group: "other",
    birthday: "",
    how: "Used to work with him at Anderson's Butcher",
    notes: "",
    facts: [{ k: "Gym", v: "wants to work out together" }],
    intents: [],
    createdAt: "2026-10-28T16:00:00.000Z",
  });
});

test("buildNewPersonDoc requires a name and refuses open_items", () => {
  assert.throws(() => buildNewPersonDoc({ how: "x" }, "t"), /needs a name/);
  assert.throws(() => buildNewPersonDoc({ name: "A", open_items: "to-do: call" }, "t"), /read-only summary/);
});

test("mergePersonUpdate changes only named scalars and appends facts", () => {
  const before = {
    name: "Aaron Burke",
    group: "other",
    birthday: "",
    how: "Anderson's Butcher",
    notes: "",
    facts: [{ k: "Work", v: "Anderson's Butcher" }],
    intents: [{ id: "i1", kind: "todo", text: "Call him", done: false }],
    createdAt: "2026-10-28T16:00:00.000Z",
  };
  const next = mergePersonUpdate(before, {
    group: "friends",
    notes: "Ran into him at the gym",
    facts: "Gym: wants to work out together",
  });
  assert.equal(next.group, "friends");
  assert.equal(next.notes, "Ran into him at the gym");
  assert.equal(next.how, "Anderson's Butcher"); // untouched scalar survives
  assert.deepEqual(next.facts, [
    { k: "Work", v: "Anderson's Butcher" },
    { k: "Gym", v: "wants to work out together" },
  ]);
  assert.deepEqual(next.intents, before.intents); // intents preserved as-is
  assert.equal(next.createdAt, before.createdAt);
  assert.equal(before.notes, ""); // the stored document is not mutated
});

test("mergePersonUpdate refuses open_items", () => {
  assert.throws(() => mergePersonUpdate({ name: "A" }, { open_items: "to-do: x" }), /read-only summary/);
});

test("flattenPersonDoc matches the Library read model", () => {
  const row = flattenPersonDoc("p_1", {
    name: "Aaron Burke",
    group: "friends",
    how: "Anderson's Butcher",
    birthday: "03-04",
    notes: "n",
    facts: [{ k: "Work", v: "Anderson's Butcher" }],
    intents: [
      { kind: "todo", text: "Call him", done: false },
      { kind: "gift", text: "Old idea", done: true },
    ],
  });
  assert.deepEqual(row, {
    id: "p_1",
    name: "Aaron Burke",
    group: "friends",
    how: "Anderson's Butcher",
    birthday: "03-04",
    notes: "n",
    facts: "Work: Anderson's Butcher",
    open_items: "to-do: Call him",
  });
});
