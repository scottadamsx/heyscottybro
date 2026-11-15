// Kanban board, reused three ways:
//  - mode="tasks": six status lanes of task cards (all-projects board and
//    the per-project Tasks tab).
//  - mode="stages": eight lifecycle lanes of project cards (the Pipeline).
// Drag is hand-rolled HTML5 following the CalendarPage precedent. A task
// drop writes STATUS ONLY (never a date); the shell handler owns the
// complete/reopen semantics. Every card also carries a "Move to" select:
// the keyboard and touch path, mandatory because HTML5 drag has none.
import { useState } from "react";
import { formatDisplayDate, formatTime12 } from "../../../utils/plannerUtils";
import {
  STATUSES, STATUS_LABEL, STAGES, STAGE_LABEL, StatusDot, StageDot,
  getStatus, isOverdue, statsFor, stageOf,
} from "./shared.jsx";

function TaskCard({ task, projects, showProject, onOpen, onComplete, onMove }) {
  const status = getStatus(task);
  const done = status === "done";
  const overdue = isOverdue(task);
  const project = showProject
    ? (projects || []).find((p) => String(p.id) === String(task.project_id))
    : null;
  return (
    <article
      className={`p2-card${done ? " is-done" : ""}`}
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData("text/plain", JSON.stringify({ kind: "task", id: String(task.id) }));
        e.dataTransfer.effectAllowed = "move";
      }}
    >
      <div className="p2-card-top">
        <button
          type="button"
          className={`day-check${done ? " done" : ""}`}
          onClick={() => !done && onComplete?.(task)}
          disabled={done}
          title={done ? "Completed" : "Mark complete"}
          aria-label={done ? `${task.name} is completed` : `Complete ${task.name}`}
        >
          <i className={`fa-${done ? "solid fa-circle-check" : "regular fa-circle"}`} aria-hidden="true" />
        </button>
        <button type="button" className="p2-card-title" onClick={() => onOpen?.(task)}>
          {task.name}
        </button>
      </div>
      <div className="p2-card-meta">
        {task.priority && task.priority !== "medium" && (
          <span className={`p2-flag p2-flag--${task.priority}`}>
            <i className="fa-solid fa-flag" aria-hidden="true" /> {task.priority}
          </span>
        )}
        {task.date && (
          <span className={overdue ? "p2-due is-overdue" : "p2-due"}>
            {formatDisplayDate(task.date)}{task.time ? ` · ${formatTime12(String(task.time).slice(0, 5))}` : ""}
            {overdue ? " · Overdue" : ""}
          </span>
        )}
        {task.recurrence && task.recurrence !== "none" && (
          <span className="p2-recur"><i className="fa-solid fa-repeat" aria-hidden="true" /> {task.recurrence}</span>
        )}
        {status === "blocked" && <StatusDot status="blocked" />}
      </div>
      {(project || task.parent_id) && (
        <div className="p2-card-foot">
          {project && (
            <span className="p2-card-project">
              <span className="project-tile-dot" style={{ background: project.color }} aria-hidden="true" />
              {project.name}
            </span>
          )}
          {task.parent_id && <span className="p2-subtag">Subtask</span>}
        </div>
      )}
      <label className="p2-move">
        <span className="visually-hidden">Move {task.name} to</span>
        <select
          value={status}
          onChange={(e) => { if (e.target.value !== status) onMove?.(task, e.target.value); }}
          aria-label={`Move ${task.name} to status`}
        >
          {STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
      </label>
    </article>
  );
}

function ProjectCard({ project, tasks, onOpen, onMove }) {
  const stats = statsFor(project, tasks);
  const stage = stageOf(project);
  return (
    <article
      className="p2-card"
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData("text/plain", JSON.stringify({ kind: "project", id: String(project.id) }));
        e.dataTransfer.effectAllowed = "move";
      }}
    >
      <button type="button" className="p2-card-title p2-card-project-title" onClick={() => onOpen?.(project)}>
        <span className="project-tile-dot" style={{ background: project.color }} aria-hidden="true" />
        {project.name}
      </button>
      <div className="p2-card-meta">
        <span className="p2-mono">{stats.open} open</span>
        {stats.blocked > 0 && <span className="p2-mono">{stats.blocked} blocked</span>}
        <span className="p2-mono">{stats.done} of {stats.total} done</span>
        {stats.stalled && <StatusDot status="blocked" label="Stalled" />}
      </div>
      <div className="p2-progress" aria-hidden="true">
        <span style={{ width: `${Math.round(stats.progress * 100)}%` }} />
      </div>
      <label className="p2-move">
        <span className="visually-hidden">Move {project.name} to stage</span>
        <select
          value={stage}
          onChange={(e) => { if (e.target.value !== stage) onMove?.(project, e.target.value); }}
          aria-label={`Move ${project.name} to stage`}
        >
          {STAGES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
      </label>
    </article>
  );
}

