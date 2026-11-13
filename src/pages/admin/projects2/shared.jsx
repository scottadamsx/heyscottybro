// Projects 2.0 shared helpers: status/stage normalisation, rollup adapters.
//
// Workstream A owns src/lib/projectRollups.js and the plannerApi constants.
// Its exact return shapes were still landing when this was written, so every
// adapter here prefers the imported function's values when they are present
// and recognisable, and falls back to a local computation from the raw rows
// otherwise. That keeps the surfaces honest either way.
import {
  TASK_STATUSES, TASK_STATUS_LABELS, PROJECT_STAGES, PROJECT_STAGE_LABELS,
} from "../../../api/plannerApi";
import * as rollups from "../../../lib/projectRollups";
import { toDateStr } from "../../../utils/plannerUtils";

const normList = (list, labels, fallback) => {
  const src = Array.isArray(list) && list.length ? list : fallback;
  return src.map((item) => {
    if (item && typeof item === "object") {
      const value = item.value || item.key || item.id || item.status || item.stage;
      return { value: String(value), label: item.label || labels?.[value] || String(value) };
    }
    return { value: String(item), label: labels?.[item] || String(item) };
  });
};

export const STATUSES = normList(TASK_STATUSES, TASK_STATUS_LABELS, [
  "backlog", "ready", "in_progress", "blocked", "review", "done",
]);
export const STATUS_LABEL = Object.fromEntries(STATUSES.map((s) => [s.value, s.label]));
if (!STATUS_LABEL.backlog) Object.assign(STATUS_LABEL, {
  backlog: "Backlog", ready: "Ready", in_progress: "In Progress",
  blocked: "Blocked", review: "Review", done: "Done",
});

export const STAGES = normList(PROJECT_STAGES, PROJECT_STAGE_LABELS, [
  "idea", "discovery", "planning", "development", "testing", "launch", "maintenance", "completed",
]);
export const STAGE_LABEL = Object.fromEntries(STAGES.map((s) => [s.value, s.label]));
if (!STAGE_LABEL.idea) Object.assign(STAGE_LABEL, {
  idea: "Idea", discovery: "Discovery", planning: "Planning", development: "Development",
  testing: "Testing", launch: "Launch", maintenance: "Maintenance", completed: "Completed",
});

export const stageOf = (project) => project?.stage || "idea";
export const stageLabel = (project) => STAGE_LABEL[stageOf(project)] || stageOf(project);

const STATUS_TONE = {
  backlog: "var(--text-muted)", ready: "var(--blue)", in_progress: "var(--accent)",
  blocked: "var(--red)", review: "var(--orange)", done: "var(--green)",
};
const STAGE_TONE = {
  idea: "var(--text-muted)", discovery: "var(--cyan)", planning: "var(--blue)",
  development: "var(--accent)", testing: "var(--orange)", launch: "var(--green)",
  maintenance: "var(--blue)", completed: "var(--green)",
};

/** Dot + text label. Status is never colour alone. */
export function StatusDot({ status, label }) {
  const value = status || "backlog";
  return (
    <span className="p2-status">
      <span className="p2-status-dot" style={{ background: STATUS_TONE[value] || "var(--text-muted)" }} aria-hidden="true" />
      <span>{label || STATUS_LABEL[value] || value}</span>
    </span>
  );
}

export function StageDot({ stage, label }) {
  const value = stage || "idea";
  return (
    <span className="p2-status">
      <span className="p2-status-dot" style={{ background: STAGE_TONE[value] || "var(--text-muted)" }} aria-hidden="true" />
      <span>{label || STAGE_LABEL[value] || value}</span>
    </span>
  );
}

export function getStatus(task) {
  try {
    if (typeof rollups.getTaskStatus === "function") {
      const s = rollups.getTaskStatus(task);
      if (typeof s === "string" && s) return s;
    }
  } catch { /* fall through to the local rule */ }
  if (!task) return "backlog";
  return task.completed ? "done" : (task.status || "backlog");
}

