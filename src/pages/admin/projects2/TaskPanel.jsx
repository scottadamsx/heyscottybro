// Task detail panel content, hosted by the shell's DetailPanel (context).
// Read-first summary plus the actions Projects needs: status selector (the
// Move-to list), complete/reopen mirroring TaskDetailPage, subtasks, and
// follow-up reminders linked via linked_task_id. Full edits go through the
// canonical TaskFormModal.
import { useState } from "react";
import { Link } from "react-router-dom";
import { newFollowUpReminder, newReminder, updateReminder } from "../../../api/plannerApi";
import TaskFormModal, { taskToForm } from "../../../components/TaskFormModal";
import CopyTaskButton from "../../../components/CopyTaskButton";
import DatePicker from "../../../components/DatePicker";
import TimePicker from "../../../components/TimePicker";
import { formatDisplayDate, formatTime12 } from "../../../utils/plannerUtils";
import { STATUSES, StatusDot, getStatus, isOverdue } from "./shared.jsx";

export default function TaskPanelContent({
  task: initialTask, projects = [], allTasks = [],
  onChangeStatus, onComplete, onReopen, onDelete, onReload, addToast,
}) {
  const [task, setTask] = useState(initialTask);
  const [children, setChildren] = useState(() => allTasks.filter((t) => String(t.parent_id) === String(initialTask.id)));
  const [followUps, setFollowUps] = useState(() => allTasks.filter((t) => String(t.linked_task_id) === String(initialTask.id)));
  const [subTitle, setSubTitle] = useState("");
  const [fuName, setFuName] = useState("");
  const [fuDate, setFuDate] = useState("");
  const [fuTime, setFuTime] = useState("");
  const [editing, setEditing] = useState(false);

  const status = getStatus(task);
  const done = status === "done" || Boolean(task.completed);
  const project = (projects || []).find((p) => String(p.id) === String(task.project_id));

  const move = async (next) => {
    setTask((t) => ({ ...t, status: next, completed: next === "done" ? t.completed : false }));
    await onChangeStatus?.(task, next);
    onReload?.();
  };

  const addSubtask = async () => {
    const name = subTitle.trim();
    if (!name) return;
    setSubTitle("");
    try {
      const saved = await newReminder({ name, project_id: task.project_id || null, parent_id: task.id, status: "backlog" });
      let row = saved;
      if (row?.id && String(row.parent_id) !== String(task.id)) {
        // reminderRow may not carry parent_id yet: set it after create.
        await updateReminder(row.id, { parent_id: task.id });
        row = { ...row, parent_id: task.id };
      }
      if (row?.id) setChildren((prev) => [...prev, row]);
      else onReload?.();
      addToast?.("Subtask added.", "success");
    } catch (e) { addToast?.(`Couldn't add subtask: ${e.message}`, "error"); }
  };

  const addFollowUp = async () => {
    const name = fuName.trim() || `Follow up: ${task.name}`;
    try {
      const saved = await newFollowUpReminder(task, { name, date: fuDate || null, time: fuTime || null });
      if (saved?.id) setFollowUps((prev) => [...prev, saved]);
      else if (saved) setFollowUps((prev) => [...prev, saved]);
      else onReload?.();
      setFuName(""); setFuDate(""); setFuTime("");
      addToast?.("Follow-up scheduled.", "success");
    } catch (e) { addToast?.(`Couldn't schedule follow-up: ${e.message}`, "error"); }
  };

  return (
    <div className="p2-panel">
      <div className="p2-panel-meta">
        <StatusDot status={status} />
        {isOverdue(task) && <StatusDot status="blocked" label="Overdue" />}
        {project && (
          <span className="p2-card-project">
            <span className="project-tile-dot" style={{ background: project.color }} aria-hidden="true" />
            {project.name}
          </span>
        )}
      </div>

      <dl className="task-detail-grid">
        <div className="task-detail-row">
          <dt>Status</dt>
          <dd>
            <select value={status} onChange={(e) => move(e.target.value)} aria-label="Move to status">
              {STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </dd>
        </div>
        <div className="task-detail-row">
          <dt>Due</dt>
          <dd className={isOverdue(task) ? "task-overdue" : undefined}>
            {task.date ? formatDisplayDate(task.date) : "No due date"}
            {task.time ? ` · ${formatTime12(String(task.time).slice(0, 5))}` : ""}
          </dd>
        </div>
        <div className="task-detail-row">
          <dt>Priority</dt>
          <dd>{task.priority || "medium"}</dd>
        </div>
        {task.recurrence && task.recurrence !== "none" && (
          <div className="task-detail-row"><dt>Repeats</dt><dd>{task.recurrence}</dd></div>
        )}
      </dl>

      {task.description && <p className="task-detail-notes">{task.description}</p>}

      <div className="p2-panel-actions">
        {done
          ? <button type="button" className="btn-secondary-sm" onClick={async () => { setTask((t) => ({ ...t, completed: false, completed_date: null, status: "backlog" })); await onReopen?.(task); onReload?.(); }}><i className="fa-solid fa-rotate-left" aria-hidden="true" /> Reopen</button>
          : <button type="button" className="btn-sm btn-complete" onClick={async () => { if (!(task.recurrence && task.recurrence !== "none")) setTask((t) => ({ ...t, completed: true, status: "done" })); await onComplete?.(task); onReload?.(); }}><i className="fa-solid fa-check" aria-hidden="true" /> Complete</button>}
        <button type="button" className="btn-secondary-sm" onClick={() => setEditing(true)}><i className="fa-solid fa-pen" aria-hidden="true" /> Edit</button>
        <CopyTaskButton task={task} projectName={project?.name || null} dueLabel={task.date ? formatDisplayDate(task.date) : null} />
        <Link className="btn-secondary-sm" to={`/admin/tasks/${task.id}`}>Open full task</Link>
        {onDelete && (
          <button type="button" className="btn-delete" onClick={() => onDelete(task)}><i className="fa-solid fa-trash" aria-hidden="true" /> Delete</button>
        )}
      </div>

      <section aria-label="Subtasks">
        <h3 className="p2-panel-h">Subtasks ({children.length})</h3>
        <div className="db-list plan-list">
          {children.map((c) => (
            <div className="db-list-item" key={c.id}>
              <div className="db-list-item-content">
                <div className="db-list-item-title">{c.name}</div>
                <div className="db-list-item-subtitle">{c.date ? formatDisplayDate(c.date) : "No due date"}</div>
              </div>
              <StatusDot status={getStatus(c)} />
            </div>
          ))}
          {children.length === 0 && <p className="no-entries">No subtasks yet.</p>}
        </div>
        <div className="p2-inline-add">
          <input
            value={subTitle}
            onChange={(e) => setSubTitle(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addSubtask(); } }}
            placeholder="Add a subtask, Enter to save"
            aria-label="New subtask title"
          />
          <button type="button" className="btn-secondary-sm" onClick={addSubtask}>Add</button>
        </div>
      </section>

      <section aria-label="Follow-up reminders">
        <h3 className="p2-panel-h">Follow-ups ({followUps.length})</h3>
        <div className="db-list plan-list">
          {followUps.map((f) => (
            <div className="db-list-item" key={f.id}>
              <div className="db-list-item-content">
                <div className="db-list-item-title">{f.name}</div>
                <div className="db-list-item-subtitle">{f.date ? formatDisplayDate(f.date) : "No date"}{f.time ? ` · ${formatTime12(String(f.time).slice(0, 5))}` : ""}</div>
              </div>
              <StatusDot status={getStatus(f)} />
            </div>
          ))}
          {followUps.length === 0 && <p className="no-entries">No follow-ups scheduled.</p>}
        </div>
        <div className="p2-followup-form">
          <input value={fuName} onChange={(e) => setFuName(e.target.value)} placeholder={`Follow up: ${task.name}`} aria-label="Follow-up name" />
          <div className="form-row">
            <DatePicker value={fuDate} onChange={setFuDate} placeholder="Follow-up date" />
            <TimePicker value={fuTime} onChange={setFuTime} />
          </div>
          <button type="button" className="btn-secondary-sm" onClick={addFollowUp}>
            <i className="fa-solid fa-bell" aria-hidden="true" /> Schedule follow-up
          </button>
        </div>
      </section>

      {editing && (
        <TaskFormModal
          title="Edit task"
          submitLabel="Save changes"
          initial={taskToForm(task)}
          projects={projects}
          collapsible={false}
          onSave={async (fields) => {
            await updateReminder(task.id, fields);
            setTask((t) => ({ ...t, ...fields }));
            addToast?.("Task updated.", "success");
            onReload?.();
          }}
          onClose={() => setEditing(false)}
        />
      )}
    </div>
  );
}
