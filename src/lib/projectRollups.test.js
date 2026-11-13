// Unit tests for Projects 2.0 rollups (src/lib/projectRollups.js).
// Run with: node src/lib/projectRollups.test.js
// (No test framework — plain assertions, house style. Exits non-zero on failure.)

import {
  TASK_STATUSES,
  getTaskStatus, isOpen, isOverdue, isDueToday, isDueThisWeek,
  lastActivityOf, projectStats, dashboardRollup, buildSuggestions,
} from "./projectRollups.js";

let passed = 0;
let failed = 0;
function test(name, fn) {
  try { fn(); console.log(`✓ ${name}`); passed++; }
  catch (e) { console.error(`✗ ${name}\n  ${e.message}`); failed++; }
}
function assert(cond, msg) { if (!cond) throw new Error(msg || "assertion failed"); }
function eq(a, b, msg) { if (a !== b) throw new Error(`${msg || "not equal"}: ${JSON.stringify(a)} !== ${JSON.stringify(b)}`); }
function deepEq(a, b, msg) { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error(`${msg || "not deep equal"}: ${JSON.stringify(a)} !== ${JSON.stringify(b)}`); }

const TODAY = "2026-11-13";

test("TASK_STATUSES matches the plannerApi contract", () => {
  deepEq(TASK_STATUSES, ["backlog", "ready", "in_progress", "blocked", "review", "done"]);
});

test("getTaskStatus: completed wins over status", () => {
  eq(getTaskStatus({ completed: true, status: "blocked" }), "done");
  eq(getTaskStatus({ completed: true, status: "in_progress" }), "done");
  eq(getTaskStatus({ completed: true }), "done");
});

test("getTaskStatus: valid status passes through, invalid/missing falls back to backlog", () => {
  eq(getTaskStatus({ completed: false, status: "ready" }), "ready");
  eq(getTaskStatus({ completed: false, status: "in_progress" }), "in_progress");
  eq(getTaskStatus({ completed: false, status: "blocked" }), "blocked");
  eq(getTaskStatus({ completed: false, status: "review" }), "review");
  eq(getTaskStatus({ completed: false, status: "done" }), "done");
  eq(getTaskStatus({ completed: false, status: "nonsense" }), "backlog");
  eq(getTaskStatus({ completed: false, status: null }), "backlog");
  eq(getTaskStatus({ completed: false }), "backlog");
  eq(getTaskStatus({}), "backlog");
});

test("isOpen is the negation of completed", () => {
  eq(isOpen({ completed: false }), true);
  eq(isOpen({ completed: true }), false);
  eq(isOpen({}), true);
});

test("overdue / due-today / due-this-week windows with fixed today 2026-11-13", () => {
  const open = (date) => ({ completed: false, date });
  // Overdue: strictly before today, open only.
  eq(isOverdue(open("2026-11-12"), TODAY), true);
  eq(isOverdue(open("2026-11-13"), TODAY), false, "today is not overdue");
  eq(isOverdue(open("2026-11-14"), TODAY), false);
  eq(isOverdue({ completed: true, date: "2026-11-12" }, TODAY), false, "completed is never overdue");
  eq(isOverdue(open(null), TODAY), false, "dateless is never overdue");
  // Due today.
  eq(isDueToday(open("2026-11-13"), TODAY), true);
  eq(isDueToday(open("2026-11-12"), TODAY), false);
  eq(isDueToday({ completed: true, date: "2026-11-13" }, TODAY), false);
  // Due this week: [today, today+7) — 2026-11-13 .. 2026-11-19 inclusive.
  eq(isDueThisWeek(open("2026-11-13"), TODAY), true, "window start inclusive");
  eq(isDueThisWeek(open("2026-11-19"), TODAY), true, "today+6 inside");
  eq(isDueThisWeek(open("2026-11-20"), TODAY), false, "today+7 excluded");
  eq(isDueThisWeek(open("2026-11-12"), TODAY), false, "past excluded");
  eq(isDueThisWeek({ completed: true, date: "2026-11-15" }, TODAY), false);
  eq(isDueThisWeek(open(null), TODAY), false);
});

test("lastActivityOf takes the max of completed_date and created_at date part", () => {
  eq(lastActivityOf([]), null);
  eq(lastActivityOf([{ created_at: "2026-11-01T09:00:00Z" }]), "2026-11-01");
  eq(lastActivityOf([
    { created_at: "2026-11-01T09:00:00Z", completed_date: null },
    { created_at: "2026-10-20T09:00:00Z", completed_date: "2026-11-10" },
  ]), "2026-11-10");
  eq(lastActivityOf([{ completed_date: "2026-11-05", created_at: "2026-11-08T12:00:00Z" }]), "2026-11-08");
  eq(lastActivityOf([{ name: "no dates" }]), null);
});

const projA = { id: "p1", name: "Alpha", stage: "development", archived: false, created_at: "2026-09-01T00:00:00Z" };
const projB = { id: "p2", name: "Beta", stage: "planning", archived: false, created_at: "2026-09-01T00:00:00Z" };

