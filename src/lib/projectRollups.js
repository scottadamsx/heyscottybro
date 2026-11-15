// ── Projects 2.0 rollups (pure logic, no I/O, no api imports) ───────────────
//
// Status / stage values are duplicated here on purpose: plannerApi exports
// the same lists as its contract, and this lib must not import the api
// (circular-import risk). Keep the values identical to plannerApi's
// TASK_STATUSES / PROJECT_STAGES.
//
// Dates are local calendar dates as "YYYY-MM-DD" strings; string comparison
// orders them correctly, and day differences use local Date arithmetic
// (mirrors src/utils/plannerUtils.js without importing it).

export const TASK_STATUSES = ["backlog", "ready", "in_progress", "blocked", "review", "done"];
export const TASK_STATUS_LABELS = {
  backlog: "Backlog",
  ready: "Ready",
  in_progress: "In Progress",
  blocked: "Blocked",
  review: "Review",
  done: "Done",
};

export const PROJECT_STAGES = ["idea", "discovery", "planning", "development", "testing", "launch", "maintenance", "completed"];
export const PROJECT_STAGE_LABELS = {
  idea: "Idea",
  discovery: "Discovery",
  planning: "Planning",
  development: "Development",
  testing: "Testing",
  launch: "Launch",
  maintenance: "Maintenance",
  completed: "Completed",
};

const STALLED_DAYS = 14;

function datePart(value) {
  if (!value) return null;
  const s = String(value).slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null;
}