function Column({ lane, children, onDropItem, quickAdd }) {
  const [over, setOver] = useState(false);
  return (
    <section
      className={`p2-col${over ? " is-over" : ""}`}
      aria-label={lane.label}
      onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; setOver(true); }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault(); setOver(false);
        try {
          const data = JSON.parse(e.dataTransfer.getData("text/plain") || "{}");
          if (data.id) onDropItem?.(data, lane.value);
        } catch { /* not one of our drags */ }
      }}
    >
      <header className="p2-col-head">
        <span className="p2-col-name">{lane.label}</span>
        <span className="p2-col-count">{lane.count}</span>
      </header>
      <div className="p2-col-body">{children}</div>
      {quickAdd}
    </section>
  );
}

function QuickAdd({ status, presetProjectId, projects, onQuickAdd, onQuickAddRequest }) {
  const [title, setTitle] = useState("");
  const [projectId, setProjectId] = useState(presetProjectId || "");
  // On the all-projects board a title-only create still needs a project:
  // the spec's simplest honest path is the canonical form, prefilled.
  if (!presetProjectId && onQuickAddRequest) {
    return (
      <button type="button" className="p2-quickadd-btn" onClick={() => onQuickAddRequest(status)}>
        <i className="fa-solid fa-plus" aria-hidden="true" /> Add task
      </button>
    );
  }
  const submit = () => {
    const name = title.trim();
    if (!name) return;
    setTitle("");
    onQuickAdd?.({ name, status, project_id: presetProjectId || projectId || null });
  };
  return (
    <div className="p2-quickadd">
      {!presetProjectId && (projects || []).length > 0 && (
        <select value={projectId} onChange={(e) => setProjectId(e.target.value)} aria-label="Project for new task">
          <option value="">No project</option>
          {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      )}
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); submit(); } }}
        placeholder="Add a task, Enter to save"
        aria-label={`Add a task to ${STATUS_LABEL[status] || status}`}
      />
    </div>
  );
}

export default function KanbanBoard({
  mode = "tasks",
  tasks = [], projects = [],
  presetProjectId = null,
  onOpenTask, onCompleteTask, onMoveTask,
  onOpenProject, onMoveProject,
  onQuickAdd, onQuickAddRequest,
}) {
  if (mode === "stages") {
    return (
      <div className="p2-board" role="group" aria-label="Projects by stage">
        {STAGES.map((stage) => {
          const inLane = projects.filter((p) => stageOf(p) === stage.value);
          return (
            <Column
              key={stage.value}
              lane={{ ...stage, count: inLane.length }}
              onDropItem={(data, value) => {
                if (data.kind !== "project") return;
                const project = projects.find((p) => String(p.id) === data.id);
                if (project && stageOf(project) !== value) onMoveProject?.(project, value);
              }}
            >
              {inLane.map((p) => (
                <ProjectCard key={p.id} project={p} tasks={tasks} onOpen={onOpenProject} onMove={onMoveProject} />
              ))}
              {inLane.length === 0 && <p className="p2-col-empty">No projects</p>}
            </Column>
          );
        })}
      </div>
    );
  }

  const showProject = !presetProjectId;
  return (
    <div className="p2-board" role="group" aria-label="Tasks by status">
      {STATUSES.map((status) => {
        // Subtasks ride with their parent in list view; on the board every
        // row is a card, but a subtask keeps its "Subtask" tag.
        const inLane = tasks.filter((t) => getStatus(t) === status.value);
        return (
          <Column
            key={status.value}
            lane={{ ...status, count: inLane.length }}
            onDropItem={(data, value) => {
              if (data.kind !== "task") return;
              const task = tasks.find((t) => String(t.id) === data.id);
              if (task && getStatus(task) !== value) onMoveTask?.(task, value);
            }}
            quickAdd={(
              <QuickAdd
                status={status.value}
                presetProjectId={presetProjectId}
                projects={projects}
                onQuickAdd={onQuickAdd}
                onQuickAddRequest={onQuickAddRequest}
              />
            )}
          >
            {inLane.map((t) => (
              <TaskCard
                key={t.id}
                task={t}
                projects={projects}
                showProject={showProject}
                onOpen={onOpenTask}
                onComplete={onCompleteTask}
                onMove={onMoveTask}
              />
            ))}
            {inLane.length === 0 && <p className="p2-col-empty">No tasks</p>}
          </Column>
        );
      })}
    </div>
  );
}

export { STAGE_LABEL };