test("projectStats counts only the project's tasks, with progress rounded", () => {
  const tasks = [
    { id: "t1", project_id: "p1", completed: true, completed_date: "2026-11-12", created_at: "2026-11-01T00:00:00Z", date: "2026-11-12" },
    { id: "t2", project_id: "p1", completed: false, status: "blocked", created_at: "2026-11-11T00:00:00Z", date: "2026-11-13" },
    { id: "t3", project_id: "p1", completed: false, status: "ready", created_at: "2026-11-10T00:00:00Z", date: "2026-11-10" },
    { id: "t4", project_id: "p2", completed: false, created_at: "2026-11-12T00:00:00Z", date: "2026-11-15" },
    { id: "t5", project_id: null, completed: false, created_at: "2026-11-12T00:00:00Z", date: "2026-11-13" },
  ];
  const s = projectStats(projA, tasks, TODAY);
  eq(s.total, 3); eq(s.done, 1); eq(s.open, 2);
  eq(s.progressPct, 33, "1/3 rounds to 33");
  eq(s.overdue, 1); eq(s.blocked, 1); eq(s.dueToday, 1); eq(s.dueThisWeek, 1);
  eq(s.lastActivity, "2026-11-12");
  eq(s.stalled, false, "activity yesterday is not stalled");
});

test("projectStats: empty project has 0% progress and is not stalled (no open tasks)", () => {
  const s = projectStats(projA, [], TODAY);
  eq(s.total, 0); eq(s.progressPct, 0); eq(s.lastActivity, null); eq(s.stalled, false);
});

test("projectStats stall detection: last activity 14+ days ago stalls", () => {
  const stale = [{ id: "t1", project_id: "p1", completed: false, created_at: "2026-10-30T00:00:00Z", date: null }];
  eq(projectStats(projA, stale, TODAY).stalled, true, "2026-10-30 is exactly 14 days before 2026-11-13");
  const older = [{ id: "t1", project_id: "p1", completed: false, created_at: "2026-10-01T00:00:00Z", date: null }];
  eq(projectStats(projA, older, TODAY).stalled, true);
  const fresh = [{ id: "t1", project_id: "p1", completed: false, created_at: "2026-10-31T00:00:00Z", date: null }];
  eq(projectStats(projA, fresh, TODAY).stalled, false, "13 days is not stalled");
});

test("projectStats stall detection: no task activity falls back to project created_at", () => {
  // Open task exists but carries no dates at all -> lastActivity is null,
  // so the project's own created_at decides.
  const dateless = [{ id: "t1", project_id: "p1", completed: false, date: null }];
  eq(projectStats({ ...projA, created_at: "2026-10-01T00:00:00Z" }, dateless, TODAY).stalled, true);
  eq(projectStats({ ...projA, created_at: "2026-11-10T00:00:00Z" }, dateless, TODAY).stalled, false);
});

test("projectStats stall exclusions: archived, completed stage, and no open tasks never stall", () => {
  const stale = [{ id: "t1", project_id: "p1", completed: false, created_at: "2026-10-01T00:00:00Z", date: null }];
  eq(projectStats({ ...projA, archived: true }, stale, TODAY).stalled, false, "archived excluded");
  eq(projectStats({ ...projA, stage: "completed" }, stale, TODAY).stalled, false, "completed stage excluded");
  const allDone = [{ id: "t1", project_id: "p1", completed: true, completed_date: "2026-10-01", created_at: "2026-10-01T00:00:00Z" }];
  eq(projectStats(projA, allDone, TODAY).stalled, false, "open = 0 never stalls");
});

test("dashboardRollup: active projects are top-level, unarchived, not completed", () => {
  const projects = [
    projA,
    projB,
    { id: "p3", name: "Child", parent_id: "p1", stage: "planning", archived: false, created_at: "2026-09-01T00:00:00Z" },
    { id: "p4", name: "Archived", stage: "planning", archived: true, created_at: "2026-09-01T00:00:00Z" },
    { id: "p5", name: "Done", stage: "completed", archived: false, created_at: "2026-09-01T00:00:00Z" },
  ];
  const tasks = [
    { id: "t1", project_id: "p1", completed: false, status: "blocked", date: "2026-11-13", created_at: "2026-10-01T00:00:00Z" },
    { id: "t2", project_id: "p2", completed: false, date: "2026-11-10", created_at: "2026-11-12T00:00:00Z" },
    { id: "t3", project_id: "p2", completed: false, date: "2026-11-15", created_at: "2026-11-12T00:00:00Z" },
    { id: "t4", project_id: null, completed: true, completed_date: "2026-11-07", created_at: "2026-11-01T00:00:00Z" },
    { id: "t5", project_id: null, completed: true, completed_date: "2026-11-05", created_at: "2026-11-01T00:00:00Z" },
    { id: "t6", project_id: null, completed: true, completed_date: "2026-11-13", created_at: "2026-11-01T00:00:00Z" },
  ];
  const r = dashboardRollup(projects, tasks, TODAY);
  eq(r.activeProjects, 2, "only Alpha and Beta");
  eq(r.dueToday, 1); eq(r.overdue, 1); eq(r.blocked, 1); eq(r.dueThisWeek, 2, "today + 2026-11-15");
  deepEq(r.stalledProjects, ["p1"], "Alpha's only activity is its blocked task from 2026-10-01; Beta is fresh");
  eq(r.recentlyCompleted, 2, "completed_date within [today-7, today]: 11-07 and 11-13; 11-05 is outside");
});

