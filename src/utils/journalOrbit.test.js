import { test } from "node:test";
import assert from "node:assert/strict";
import { eventNeedsOrbitPrompt, eventOrbitLogPatch, reminderActionForName, reminderActionUrl, REMINDER_ACTION_LABELS, resolveJournalPerson } from "./journalOrbit.js";

test("person references resolve only a unique exact, alias, or first-name match", () => {
  const people = {
    mckenna: { name: "McKenna Adams", aliases: ["Kenna"] },
    maria: { name: "Maria Jones" },
    mariana: { name: "Maria Smith" },
  };
  assert.deepEqual(resolveJournalPerson(people, "MCKENNA adams"), { status: "matched", id: "mckenna", ids: ["mckenna"] });
  assert.deepEqual(resolveJournalPerson(people, "Kenna"), { status: "matched", id: "mckenna", ids: ["mckenna"] });
  assert.deepEqual(resolveJournalPerson(people, "McKenna"), { status: "matched", id: "mckenna", ids: ["mckenna"] });
  assert.deepEqual(resolveJournalPerson(people, "Maria"), { status: "ambiguous", ids: ["maria", "mariana"] });
  assert.deepEqual(resolveJournalPerson(people, "Unknown"), { status: "unknown", ids: [] });
});

test("reminder action mapping is explicit and conservative", () => {
  assert.equal(reminderActionForName("Log weight Thursday")?.id, "weight");
  assert.equal(reminderActionForName("Log a meal")?.id, "food");
  assert.equal(reminderActionForName("Track workout")?.id, "workout");
  assert.equal(reminderActionForName("Write a journal entry")?.id, "journal");
  assert.equal(reminderActionForName("Log a hangout with McKenna")?.id, "orbit_hangout");
  assert.equal(reminderActionForName("Weight is low"), null);
  assert.equal(reminderActionForName("Remember to log bank balance"), null);
  assert.equal(reminderActionForName(""), null);
});

test("every approved reminder action routes to its existing destination with occurrence identity", () => {
  for (const action of Object.keys(REMINDER_ACTION_LABELS)) {
    const url = new URL(reminderActionUrl(action, "reminder-1", "2026-10-09"), "https://example.test");
    assert.equal(url.searchParams.get("reminderId"), "reminder-1");
    assert.equal(url.searchParams.get("occurrenceDate"), "2026-10-09");
  }
  assert.equal(reminderActionUrl("other", "reminder-1", "2026-10-09"), null);
});

test("event prompts start only after the source event end passes locally", () => {
  const event = { date: "2026-10-09", end_time: "09:00", orbit_log_status: "pending" };
  assert.equal(eventNeedsOrbitPrompt(event, new Date(2026, 9, 9, 8, 59, 59)), false);
  assert.equal(eventNeedsOrbitPrompt(event, new Date(2026, 9, 9, 9, 1, 0)), true);
  assert.equal(eventNeedsOrbitPrompt({ ...event, end_time: "", end_date: "2026-10-10" }, new Date(2026, 9, 10, 23, 59, 59)), false);
  assert.equal(eventNeedsOrbitPrompt({ ...event, end_time: "", end_date: "2026-10-10" }, new Date(2026, 9, 11, 0, 0, 0)), true);
  assert.equal(eventNeedsOrbitPrompt({ ...event, orbit_log_status: "dismissed" }, new Date(2026, 9, 10)), false);
  assert.equal(eventNeedsOrbitPrompt({ ...event, date: "2026-02-30" }, new Date(2026, 9, 10)), false);
});

test("event log state changes require valid, explicit transitions", () => {
  const pending = { id: "event-1", orbit_log_status: "pending" };
  assert.deepEqual(eventOrbitLogPatch(pending, "logged", "orbit-1"), { orbit_log_status: "logged", orbit_event_id: "orbit-1" });
  assert.deepEqual(eventOrbitLogPatch(pending, "dismissed"), { orbit_log_status: "dismissed", orbit_event_id: null });
  assert.equal(eventOrbitLogPatch(pending, "logged"), null);
  assert.equal(eventOrbitLogPatch({ ...pending, orbit_log_status: "logged" }, "dismissed"), null);
  assert.deepEqual(eventOrbitLogPatch({ ...pending, orbit_log_status: "dismissed" }, "pending"), { orbit_log_status: "pending", orbit_event_id: null });
});
