import assert from "node:assert/strict";
import test from "node:test";
import { searchAcrossCollections } from "./aiQueryCore.js";

const search = (input, queryCollection) => searchAcrossCollections({
  ...input,
  availableCollections: ["projects", "journal", "brain"],
  queryCollection,
});

test("global search fans out, ranks exact labels first, and isolates a failed shelf", async () => {
  const started = [];
  const result = await search(
    { query: "Frodo", collections: ["projects", "journal", "brain"], limit: 10 },
    async ({ collection }) => {
      started.push(collection);
      if (collection === "journal") throw new Error("journal offline");
      if (collection === "projects") return { items: [{ id: "p1", name: "Frodo repair" }] };
      return { items: [{ id: "b1", title: "Frodo" }] };
    },
  );
  assert.deepEqual(started.sort(), ["brain", "journal", "projects"]);
  assert.equal(result.total, 2);
  assert.equal(result.items[0].collection, "brain");
  assert.equal(result.items[0].score, 3);
  assert.deepEqual(result.errors, [{ collection: "journal", error: "journal offline" }]);
});

test("global search rejects empty terms and secret-bearing shelves", async () => {
  assert.deepEqual(await search({ query: "   " }), { error: "query is required" });
  assert.deepEqual(await search({ query: "wifi", collections: ["snippets"] }), { error: '"snippets" is not available to global_search' });
});

test("coverage preserves zero results, failure, warnings and pagination", async () => {
  const result = await search({ query: "topic" }, async ({ collection }) => {
    if (collection === "projects") return { items: [], total: 0 };
    if (collection === "journal") return { error: "unavailable" };
    return { items: [{ id: "b", title: "topic" }], total: 22, next_offset: 1, warning: "local copy", note: "partial" };
  });
  assert.deepEqual(result.coverage, [
    { collection: "projects", status: "zero_matches", returned: 0, total: 0 },
    { collection: "journal", status: "failed", returned: 0, error: "unavailable" },
    { collection: "brain", status: "matches", returned: 1, total: 22, next_offset: 1, warning: "local copy", note: "partial" },
  ]);
  assert.match(result.total_scope, /not all matching records/);
});
