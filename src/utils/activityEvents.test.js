import assert from "node:assert/strict";
import test from "node:test";
import { buildActivityEvent } from "./activityEvents.js";

test("activity rows keep only privacy-safe allowlisted metadata", () => {
  const row = buildActivityEvent({
    idempotencyKey: "chat:turn:1",
    eventType: "chat.turn.sent",
    entityType: "chat_turn",
    entityLabel: "Frodo chat turn",
    occurredAt: "2026-10-01T12:00:00Z",
    metadata: { attachment_count: 2.4, precision: "exact", text: "private body", url: "/admin/people/person/private" },
  });
  assert.deepEqual(row.metadata, { attachment_count: 2, precision: "exact" });
  assert.equal(row.occurred_at, "2026-10-01T12:00:00.000Z");
  assert.equal(JSON.stringify(row).includes("private body"), false);
});

test("unknown event types and invalid times fail closed", () => {
  assert.throws(() => buildActivityEvent({ idempotencyKey: "x", eventType: "secret.exposed", entityType: "x" }), /Unsupported/);
  assert.throws(() => buildActivityEvent({ idempotencyKey: "x", eventType: "habit.logged", entityType: "habit", occurredAt: "never" }), /invalid/);
});
