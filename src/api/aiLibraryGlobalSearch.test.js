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