test("buildSuggestions: kinds, text, ids, and ordering", () => {
  const projects = [
    projA,
    projB,
    { id: "p3", name: "Gamma", stage: "idea", archived: false, created_at: "2026-11-12T00:00:00Z" },
  ];
  const tasks = [
    { id: "t-over", project_id: "p1", name: "Ship it", completed: false, date: "2026-11-01", created_at: "2026-11-12T00:00:00Z" },
    { id: "t-block", project_id: "p1", name: "Fix bug", completed: false, status: "blocked", date: null, created_at: "2026-11-12T00:00:00Z" },
    // Beta has only a stale open task -> stalled, and it still has an open task.
    { id: "t-stale", project_id: "p2", name: "Old chore", completed: false, date: null, created_at: "2026-10-01T00:00:00Z" },
    // Gamma (p3) has no tasks at all -> no_next_task.
  ];
  const milestones = [
    { id: "m1", project_id: "p1", name: "Beta launch", completed: false, target_date: "2026-11-01" },
    { id: "m2", project_id: "p1", name: "Future", completed: false, target_date: "2026-12-01" },
    { id: "m3", project_id: "p1", name: "Done one", completed: true, target_date: "2026-11-01" },
  ];
  const s = buildSuggestions({ projects, tasks, milestones, todayStr: TODAY });
  deepEq(s.map((x) => x.kind), ["overdue", "blocked", "milestone_overdue", "stalled", "no_next_task"], "contractual kind order");
  deepEq(s.map((x) => x.id), ["overdue:t-over", "blocked:t-block", "milestone_overdue:m1", "stalled:p2", "no_next_task:p3"]);
  eq(s[0].text, 'Overdue: "Ship it" in Alpha');
  eq(s[0].projectId, "p1"); eq(s[0].taskId, "t-over");
  eq(s[1].taskId, "t-block");
  eq(s[2].projectId, "p1"); eq(s[2].taskId, null);
  eq(s[3].projectId, "p2"); eq(s[3].taskId, null);
  eq(s[4].projectId, "p3");
  assert(s[4].text.includes("Gamma"), "no_next_task names the project");
});

test("buildSuggestions: caps are 5 overdue, 5 blocked, 3 milestone_overdue, 3 stalled, 3 no_next_task", () => {
  const many = (prefix, n, extra) => Array.from({ length: n }, (_, i) => ({ id: `${prefix}${i}`, ...extra(i) }));
  const projects = [
    { id: "px", name: "Main", stage: "development", archived: false, created_at: "2026-11-12T00:00:00Z" },
    ...many("ps", 5, (i) => ({ name: `Stalled ${i}`, stage: "planning", archived: false, created_at: "2026-09-01T00:00:00Z" })),
    ...many("pn", 5, (i) => ({ name: `Empty ${i}`, stage: "idea", archived: false, created_at: "2026-11-12T00:00:00Z" })),
  ];
  const tasks = [
    ...many("to", 7, () => ({ project_id: "px", name: "Over", completed: false, date: "2026-11-01", created_at: "2026-11-12T00:00:00Z" })),
    ...many("tb", 7, () => ({ project_id: "px", name: "Block", completed: false, status: "blocked", date: null, created_at: "2026-11-12T00:00:00Z" })),
    // One stale open task per stalled project.
    ...many("ts", 5, (i) => ({ project_id: `ps${i}`, name: "Stale", completed: false, date: null, created_at: "2026-10-01T00:00:00Z" })),
  ];
  const milestones = many("mm", 5, () => ({ project_id: "px", name: "Mile", completed: false, target_date: "2026-11-01" }));
  const s = buildSuggestions({ projects, tasks, milestones, todayStr: TODAY });
  const count = (kind) => s.filter((x) => x.kind === kind).length;
  eq(count("overdue"), 5); eq(count("blocked"), 5); eq(count("milestone_overdue"), 3);
  eq(count("stalled"), 3); eq(count("no_next_task"), 3);
  // Order still holds under caps.
  deepEq([...new Set(s.map((x) => x.kind))], ["overdue", "blocked", "milestone_overdue", "stalled", "no_next_task"]);
});

test("buildSuggestions: empty inputs produce no suggestions", () => {
  deepEq(buildSuggestions({ projects: [], tasks: [], milestones: [], todayStr: TODAY }), []);
  deepEq(buildSuggestions({ projects: [], tasks: [], todayStr: TODAY }), [], "milestones optional");
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
