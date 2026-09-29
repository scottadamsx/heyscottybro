import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { validateSessionRegistry } from "./session-registry.mjs";

const actualRegistry = readFileSync(new URL("../docs/sessions/registry.jsonl", import.meta.url), "utf8");
const actualGlossary = readFileSync(new URL("../docs/sessions/GLOSSARY.md", import.meta.url), "utf8");

const metadata = {
  type: "registry_metadata",
  schema_version: 1,
  sequence_start: 1,
  id_format: "SAI########",
  title_format: "Bonsai Chat SAI########",
};

const threadOne = "00000000-0000-4000-8000-000000000001";
const threadTwo = "00000000-0000-4000-8000-000000000002";

function event(name, id, extra = {}) {
  const reservation = name === "reserved" ? {
    started_on: "2026-09-29",
    project: "Test",
    purpose: "Test session",
    parent_sai_id: null,
  } : {};
  return {
    type: "session_event",
    schema_version: 1,
    event: name,
    sai_id: id,
    occurred_on: "2026-09-29",
    actor: "Project Manager",
    ...reservation,
    ...extra,
  };
}

function registry(...events) {
  return [metadata, ...events].map((record) => JSON.stringify(record)).join("\n");
}

function glossary(...rows) {
  return [
    "| SAI ID | Exact chat title | Status | Project | Purpose | Codex thread | Archive |",
    "| --- | --- | --- | --- | --- | --- | --- |",
    ...rows.map(({ id, status = "Active", threadId = threadOne }) =>
      `| \`${id}\` | \`Bonsai Chat ${id}\` | ${status} | Test | Test | \`${threadId}\` | Link |`),
  ].join("\n");
}

function bound(id, threadId) {
  return event("bound", id, {
    thread_id: threadId,
    title: `Bonsai Chat ${id}`,
    archive_path: `docs/sessions/2026/2026-09-29-${id}`,
    summary_path: `docs/sessions/2026/2026-09-29-${id}/SESSION_SUMMARY.md`,
  });
}

test("the checked-in registry and glossary are valid and reserve 02 next", () => {
  const result = validateSessionRegistry(actualRegistry, actualGlossary);
  assert.equal(result.sessions.length, 1);
  assert.equal(result.nextId, "SAI00000002");
});

test("duplicate reservations are rejected", () => {
  const text = registry(event("reserved", "SAI00000001"), event("reserved", "SAI00000001"));
  assert.throws(() => validateSessionRegistry(text, glossary()), /out of sequence|reserved more than once/);
});

test("skipped reservation numbers are rejected", () => {
  const text = registry(event("reserved", "SAI00000002"));
  assert.throws(() => validateSessionRegistry(text, glossary()), /expected SAI00000001/);
});

test("binding before reservation is rejected", () => {
  assert.throws(() => validateSessionRegistry(registry(bound("SAI00000001", threadOne)), glossary()), /before its reservation/);
});

test("one thread cannot be bound to two SAI IDs", () => {
  const text = registry(
    event("reserved", "SAI00000001"),
    bound("SAI00000001", threadOne),
    event("activated", "SAI00000001"),
    event("reserved", "SAI00000002"),
    bound("SAI00000002", threadOne),
  );
  assert.throws(() => validateSessionRegistry(text, glossary({ id: "SAI00000001" })), /more than one SAI ID/);
});

test("the exact Bonsai chat title is required", () => {
  const badBinding = { ...bound("SAI00000001", threadOne), title: "Different title" };
  const text = registry(event("reserved", "SAI00000001"), badBinding);
  assert.throws(() => validateSessionRegistry(text, glossary()), /invalid exact chat title/);
});

test("every reserved ID must appear exactly once in the glossary", () => {
  const text = registry(
    event("reserved", "SAI00000001"),
    bound("SAI00000001", threadOne),
    event("activated", "SAI00000001"),
    event("reserved", "SAI00000002"),
    bound("SAI00000002", threadTwo),
    event("activated", "SAI00000002"),
  );
  assert.throws(
    () => validateSessionRegistry(text, glossary({ id: "SAI00000001", threadId: threadOne })),
    /different numbers of SAI IDs|missing SAI00000002/,
  );
});
