// Unit tests for event attendee helpers (src/lib/attendees.js).
// Run with: node src/lib/attendees.test.js
// (No test framework — plain assertions, house style. Exits non-zero on failure.)

import {
  normalizeAttendeeIds, peopleById, personInitials, personColor,
  resolveAttendees, attendeeNamesLabel,
} from "./attendees.js";

let passed = 0;
let failed = 0;
function test(name, fn) {
  try { fn(); console.log(`✓ ${name}`); passed++; }
  catch (e) { console.error(`✗ ${name}\n  ${e.message}`); failed++; }
}
function assert(cond, msg) { if (!cond) throw new Error(msg || "assertion failed"); }
function eq(a, b, msg) { if (a !== b) throw new Error(`${msg || "not equal"}: ${JSON.stringify(a)} !== ${JSON.stringify(b)}`); }

test("normalize: trims, dedupes, drops empties, keeps order", () => {
  eq(JSON.stringify(normalizeAttendeeIds([" rena ", "caleb", "rena", "", null, "caleb"])), JSON.stringify(["rena", "caleb"]));
  eq(JSON.stringify(normalizeAttendeeIds(undefined)), JSON.stringify([]));
  eq(JSON.stringify(normalizeAttendeeIds([42, "42"])), JSON.stringify(["42"]));
});

test("CP-01: a link resolves to the person's current Orbit name", () => {
  const byId = peopleById([{ id: "rena", name: "Rena Adams" }]);
  const resolved = resolveAttendees(["rena"], byId);
  eq(resolved.length, 1);
  eq(resolved[0].name, "Rena Adams");
  eq(resolved[0].initials, "RA");
});

test("CP-02: a rename in Orbit shows the new name with no link change", () => {
  const before = resolveAttendees(["rena"], peopleById([{ id: "rena", name: "Rena A." }]));
  const after = resolveAttendees(["rena"], peopleById([{ id: "rena", name: "Rena Adams" }]));
  eq(before[0].name, "Rena A.");
  eq(after[0].name, "Rena Adams");
});

test("deleted person: the link is skipped at render, others still show", () => {
  const byId = peopleById([{ id: "caleb", name: "Caleb Roberts" }]);
  const resolved = resolveAttendees(["ghost", "caleb"], byId);
  eq(resolved.length, 1);
  eq(resolved[0].id, "caleb");
});

test("initials: two words, one word, blank", () => {
  eq(personInitials("Rena Adams"), "RA");
  eq(personInitials("Sophie"), "S");
  eq(personInitials("Mary Ellen Alexander"), "MA");
  eq(personInitials("  "), "?");
});

test("color: stable per person, always from the palette", () => {
  eq(personColor("rena"), personColor("rena"));
  assert(/^#[0-9a-f]{6}$/.test(personColor("anyone")), "hex colour");
});

test("label joins names for tooltips and aria", () => {
  const byId = peopleById([{ id: "a", name: "Rena Adams" }, { id: "b", name: "Caleb Roberts" }]);
  eq(attendeeNamesLabel(resolveAttendees(["a", "b"], byId)), "Rena Adams, Caleb Roberts");
  eq(attendeeNamesLabel([]), "");
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
