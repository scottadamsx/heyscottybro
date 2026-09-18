// node --test src/utils/siteSearch.test.js — the ⌘K matcher.
import { test } from "node:test";
import assert from "node:assert/strict";
import { searchGroups, highlightParts, scoreItem, normalize } from "./siteSearch.js";

const groups = [
  { key: "tasks", label: "Tasks", icon: "x", items: [
    { id: 1, title: "Pay rent", text: "landlord e-transfer", date: "2026-09-01" },
    { id: 2, title: "Call mom", date: "2026-09-02" },
    { id: 3, title: "Rent receipt filing", date: "2026-09-03" },
  ] },
  { key: "journal", label: "Journal", icon: "y", items: [{ id: 9, title: "Sunday", text: "Paid the rent early" }] },
  { key: "people", label: "People", icon: "z", items: [] },
];

test("under two characters searches nothing", () => {
  assert.deepEqual(searchGroups(groups, "r"), []);
  assert.deepEqual(searchGroups(groups, "  "), []);
});

test("matches title and hidden text, drops empty groups", () => {
  const out = searchGroups(groups, "rent");
  assert.deepEqual(out.map((g) => g.key), ["tasks", "journal"]);
  assert.deepEqual(out[0].items.map((i) => i.id), [3, 1]); // title starts with "rent" ranks first
  assert.equal(out[1].items[0].id, 9); // body-only hit still found
});

test("every word must match, in any order", () => {
  assert.deepEqual(searchGroups(groups, "landlord pay")[0].items.map((i) => i.id), [1]);
  assert.deepEqual(searchGroups(groups, "rent mom"), []);
});

test("caps each group and reports the total", () => {
  const many = [{ key: "t", label: "T", icon: "i", items: Array.from({ length: 10 }, (_, i) => ({ id: i, title: `note ${i}` })) }];
  const [g] = searchGroups(many, "note", { perGroup: 3 });
  assert.equal(g.items.length, 3);
  assert.equal(g.total, 10);
});

test("accents and case don't matter", () => {
  assert.equal(normalize("Café"), "cafe");
  assert.ok(scoreItem({ title: "Café run" }, ["cafe"], "cafe") > 0);
});

test("highlight splits around the first hit", () => {
  assert.deepEqual(highlightParts("Pay rent", "rent"), ["Pay ", "rent", ""]);
  assert.deepEqual(highlightParts("Pay rent", "zzz"), ["Pay rent"]);
});
