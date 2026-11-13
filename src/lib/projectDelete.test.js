// Unit tests for the project delete tree helper (src/lib/projectDelete.js).
// Run with: node src/lib/projectDelete.test.js
// (No test framework — plain assertions, house style. Exits non-zero on failure.)
//
// Regression coverage for BUG-087/BUG-094 (follow-up, 2026-11-13): after a
// confirmed delete the page removes the project tree from local state,
// toasts and navigates immediately via removeProjectTree, so the feedback
// no longer depends on the post-delete reload.

import { projectTreeIds, removeProjectTree } from "./projectDelete.js";

let passed = 0;
let failed = 0;
function test(name, fn) {
  try { fn(); console.log(`✓ ${name}`); passed++; }
  catch (e) { console.error(`✗ ${name}\n  ${e.message}`); failed++; }
}
function eq(a, b, msg) { if (a !== b) throw new Error(`${msg || "not equal"}: ${JSON.stringify(a)} !== ${JSON.stringify(b)}`); }
function deepEq(a, b, msg) { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error(`${msg || "not deep equal"}: ${JSON.stringify(a)} !== ${JSON.stringify(b)}`); }

const projects = [
  { id: "root", name: "Root", parent_id: null },
  { id: "child", name: "Child", parent_id: "root" },
  { id: "grandchild", name: "Grandchild", parent_id: "child" },
  { id: "other", name: "Other", parent_id: null },
  { id: "other-child", name: "Other child", parent_id: "other" },
];
const tasks = [
  { id: "t1", name: "Root task", project_id: "root" },
  { id: "t2", name: "Grandchild task", project_id: "grandchild" },
  { id: "t3", name: "Other task", project_id: "other" },
  { id: "t4", name: "Loose task", project_id: null },
];

test("projectTreeIds: root plus descendants at any depth, root first", () => {
  deepEq(projectTreeIds(projects, "root"), ["root", "child", "grandchild"]);
});

test("projectTreeIds: a leaf project is just itself", () => {
  deepEq(projectTreeIds(projects, "grandchild"), ["grandchild"]);
});

test("removeProjectTree: drops the whole tree and its tasks only", () => {
  const next = removeProjectTree(projects, tasks, "root");
  deepEq(next.projects.map((p) => p.id), ["other", "other-child"]);
  deepEq(next.tasks.map((t) => t.id), ["t3", "t4"]);
  deepEq(next.removedIds, ["root", "child", "grandchild"]);
});

test("removeProjectTree: deleting a sub-project leaves its parent and siblings", () => {
  const next = removeProjectTree(projects, tasks, "child");
  deepEq(next.projects.map((p) => p.id), ["root", "other", "other-child"]);
  deepEq(next.tasks.map((t) => t.id), ["t1", "t3", "t4"]);
});

test("removeProjectTree: unknown id changes nothing", () => {
  const next = removeProjectTree(projects, tasks, "missing");
  eq(next.projects.length, projects.length);
  eq(next.tasks.length, tasks.length);
});

test("removeProjectTree: ids compare as strings (uuid vs numeric safety)", () => {
  const mixed = [{ id: 7, parent_id: null }, { id: "8", parent_id: 7 }];
  deepEq(projectTreeIds(mixed, "7"), ["7", "8"]);
});

test("removeProjectTree: inputs are not mutated", () => {
  const p = projects.map((x) => ({ ...x }));
  const t = tasks.map((x) => ({ ...x }));
  removeProjectTree(p, t, "root");
  eq(p.length, projects.length);
  eq(t.length, tasks.length);
});

test("removeProjectTree: empty and null inputs are safe", () => {
  deepEq(removeProjectTree([], [], "x").projects, []);
  deepEq(removeProjectTree(null, null, "x").tasks, []);
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