export const isDone = (task) => getStatus(task) === "done" || Boolean(task?.completed);

const todayStr = () => toDateStr(new Date());

export function isOverdue(task) {
  try {
    if (typeof rollups.isOverdue === "function") return Boolean(rollups.isOverdue(task, todayStr()));
  } catch { /* local rule */ }
  return Boolean(task && !isDone(task) && task.date && task.date < todayStr());
}
export function isDueToday(task) {
  try {
    if (typeof rollups.isDueToday === "function") return Boolean(rollups.isDueToday(task, todayStr()));
  } catch { /* local rule */ }
  return Boolean(task && !isDone(task) && task.date === todayStr());
}
export function isDueThisWeek(task) {
  try {
    if (typeof rollups.isDueThisWeek === "function") return Boolean(rollups.isDueThisWeek(task, todayStr()));
  } catch { /* local rule */ }
  if (!task || isDone(task) || !task.date) return false;
  const end = new Date(); end.setDate(end.getDate() + 7);
  return task.date >= todayStr() && task.date <= toDateStr(end);
}

/** Tasks that belong to a project (its own rows only, not sub-projects'). */
export const tasksForProject = (tasks, projectId) =>
  (tasks || []).filter((t) => String(t.project_id) === String(projectId));

function localStats(project, tasks) {
  const mine = tasksForProject(tasks, project?.id);
  const done = mine.filter(isDone);
  const open = mine.filter((t) => !isDone(t));
  const lastActivity = mine
    .map((t) => t.completed_date || t.date || t.created_at || "")
    .sort().pop() || project?.created_at || "";
  const stalled = open.length > 0 && Boolean(lastActivity)
    && (Date.now() - new Date(lastActivity).getTime()) > 14 * 86400000;
  return {
    total: mine.length,
    done: done.length,
    open: open.length,
    overdue: open.filter(isOverdue).length,
    blocked: open.filter((t) => getStatus(t) === "blocked").length,
    dueToday: open.filter(isDueToday).length,
    progress: mine.length ? done.length / mine.length : 0,
    stalled,
    recentlyCompleted: done.filter((t) => t.completed_date
      && (Date.now() - new Date(t.completed_date).getTime()) <= 7 * 86400000).length,
  };
}

const pickNum = (raw, keys, fallback) => {
  for (const k of keys) {
    const v = raw?.[k];
    if (Array.isArray(v)) return v.length;
    if (typeof v === "number" && Number.isFinite(v)) return v;
  }
  return fallback;
};

/** Normalised stats for one project, preferring projectStats() values. */
export function statsFor(project, tasks) {
  const local = localStats(project, tasks);
  let raw = null;
  try {
    if (typeof rollups.projectStats === "function") {
      raw = rollups.projectStats(project, tasks, todayStr());
    }
  } catch { raw = null; }
  if (!raw || typeof raw !== "object") return local;
  let progress = typeof raw.progressPct === "number"
    ? raw.progressPct / 100
    : pickNum(raw, ["progress", "percent", "pct", "completion"], local.progress);
  if (progress > 1) progress = progress / 100;
  return {
    total: pickNum(raw, ["total", "taskTotal", "count", "tasks"], local.total),
    done: pickNum(raw, ["done", "completed", "doneCount", "completedCount"], local.done),
    open: pickNum(raw, ["open", "openCount", "active"], local.open),
    overdue: pickNum(raw, ["overdue", "overdueCount"], local.overdue),
    blocked: pickNum(raw, ["blocked", "blockedCount"], local.blocked),
    dueToday: pickNum(raw, ["dueToday", "dueTodayCount"], local.dueToday),
    progress,
    stalled: typeof raw.stalled === "boolean" ? raw.stalled : (typeof raw.isStalled === "boolean" ? raw.isStalled : local.stalled),
    recentlyCompleted: pickNum(raw, ["recentlyCompleted", "recentlyCompletedCount"], local.recentlyCompleted),
  };
}

