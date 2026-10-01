import { test } from "node:test";
import assert from "node:assert/strict";
import { activityTrend, buildActivityHistory, buildAnalyticsSummary, inAnalyticsRange, rangeStartKey } from "./analytics.js";

const now = new Date("2026-10-01T15:00:00-02:30");

test("analytics ranges include today and the requested number of local dates", () => {
  assert.equal(rangeStartKey("7d", now), "2026-09-25");
  assert.equal(inAnalyticsRange("2026-09-25", "7d", now), true);
  assert.equal(inAnalyticsRange("2026-09-24", "7d", now), false);
});

test("all-available activity trend spans the full recorded date range", () => {
  const trend = activityTrend([
    { occurredAt: "2026-08-01T12:00:00Z" },
    { occurredAt: "2026-10-01T12:00:00Z" },
  ], "all", now);
  assert.equal(trend[0].key, "2026-08-01");
  assert.equal(trend.at(-1).key, "2026-10-01");
  assert.equal(trend.reduce((total, point) => total + point.value, 0), 2);
});

test("summary uses stored records without inventing unsupported history", () => {
  const summary = buildAnalyticsSummary({
    reminders: [{ id: "r1", created_at: "2026-09-30T10:00:00Z", completed: true, completed_date: "2026-10-01" }],
    transactions: [{ date: "2026-10-01", type: "expense", amount: 12.34 }],
    food: [{ date: "2026-10-01", calories: 500, protein_g: 30 }],
    pageUsage: [{ started_at: "2026-10-01T10:00:00Z", active_ms: 4000 }],
  }, "7d", now);
  assert.equal(summary.tasks.completed, 1);
  assert.equal(summary.money.expensesCents, 1234);
  assert.deepEqual(summary.money.topCategory, ["Other", 1234]);
  assert.equal(summary.meals.calories, 500);
  assert.equal(summary.pages.activeMs, 4000);
  assert.deepEqual(summary.pages.topRoute, ["other", 1]);
});

test("new activity events cut off duplicate legacy derivation", () => {
  const history = buildActivityHistory({
    activityEvents: [{ id: "a1", event_type: "task.created", entity_type: "task", entity_id: "new", entity_label: "New task", occurred_at: "2026-10-01T12:00:00Z", source: "database_trigger", metadata: { precision: "exact" } }],
    reminders: [
      { id: "old", name: "Old task", created_at: "2026-09-01T12:00:00Z" },
      { id: "new", name: "New task", created_at: "2026-10-01T12:00:00Z" },
    ],
  });
  assert.equal(history.filter((row) => row.label === "New task").length, 1);
  assert.equal(history.some((row) => row.label === "Old task" && row.source === "legacy:reminders"), true);
});

test("a tracked event type does not hide newer legacy evidence from an untracked type", () => {
  const history = buildActivityHistory({
    activityEvents: [{ id: "a1", event_type: "task.created", entity_type: "task", entity_id: "r1", entity_label: "Task", occurred_at: "2026-10-01T12:00:00Z" }],
    agentActions: [{ id: "ai1", tool: "query", created_at: "2026-10-01T13:00:00Z" }],
  });
  assert.equal(history.some((row) => row.id === "legacy:agent_actions:ai1:ai.action"), true);
});

test("habit history uses safe tracker names and deletion events never create broken links", () => {
  const history = buildActivityHistory({
    accountability: [{ state: { trackers: [{ id: "h1", name: "Read" }], logs: [{ id: "l1", trackerId: "h1", date: "2026-09-30" }], misses: [] } }],
    activityEvents: [{ id: "d1", event_type: "people.event.deleted", entity_type: "people_event", entity_id: "gone", entity_label: "Coffee", occurred_at: "2026-10-01T12:00:00Z" }],
  });
  assert.equal(history.find((row) => row.id === "legacy:accountability:l1:habit.logged")?.label, "Read");
  assert.equal(history.find((row) => row.id === "d1")?.link, null);
});
