import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const page = readFileSync(new URL("./CalendarPage.jsx", import.meta.url), "utf8");
const orbitApp = readFileSync(new URL("../../../orbit/src/pages/App.jsx", import.meta.url), "utf8");
const logModal = readFileSync(new URL("../../../orbit/src/components/LogModal.jsx", import.meta.url), "utf8");

test("Log in Orbit sends the event's people with the handoff (BUG-081)", () => {
  assert.match(page, /normalizeAttendeeIds\(eventPeople\[event\.id\]\)/);
  assert.match(page, /query\.set\("people", attendeeIds\.join\(","\)\)/);
  assert.match(page, /import \{[^}]*normalizeAttendeeIds[^}]*\} from "\.\.\/\.\.\/lib\/attendees"/);
});

test("Orbit forwards the people param into the log prefill and strips it from the URL (BUG-081)", () => {
  assert.match(orbitApp, /people: \(params\.get\('people'\) \|\| ''\)\.split\(','\)/);
  assert.match(orbitApp, /next\.delete\('people'\)/);
});

test("LogModal seeds the form and the interview from prefilled people (BUG-081)", () => {
  assert.match(logModal, /people: existing\?\.people \?\? prefill\.people \?\? \[\]/);
  assert.match(logModal, /eventPeople=\{prefill\.people \|\| \[\]\}/);
});