function parseDateStr(str) {
  const [y, m, d] = String(str).split("-").map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

function toDateStr(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function addDays(dateStr, n) {
  const d = parseDateStr(dateStr);
  d.setDate(d.getDate() + n);
  return toDateStr(d);
}

/** Whole days from `fromStr` to `toStr` (toStr - fromStr). */
function daysBetween(fromStr, toStr) {
  return Math.round((parseDateStr(toStr) - parseDateStr(fromStr)) / 86400000);
}

export function getTaskStatus(task) {
  if (!task) return "backlog";
  if (task.completed) return "done";
  return TASK_STATUSES.includes(task.status) ? task.status : "backlog";
}

export function isOpen(task) {
  return !task?.completed;
}

export function isOverdue(task, todayStr) {
  return Boolean(isOpen(task) && task.date && task.date < todayStr);
}

export function isDueToday(task, todayStr) {
  return Boolean(isOpen(task) && task.date && task.date === todayStr);
}

export function isDueThisWeek(task, todayStr) {
  if (!isOpen(task) || !task.date || !todayStr) return false;
  return task.date >= todayStr && task.date < addDays(todayStr, 7);
}

export function lastActivityOf(tasks) {
  let latest = null;
  for (const task of tasks || []) {
    for (const candidate of [datePart(task?.completed_date), datePart(task?.created_at)]) {
      if (candidate && (!latest || candidate > latest)) latest = candidate;
    }
  }
  return latest;
}

export function projectStats(project, tasks, todayStr) {
  const own = (tasks || []).filter(
    (t) => t?.project_id != null && project?.id != null && String(t.project_id) === String(project.id),
  );
  const total = own.length;
  const done = own.filter((t) => Boolean(t.completed)).length;
  const open = total - done;
  const overdue = own.filter((t) => isOverdue(t, todayStr)).length;
  const blocked = own.filter((t) => getTaskStatus(t) === "blocked").length;
  const dueToday = own.filter((t) => isDueToday(t, todayStr)).length;
  const dueThisWeek = own.filter((t) => isDueThisWeek(t, todayStr)).length;
  const progressPct = total === 0 ? 0 : Math.round((done / total) * 100);
  const lastActivity = lastActivityOf(own);

  let stalled = false;
  if (project && project.stage !== "completed" && !project.archived && open > 0 && todayStr) {
    if (lastActivity) {
      stalled = daysBetween(lastActivity, todayStr) >= STALLED_DAYS;
    } else {
      const created = datePart(project.created_at);
      stalled = created ? daysBetween(created, todayStr) >= STALLED_DAYS : false;
    }
  }

  return { total, done, open, overdue, blocked, dueToday, dueThisWeek, progressPct, lastActivity, stalled };
}

export function dashboardRollup(projects, tasks, todayStr) {
  const allProjects = projects || [];
  const allTasks = tasks || [];
  const active = allProjects.filter(
    (p) => p && p.parent_id == null && !p.archived && p.stage !== "completed",
  );
  const stalledProjects = active
    .filter((p) => projectStats(p, allTasks, todayStr).stalled)
    .map((p) => p.id);
  const weekStart = todayStr ? addDays(todayStr, -7) : null;
  const recentlyCompleted = allTasks.filter((t) => {
    const cd = datePart(t?.completed_date);
    return Boolean(cd && weekStart && cd >= weekStart && cd <= todayStr);
  }).length;

  return {
    activeProjects: active.length,
    dueToday: allTasks.filter((t) => isDueToday(t, todayStr)).length,
    overdue: allTasks.filter((t) => isOverdue(t, todayStr)).length,
    blocked: allTasks.filter((t) => getTaskStatus(t) === "blocked").length,
    dueThisWeek: allTasks.filter((t) => isDueThisWeek(t, todayStr)).length,
    stalledProjects,
    recentlyCompleted,
  };
}

export function buildSuggestions({ projects, tasks, milestones, todayStr } = {}) {
  const allProjects = projects || [];
  const allTasks = tasks || [];
  const allMilestones = milestones || [];
  const projectById = new Map(allProjects.map((p) => [String(p.id), p]));
  const projectName = (id) => (id != null ? projectById.get(String(id))?.name : null);

  const inProject = (task) => {
    const name = projectName(task.project_id);
    return name ? ` in ${name}` : "";
  };

  const overdue = allTasks
    .filter((t) => isOverdue(t, todayStr))
    .slice(0, 5)
    .map((t) => ({
      id: `overdue:${t.id}`,
      kind: "overdue",
      text: `Overdue: "${t.name}"${inProject(t)}`,
      projectId: t.project_id ?? null,
      taskId: t.id,
    }));

  const blocked = allTasks
    .filter((t) => getTaskStatus(t) === "blocked")
    .slice(0, 5)
    .map((t) => ({
      id: `blocked:${t.id}`,
      kind: "blocked",
      text: `Blocked: "${t.name}"${inProject(t)}`,
      projectId: t.project_id ?? null,
      taskId: t.id,
    }));

  const milestoneOverdue = allMilestones
    .filter((m) => m && !m.completed && m.target_date && m.target_date < todayStr)
    .slice(0, 3)
    .map((m) => ({
      id: `milestone_overdue:${m.id}`,
      kind: "milestone_overdue",
      text: `Milestone overdue: "${m.name}"${m.project_id != null && projectName(m.project_id) ? ` in ${projectName(m.project_id)}` : ""}`,
      projectId: m.project_id ?? null,
      taskId: null,
    }));

  const stalled = allProjects
    .filter((p) => projectStats(p, allTasks, todayStr).stalled)
    .slice(0, 3)
    .map((p) => ({
      id: `stalled:${p.id}`,
      kind: "stalled",
      text: `Stalled: "${p.name}" has had no activity in 14+ days`,
      projectId: p.id,
      taskId: null,
    }));

  const noNextTask = allProjects
    .filter((p) => p && !p.archived && p.stage !== "completed")
    .filter((p) => projectStats(p, allTasks, todayStr).open === 0)
    .slice(0, 3)
    .map((p) => ({
      id: `no_next_task:${p.id}`,
      kind: "no_next_task",
      text: `No next step: "${p.name}" has no open tasks, add a next step`,
      projectId: p.id,
      taskId: null,
    }));

  // Order is contractual: overdue, blocked, milestone_overdue, stalled, no_next_task.
  return [...overdue, ...blocked, ...milestoneOverdue, ...stalled, ...noNextTask];
}
