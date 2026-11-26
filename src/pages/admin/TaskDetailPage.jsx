import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { loadReminders, loadProjects, updateReminder, completeReminder, deleteReminder, loadReminderHistory, revertReminderHistory } from "../../api/plannerApi";
import DocLinks from "../../components/docs/DocLinks";
import CopyTaskButton from "../../components/CopyTaskButton";
import LinkifiedText from "../../components/LinkifiedText";
import { formatDisplayDate, toDateStr, formatTime12, nextOccurrence } from "../../utils/plannerUtils";
import { formatDisplayDateTime } from "../../utils/dates";
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
  // BUG-102: action history for this task, and the in-flight states for the
  // Done / Do early and Revert actions (visible feedback, no repeat clicks).
  const [history, setHistory] = useState({ entries: [], unavailable: false });
  const [completing, setCompleting] = useState(false);
  const [revertingId, setRevertingId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false); // the Edit task modal
  // "Failed to load" and "not found" are different states: a failed load must
  // never render as "this task may have been deleted" (QF-3).
  const [loadError, setLoadError] = useState(null);

  const todayStr = toDateStr(new Date());

  // Load sequence guard: overlapping loads (id change while a read is in
  // flight, a data-change reload racing the first read) must not let the
  // older read land last — it would set task=null / loading=false for a
  // task that exists and flash the "Task not found" branch.
  const loadSeq = useRef(0);
  const load = async () => {
    const seq = ++loadSeq.current;
    setLoadError(null);
    const [remRes, projRes, histRes] = await Promise.allSettled([loadReminders(), loadProjects(), loadReminderHistory(id)]);
    if (loadSeq.current !== seq) return; // superseded by a newer load
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
    if (histRes.status === "fulfilled") {
      setHistory(histRes.value);
    } else {
      // History failing must not blank the task itself (QF-3).
      console.error("[task] failed to load history", histRes.reason);
      setHistory({ entries: [], unavailable: false });
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

  const handleComplete = async (early = false) => {
    if (completing) return;
    const recurring = task.recurrence && task.recurrence !== "none";
    // Recurring: tick off the pending occurrence (which may be a missed one),
    // not "today" — the series then shows its next date.
    const occurrence = recurring ? (nextOccurrence(task, todayStr) || todayStr) : todayStr;
    // BUG-102: Done never completes a future occurrence; that is the separate
    // Do early action (and completeReminder refuses it without the flag too).
    if (!early && recurring && occurrence > todayStr) return;
    setCompleting(true);
    setTask((prev) => (recurring ? { ...prev, completed_date: occurrence } : { ...prev, completed: true, completed_date: occurrence }));
    try {
      const patch = await completeReminder(id, occurrence, { early });
      setTask((prev) => ({ ...prev, ...patch }));
    } catch (err) {
      setLoadError(`Couldn't complete: ${err?.message || err}`);
      await load();
    } finally { setCompleting(false); }
  };

  const handleRevert = async (entry) => {
    if (!(await confirm(`Revert this change? ${entry.summary || entry.action}`, { title: "Revert change", confirmLabel: "Revert" }))) return;
    setRevertingId(entry.id);
    try {
      await revertReminderHistory(entry.id);
      await load();
    } catch (err) {
      setLoadError(`Couldn't revert: ${err?.message || err}`);
      await load();
    } finally { setRevertingId(null); }
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
  // The due label exactly as the Details grid shows it, for the copy brief.
  const dueLabel = !task.date ? null
    : isRecurring ? (next ? formatDisplayDate(next) : "Series finished")
    : formatDisplayDate(task.date);

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

      {/* ── Summary: project, title, status ── */}
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
            {task.priority === "high" && <span className="task-badge task-badge--overdue">High priority</span>}
            {task.priority === "medium" && <span className="task-badge">Medium priority</span>}
            {task.priority === "low" && <span className="task-badge">Low priority</span>}
            {task.recurrence && task.recurrence !== "none" && (
              <span className="task-badge">{RECUR_LABEL[task.recurrence] || task.recurrence}</span>
            )}
          </div>
        </div>
        <div className="task-detail-actions">
          <CopyTaskButton task={task} projectName={project?.name || null} dueLabel={dueLabel} />
          <button type="button" className="btn-secondary-sm" onClick={() => setEditing(true)}><i className="fa-solid fa-pen" aria-hidden="true" /> Edit</button>
          {task.completed
            ? <button type="button" className="btn-secondary-sm" onClick={handleReopen}><i className="fa-solid fa-rotate-left" aria-hidden="true" /> Reopen</button>
            : isRecurring && next && next > todayStr
              ? <button type="button" className="btn-secondary-sm" disabled={completing} onClick={() => handleComplete(true)} title={`Complete the ${formatDisplayDate(next)} occurrence ahead of time`}>
                  {completing
                    ? <><i className="fa-solid fa-circle-notch fa-spin" aria-hidden="true" /> Saving…</>
                    : <><i className="fa-solid fa-forward" aria-hidden="true" /> Do early</>}
                </button>
              : <button type="button" className="btn-sm btn-complete" disabled={completing} onClick={() => handleComplete(false)}>
                  {completing
                    ? <><i className="fa-solid fa-circle-notch fa-spin" aria-hidden="true" /> Saving…</>
                    : <><i className="fa-solid fa-check" aria-hidden="true" /> Done</>}
                </button>}
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
              {task.time ? `, ${formatTime12(task.time)}` : ""}
              {overdue ? ", overdue" : ""}
            </dd>
          </div>
          {isRecurring && (
            <div className="task-detail-row">
              <dt>Started</dt>
              <dd>{formatDisplayDate(task.date)}{task.completed_date ? `, last done ${formatDisplayDate(task.completed_date)}` : ""}</dd>
            </div>
          )}

          <div className="task-detail-row">
            <dt>Repeats</dt>
            <dd>
              {RECUR_LABEL[task.recurrence] || "One-time"}
              {task.recur_until ? `, until ${formatDisplayDate(task.recur_until)}` : ""}
              {task.recur_times ? `, ${task.recur_times}×` : ""}
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
          ? <LinkifiedText text={task.description} className="task-detail-notes" />
          : <p className="no-entries">No description.</p>}
      </section>

      <section className="db-card" aria-label="Documents">
        <div className="db-card-header"><h3 className="db-card-title">Documents</h3></div>
        <DocLinks entityType="reminder" entityId={task.id} title="Linked documents" />
      </section>

      <section className="db-card" aria-label="History">
        <div className="db-card-header">
          <h3 className="db-card-title">{history.unavailable ? "History" : `History (${history.entries.length})`}</h3>
        </div>
        {history.unavailable ? (
          <p className="no-entries">History is not turned on yet. Changes start recording once the reminder history database update is run.</p>
        ) : history.entries.length === 0 ? (
          <p className="no-entries">No changes recorded yet.</p>
        ) : (
          <div className="db-list">
            {history.entries.map((e) => {
              const newestOpen = history.entries.find((x) => !x.reverted_at);
              const canRevert = !e.reverted_at && newestOpen && String(newestOpen.id) === String(e.id);
              return (
                <div className="db-list-item" key={e.id}>
                  <span className="db-list-item-content">
                    <span className="db-list-item-title">{e.summary || e.action}</span>
                    <span className="db-list-item-subtitle">
                      {formatDisplayDateTime(e.created_at)}{e.reverted_at ? " · Reverted" : ""}
                    </span>
                  </span>
                  {canRevert && (
                    <button type="button" className="btn-mini" disabled={revertingId === e.id} onClick={() => handleRevert(e)}>
                      <i className="fa-solid fa-rotate-left" aria-hidden="true" /> {revertingId === e.id ? "Reverting…" : "Revert"}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
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
