// Unit tests for the task copy text builder (src/lib/taskCopy.js).
// Run with: node src/lib/taskCopy.test.js
// (No test framework — plain assertions, house style. Exits non-zero on failure.)

import { buildTaskCopyText, taskDocNames } from "./taskCopy.js";

let passed = 0;
let failed = 0;
function test(name, fn) {
  try { fn(); console.log(`✓ ${name}`); passed++; }
  catch (e) { console.error(`✗ ${name}\n  ${e.message}`); failed++; }
}
function eq(a, b, msg) { if (a !== b) throw new Error(`${msg || "not equal"}:\n--- actual ---\n${JSON.stringify(a)}\n--- expected ---\n${JSON.stringify(b)}`); }

test("full brief: title, due, project, description, documents", () => {
  eq(buildTaskCopyText({
    title: "Bug: Date picker broken for past days",
    due: "Thursday, Jan 15th",
    projectName: "heyScottyBro",
    description: "Picking a past day in Accountability does nothing.",
    documents: ["Screenshot of picker", "Console errors.txt"],
  }), [
    "Title: Bug: Date picker broken for past days",
    "Due: Thursday, Jan 15th",
    "Project: heyScottyBro",
    "Description:",
    "Picking a past day in Accountability does nothing.",
    "Documents:",
    "- Screenshot of picker",
    "- Console errors.txt",
  ].join("\n"));
});

test("no documents: Documents section reads None", () => {
  const text = buildTaskCopyText({ title: "Call the bank", due: "Friday, Nov 14th", description: "Ask about the charge." });
  eq(text.endsWith("Documents:\nNone"), true);
});

test("no due date: Due reads No due date", () => {
  const text = buildTaskCopyText({ title: "Someday idea", due: null });
  eq(text.split("\n")[1], "Due: No due date");
});

test("no description: Description section reads None", () => {
  const text = buildTaskCopyText({ title: "Bare task", due: "Friday, Nov 14th", description: "   " });
  eq(text.includes("Description:\nNone\n"), true);
});

test("no project: Project line is omitted entirely", () => {
  const text = buildTaskCopyText({ title: "Loose task", projectName: null, description: "x" });
  eq(text.includes("Project:"), false);
});

test("empty everything still produces the skeleton", () => {
  eq(buildTaskCopyText({}), "Title: \nDue: No due date\nDescription:\nNone\nDocuments:\nNone");
});

test("taskDocNames trims and drops blanks and missing titles", () => {
  eq(
    JSON.stringify(taskDocNames([{ node_title: "  Spec.pdf " }, { node_title: "" }, {}, { node_title: "Notes" }, null])),
    JSON.stringify(["Spec.pdf", "Notes"]),
  );
});

test("taskDocNames tolerates no links", () => {
  eq(JSON.stringify(taskDocNames(undefined)), "[]");
  eq(JSON.stringify(taskDocNames([])), "[]");
});

test("builder drops blank document names", () => {
  const text = buildTaskCopyText({ title: "T", documents: ["", "  ", "Real doc"] });
  eq(text.endsWith("Documents:\n- Real doc"), true);
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
