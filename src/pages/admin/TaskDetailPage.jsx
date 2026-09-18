import { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { loadReminders, loadProjects, updateReminder, completeReminder, deleteReminder } from "../../api/plannerApi";
import DocLinks from "../../components/docs/DocLinks";
import { formatDisplayDate, toDateStr, formatTime12, nextOccurrence } from "../../utils/plannerUtils";
import TaskFormModal, { taskToForm } from "../../components/TaskFormModal";
import { onDataChange } from "../../utils/dataEvents";
import { useConfirm } from "../../hooks/useConfirm";
import "./plan.css";
import { PageSkeleton } from "../../components/Skeleton";

const RECUR_LABEL = { none: "One-time", daily: "Daily", weekly: "Weekly", monthly: "Monthly" };

export default function TaskDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { confirm, dialog } = useConfirm();

  const [task, setTask] = useState(null);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false); // the Edit task modal
  // "Failed to load" and "not found" are different states: a failed load must
  // never render as "this task may have been deleted" (QF-3).
  const [loadError, setLoadError] = useState(null);

  const todayStr = toDateStr(new Date());

  const load = async () => {
    setLoadError(null);
    const [remRes, projRes] = await Promise.allSettled([loadReminders(), loadProjects()]);
    if (remRes.status === "rejected") {
      console.error("[task] failed to load tasks", remRes.reason);
      setLoadError(remRes.reason?.message || String(remRes.reason));
      setLoading(false);
      return;
    }
    if (projRes.status === "rejected") {
      // The task itself still renders; the project link just can't resolve.
      console.error("[task] failed to load projects", projRes.reason);
      setLoadError(`projects: ${projRes.reason?.message || projRes.reason}`);
    } else {
      setProjects(projRes.value);
    }
    setTask(remRes.value.find((r) => String(r.id) === String(id)) || null);
    setLoading(false);
  };

  useEffect(() => { setLoading(true); load(); }, [id]);
  // Stay in sync if Frodo or another tab edits this reminder.
  useEffect(() => onDataChange("reminders", load), [id]);

  const project = useMemo(
    () => projects.find((p) => String(p.id) === String(task?.project_id)) || null,
    [projects, task]
  );

  // Optimistic: the page reflects the edit at once; a failed save puts the
  // task back and throws, so the modal stays open with the error.
  const saveEdit = async (fields) => {
    const prev = task;
    setTask((t) => ({ ...t, ...fields }));
    try {
      await updateReminder(id, fields);
    } catch (err) {
      setTask(prev);
      throw new Error(`Couldn't save task: ${err?.message || "unknown error"}`, { cause: err });
    }
  };

  const handleComplete = async () => {
    const recurring = task.recurrence && task.recurrence !== "none";
    // Recurring: tick off the pending occurrence (which may be a missed one),
    // not "today" — the series then shows its next date.
    const occurrence = recurring ? (nextOccurrence(task, todayStr) || todayStr) : todayStr;
    setTask((prev) => (recurring ? { ...prev, completed_date: occurrence } : { ...prev, completed: true, completed_date: occurrence }));
    try {
      const patch = await completeReminder(id, occurrence);
      setTask((prev) => ({ ...prev, ...patch }));
    } catch (err) {
      setLoadError(`Couldn't complete: ${err?.message || err}`);
      await load();
    }
  };

  const handleReopen = async () => {
    setTask((prev) => ({ ...prev, completed: false, completed_date: null }));
    try { await updateReminder(id, { completed: false, completed_date: null }); }
    catch (err) { await load(); setLoadError(`Couldn't reopen: ${err?.message || err}`); }
  };

  const handleDelete = async () => {
    if (!(await confirm(`Delete "${task?.name || "this task"}"?`, { title: "Delete task", confirmLabel: "Delete" }))) return;
    try {
      await deleteReminder(id);
      navigate("/admin/planner");
    } catch (err) {
      await load();
      setLoadError(`Couldn't delete: ${err?.message || err}`);
    }
  };

  if (loading) {
    return (
      <div className="module-page">
        <PageSkeleton variant="detail" label="Loading task" header={false} page={false} />
      </div>
    );
  }

  if (!task && loadError) {
    return (
      <div className="module-page">
        <div className="module-header">
          <h1>Couldn't load task</h1>
          <button type="button" className="btn-secondary-sm" onClick={() => navigate("/admin/planner")}><i className="fa-solid fa-arrow-left" aria-hidden="true" /> Back to tasks</button>
        </div>
        <div className="load-error" role="alert">
          <p className="load-error-msg">{loadError}</p>
          <button type="button" className="btn-secondary-sm" onClick={() => { setLoading(true); load(); }}>Retry</button>
        </div>
      </div>
    );
  }

  if (!task) {
    return (
      <div className="module-page">
        <div className="module-header">
          <h1>Task not found</h1>
          <button type="button" className="btn-secondary-sm" onClick={() => navigate("/admin/planner")}><i className="fa-solid fa-arrow-left" aria-hidden="true" /> Back to tasks</button>
        </div>
        <p className="no-entries">No task with this id — it may have been deleted.</p>
      </div>
    );
  }

  const isRecurring = task.recurrence && task.recurrence !== "none";
  const next = nextOccurrence(task, todayStr); // one-time: its date; recurring: pending occurrence
  const overdue = !task.completed && next && next < todayStr;
  const dueToday = !task.completed && next === todayStr;

  return (
    <div className="module-page">
      {dialog}
      {loadError && (
        <div className="load-error" role="alert">
          <p className="load-error-msg">{loadError}</p>
          <button type="button" className="btn-secondary-sm" onClick={load}>Retry</button>
        </div>
      )}

      <div className="module-header">
        <h1>Task</h1>
        <button type="button" className="btn-secondary-sm" onClick={() => navigate(-1)}><i className="fa-solid fa-arrow-left" aria-hidden="true" /> Back</button>
      </div>

      {/* ── Summary: project · title · status ── */}
      <section className="db-card task-hero" aria-label="Task summary">
        <div className="task-hero-main">
          {project && (
            <Link to={`/admin/planner?tab=projects&id=${project.id}`} className="task-detail-project">
              <span className="task-detail-project-dot" style={{ background: project.color }} aria-hidden="true" />
              {project.name}
            </Link>
          )}
          <h2 className={`task-detail-title ${task.completed ? "is-done" : ""}`}>{task.name}</h2>
          <div className="task-detail-badges">
            {task.completed && <span className="task-badge task-badge--done">Completed</span>}
            {overdue && <span className="task-badge task-badge--overdue">Overdue</span>}
            {dueToday && <span className="task-badge task-badge--today">Today</span>}
            {task.recurrence && task.recurrence !== "none" && (
              <span className="task-badge">{RECUR_LABEL[task.recurrence] || task.recurrence}</span>
            )}
          </div>
        </div>
        <div className="task-detail-actions">
          <button type="button" className="btn-secondary-sm" onClick={() => setEditing(true)}><i className="fa-solid fa-pen" aria-hidden="true" /> Edit</button>
          {task.completed
            ? <button type="button" className="btn-secondary-sm" onClick={handleReopen}><i className="fa-solid fa-rotate-left" aria-hidden="true" /> Reopen</button>
            : <button type="button" className="btn-sm btn-complete" onClick={handleComplete}><i className="fa-solid fa-check" aria-hidden="true" /> Done</button>}
        </div>
      </section>

      {editing && (
        <TaskFormModal
          title="Edit task"
          submitLabel="Save changes"
          initial={taskToForm(task)}
          projects={projects}
          collapsible={false}
          onSave={saveEdit}
          onClose={() => setEditing(false)}
        />
      )}

      <section className="db-card" aria-label="Details">
        <div className="db-card-header"><h3 className="db-card-title">Details</h3></div>
        <dl className="task-detail-grid">
          <div className="task-detail-row">
            <dt>{isRecurring ? "Next due" : "Due date"}</dt>
            <dd className={overdue ? "task-overdue" : undefined}>
              {!task.date ? "No due date"
                : isRecurring ? (next ? formatDisplayDate(next) : "Series finished")
                : formatDisplayDate(task.date)}
              {task.time ? ` · ${formatTime12(task.time)}` : ""}
              {overdue ? " · overdue" : ""}
            </dd>
          </div>
          {isRecurring && (
            <div className="task-detail-row">
              <dt>Started</dt>
              <dd>{formatDisplayDate(task.date)}{task.completed_date ? ` · last done ${formatDisplayDate(task.completed_date)}` : ""}</dd>
            </div>
          )}

          <div className="task-detail-row">
            <dt>Repeats</dt>
            <dd>
              {RECUR_LABEL[task.recurrence] || "One-time"}
              {task.recur_until ? ` · until ${formatDisplayDate(task.recur_until)}` : ""}
              {task.recur_times ? ` · ${task.recur_times}×` : ""}
            </dd>
          </div>

          <div className="task-detail-row">
            <dt>Project</dt>
            <dd>{project ? project.name : "—"}</dd>
          </div>

          <div className="task-detail-row">
            <dt>On calendar</dt>
            <dd>{task.show_on_calendar === false ? "No" : "Yes"}</dd>
          </div>

          {task.completed && (
            <div className="task-detail-row">
              <dt>Completed</dt>
              <dd>{formatDisplayDate(task.completed_date || task.date) || "—"}</dd>
            </div>
          )}
        </dl>
      </section>

      <section className="db-card" aria-label="Notes">
        <div className="db-card-header"><h3 className="db-card-title">Notes</h3></div>
        {task.description
          ? <p className="task-detail-notes">{task.description}</p>
          : <p className="no-entries">No description.</p>}
      </section>

      <section className="db-card" aria-label="Documents">
        <div className="db-card-header"><h3 className="db-card-title">Documents</h3></div>
        <DocLinks entityType="reminder" entityId={task.id} title="Linked documents" />
      </section>

      <section className="db-card task-detail-danger" aria-label="Delete this task">
        <div>
          <h3 className="db-card-title">Delete this task</h3>
          <p className="task-detail-danger-note">
            This permanently removes the task{task.recurrence !== "none" ? " and all its occurrences" : ""}.
          </p>
        </div>
        <button type="button" className="btn-delete" onClick={handleDelete}><i className="fa-solid fa-trash" aria-hidden="true" /> Delete</button>
      </section>
    </div>
  );
}