function localAttention(tasks) {
  return (tasks || [])
    .filter((t) => !isDone(t) && (isOverdue(t) || getStatus(t) === "blocked"))
    .slice()
    .sort((a, b) => String(a.date || "9999").localeCompare(String(b.date || "9999")));
}

/** Normalised dashboard rollup: counts + the needs-attention task list. */
export function dashboardData(projects, tasks) {
  const active = (projects || []).filter((p) => !p.archived && stageOf(p) !== "completed");
  const open = (tasks || []).filter((t) => !isDone(t));
  const local = {
    activeProjects: active.length,
    dueToday: open.filter(isDueToday).length,
    overdue: open.filter(isOverdue).length,
    blocked: open.filter((t) => getStatus(t) === "blocked").length,
    dueThisWeek: open.filter(isDueThisWeek).length,
    stalled: active.filter((p) => statsFor(p, tasks).stalled).length,
    recentlyCompleted: (tasks || []).filter((t) => isDone(t) && t.completed_date
      && (Date.now() - new Date(t.completed_date).getTime()) <= 7 * 86400000).length,
    attention: localAttention(tasks),
  };
  let raw = null;
  try {
    if (typeof rollups.dashboardRollup === "function") {
      raw = rollups.dashboardRollup(projects, tasks, todayStr());
    }
  } catch { raw = null; }
  if (!raw || typeof raw !== "object") return local;
  const attentionRaw = raw.needsAttention || raw.attention || raw.needs_attention;
  return {
    activeProjects: pickNum(raw, ["activeProjects", "active", "activeCount"], local.activeProjects),
    dueToday: pickNum(raw, ["dueToday", "dueTodayCount", "today"], local.dueToday),
    overdue: pickNum(raw, ["overdue", "overdueCount"], local.overdue),
    blocked: pickNum(raw, ["blocked", "blockedCount"], local.blocked),
    dueThisWeek: pickNum(raw, ["dueThisWeek", "dueThisWeekCount", "thisWeek"], local.dueThisWeek),
    stalled: pickNum(raw, ["stalledProjects", "stalled", "stalledCount"], local.stalled),
    recentlyCompleted: pickNum(raw, ["recentlyCompleted", "recentlyCompletedCount", "doneThisWeek"], local.recentlyCompleted),
    attention: Array.isArray(attentionRaw) && attentionRaw.length
      ? attentionRaw.map((x) => (x && x.task ? x.task : x)).filter((x) => x && x.id)
      : local.attention,
  };
}

/** Normalised suggestions from buildSuggestions(), whatever its item shape. */
export function suggestionsFor(projects, tasks, milestones) {
  let raw = null;
  try {
    if (typeof rollups.buildSuggestions === "function") {
      raw = rollups.buildSuggestions({ projects, tasks, milestones, todayStr: todayStr() });
    }
  } catch { raw = null; }
  if (!Array.isArray(raw)) return [];
  return raw.map((s, i) => {
    const type = s.kind || s.type || s.reason || "suggestion";
    const projectId = s.project_id || s.projectId || s.project?.id || null;
    const taskId = s.task_id || s.taskId || s.task?.id || null;
    const project = (projects || []).find((p) => String(p.id) === String(projectId));
    const task = (tasks || []).find((t) => String(t.id) === String(taskId));
    return {
      id: String(s.id || `${type}-${projectId || ""}-${taskId || ""}-${i}`),
      type: String(type),
      projectId, taskId, project, task,
      text: s.title || s.message || s.body || s.label || s.text
        || (task ? task.name : project ? project.name : "Suggested next step"),
    };
  });
}

export function ProgressBar({ value, label }) {
  const pct = Math.round(Math.max(0, Math.min(1, Number(value) || 0)) * 100);
  return (
    <div className="p2-progress" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={label || "Progress"}>
      <span style={{ width: `${pct}%` }} />
    </div>
  );
}
