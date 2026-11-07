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

const promptBranch = logModal.slice(
  logModal.indexOf("entryMode === 'prompt'"),
  logModal.indexOf("entryMode === 'prompt'") + 4000,
);

test("A Planner event log prompt starts in prompt mode when the AI interview is unavailable (BUG-084)", () => {
  assert.match(logModal, /const eventLogPrompt = Boolean\(prefill\.sourceHostEventId && !existing && !prefill\.plan\)/);
  // The interview still wins when AI is available; prompt mode is the fallback, manual last.
  assert.match(logModal, /startInOrbit \? 'orbit' : eventLogPrompt \? 'prompt' : 'manual'/);
  assert.match(logModal, /if \(entryMode === 'prompt' && eventLogPrompt\)/);
});

test("The prompt names the event, asks what happened, and files the answer as the log's notes (BUG-084)", () => {
  assert.match(promptBranch, /form\.title \|\| form\.kind/);
  assert.match(promptBranch, /formatDate\(form\.date\)/);
  assert.match(promptBranch, /label="What happened at the event\?"/);
  assert.match(promptBranch, /value=\{form\.notes\}/);
  assert.match(promptBranch, /onChange=\{set\('notes'\)\}/);
  // Saving goes through the existing save path, which builds notes from form.notes.
  assert.match(logModal, /notes: form\.notes\.trim\(\)/);
});

test("The prompt shows the people picker when the event has nobody attached, and an edit toggle when it does (BUG-084)", () => {
  assert.match(promptBranch, /<PeoplePicker value=\{form\.people\} onChange=\{set\('people'\)\} \/>/);
  assert.match(promptBranch, /Edit people/);
  assert.match(promptBranch, /form\.people\.map\(\(id\) => people\[id\]\?\.name\)/);
});

test("The prompt keeps the full manual form one tap away, and the manual form can return (BUG-084)", () => {
  assert.match(promptBranch, /onClick=\{\(\) => setEntryMode\('manual'\)\}/);
  assert.match(logModal, /onClick=\{\(\) => setEntryMode\('prompt'\)\}/);
});
