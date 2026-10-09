import assert from "node:assert/strict";
import test from "node:test";
import {
  expandLibraryOccurrences, filterLibraryRows, hasOnlyExactWhere,
  occurrenceQueryError, validateLibraryWhere,
} from "./aiQueryCore.js";

const transactionSpec = {
  defaultFields: ["id", "amount", "date", "category"],
  fields: { amount: { type: "number" }, date: { type: "date" }, category: { type: "string" } },
};

test("rich filters support ranges, membership, contains, and one OR group", () => {
  const rows = [
    { id: "a", amount: 75, date: "2026-10-03", category: "Groceries" },
    { id: "b", amount: 125, date: "2026-10-05", category: "Gas" },
    { id: "c", amount: 240, date: "2026-10-08", category: "Groceries" },
  ];
  const where = { amount: { gte: 100 }, category: { contains: "groc" }, or: [{ date: { lte: "2026-10-04" } }, { id: { in: ["c"] } }] };
  assert.equal(validateLibraryWhere(transactionSpec, where), null);
  assert.deepEqual(filterLibraryRows(rows, where).map((row) => row.id), ["c"]);
  assert.equal(hasOnlyExactWhere(where), false);
  assert.equal(hasOnlyExactWhere({ category: "Gas" }), true);
});

test("invalid query operators and fields are rejected before a source read", () => {
  assert.match(validateLibraryWhere(transactionSpec, { missing: "x" }), /unknown field/);
  assert.match(validateLibraryWhere(transactionSpec, { amount: { regex: "x" } }), /unsupported operator/);
  assert.match(validateLibraryWhere(transactionSpec, { category: { gt: "A" } }), /only supported/);
  assert.match(validateLibraryWhere(transactionSpec, { or: [] }), /non-empty/);
});

test("recurring reminder query expansion exposes generated occurrence metadata only", () => {
  const rows = [{ id: "r1", name: "Review", date: "2026-10-01", recurrence: "weekly", completed: false }];
  const expanded = expandLibraryOccurrences("reminders", rows, "2026-10-08", "2026-10-08");
  assert.equal(expanded.length, 1);
  assert.equal(expanded[0].id, "r1");
  assert.equal(expanded[0].source_id, "r1");
  assert.equal(expanded[0].source_date, "2026-10-01");
  assert.equal(expanded[0].occurrence_date, "2026-10-08");
  assert.equal(rows[0].date, "2026-10-01", "source row remains unchanged");
});

test("occurrence expansion accepts only an explicit planner range", () => {
  assert.match(occurrenceQueryError("projects", true, "2026-10-01", "2026-10-02"), /only available/);
  assert.match(occurrenceQueryError("events", true, "bad", "2026-10-02"), /requires/);
  assert.equal(occurrenceQueryError("events", true, "2026-10-01", "2026-10-02"), null);
});
