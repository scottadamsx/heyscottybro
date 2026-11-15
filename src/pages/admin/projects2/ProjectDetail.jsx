// Project detail: header card + PageTabs (Overview | Tasks | Milestones |
// Updates | Resources). Overview carries the lifecycle Stepper, the fact
// rail, sub-projects, and the preserved Scheduled events / Initiatives
// sections from the pre-2.0 page.
import { useEffect, useState } from "react";
import PageTabs from "../../../components/PageTabs";
import { FormModal, Field } from "../../../components/ui";
import DatePicker from "../../../components/DatePicker";
import DocLinks from "../../../components/docs/DocLinks";
import {
  loadProjectMilestones, newMilestone, updateMilestone, deleteMilestone,
  loadProjectUpdates, newProjectUpdate, deleteProjectUpdate, logProjectUpdate,
} from "../../../api/plannerApi";
import { formatDisplayDate, formatTime12, toDateStr } from "../../../utils/plannerUtils";
import { onDataChange } from "../../../utils/dataEvents";
import KanbanBoard from "./KanbanBoard.jsx";
import {
  ProgressBar, STAGES, StageDot, StatusDot, getStatus, isDone, stageLabel, stageOf, statsFor,
} from "./shared.jsx";

const TABS = [
  { key: "overview", label: "Overview" },
  { key: "tasks", label: "Tasks" },
  { key: "milestones", label: "Milestones" },
  { key: "updates", label: "Updates" },
  { key: "resources", label: "Resources" },
];
const UPDATE_KINDS = [
  { value: "note", label: "Note" },
  { value: "decision", label: "Decision" },
  { value: "problem", label: "Problem" },
  { value: "next_step", label: "Next step" },
];
const kindLabel = (k) => (k === "auto" ? "Automatic" : (UPDATE_KINDS.find((x) => x.value === k)?.label || k || "Note"));

const safeCall = async (fn, fallback) => { try { const v = await fn(); return v ?? fallback; } catch { return fallback; } };

export default function ProjectDetail({
  project, projects, tasks, childrenProjects, parentProject,
  initiatives, projectEvents, eventWhen,
  confirm, addToast,
  onBack, onOpenProject, onEditProject, onDeleteProject, onStageChange,
  onOpenTask, onCompleteTask, onReopenTask, onChangeTaskStatus, onDeleteTask,
  onQuickAddTask, onOpenTaskForm,
  onAddSubProject, onAddInitiative, onEditInitiative, onDeleteInitiative,
  onAddEvent, onEditEvent, onDeleteEvent,
}) {
  const [tab, setTab] = useState("overview");
  const [tasksView, setTasksView] = useState("board");
  const [showDone, setShowDone] = useState(false);
  const [milestones, setMilestones] = useState([]);
  const [updates, setUpdates] = useState([]);
  const [milestoneForm, setMilestoneForm] = useState(null);
  const [updateKind, setUpdateKind] = useState("note");
  const [updateBody, setUpdateBody] = useState("");
  const [lastViewed, setLastViewed] = useState(null);

  const pid = project.id;
  const stats = statsFor(project, tasks);
  const openTasks = tasks.filter((t) => !isDone(t));
  const doneTasks = tasks.filter(isDone)
    .slice().sort((a, b) => String(b.completed_date || "").localeCompare(String(a.completed_date || "")));
  const nextMilestone = milestones
    .filter((m) => !m.completed && m.target_date)
    .slice().sort((a, b) => String(a.target_date).localeCompare(String(b.target_date)))[0];
  const milestoneProgress = milestones.length
    ? milestones.filter((m) => m.completed).length / milestones.length : 0;

  const loadMilestones = () => safeCall(() => loadProjectMilestones(pid), []).then(setMilestones);
  const loadUpdates = () => safeCall(() => loadProjectUpdates(pid), [])
    .then((rows) => setUpdates((rows || []).slice().sort((a, b) => String(b.created_at || "").localeCompare(String(a.created_at || "")))));

  useEffect(() => {
    const key = `hsb.projectLastViewed.${pid}`;
    try { setLastViewed(localStorage.getItem(key)); } catch { setLastViewed(null); }
    loadMilestones();
    loadUpdates();
    return () => { try { localStorage.setItem(key, new Date().toISOString()); } catch { /* private mode */ } };
  }, [pid]);

  useEffect(() => {
    const offs = [
      onDataChange("project_milestones", loadMilestones),
      onDataChange("project_updates", loadUpdates),
    ];
    return () => offs.forEach((off) => off && off());
  }, [pid]);

  /* ── Milestones ── */
  const saveMilestone = async () => {
    const name = (milestoneForm.name || "").trim();
    if (!name) throw new Error("Give the milestone a name.");
    const fields = { name, target_date: milestoneForm.target_date || null, criteria: milestoneForm.criteria || "" };
    try {
      if (milestoneForm.id) await updateMilestone(milestoneForm.id, fields);
      else await newMilestone({ project_id: pid, ...fields });
    } catch (e) { throw new Error(`Couldn't save milestone: ${e.message}`, { cause: e }); }
    addToast("Milestone saved.", "success");
    loadMilestones();
  };
  const toggleMilestone = async (m) => {
    const completed = !m.completed;
    setMilestones((prev) => prev.map((x) => x.id === m.id ? { ...x, completed, completed_date: completed ? toDateStr(new Date()) : null } : x));
    try {
      await updateMilestone(m.id, { completed, completed_date: completed ? toDateStr(new Date()) : null });
      if (completed) await safeCall(() => logProjectUpdate(pid, `Milestone completed: ${m.name}`), null);
      loadUpdates();
    } catch (e) {
      setMilestones((prev) => prev.map((x) => x.id === m.id ? m : x));
      addToast(`Couldn't update milestone: ${e.message}`, "error");
    }
  };
  const removeMilestone = async (m) => {
    if (confirm && !await confirm(`Delete the milestone "${m.name}"?`, { title: "Delete milestone", confirmLabel: "Delete" })) return;
    try { await deleteMilestone(m.id); addToast("Milestone deleted.", "success"); loadMilestones(); }
    catch (e) { addToast(`Couldn't delete milestone: ${e.message}`, "error"); }
  };

  /* ── Updates ── */
  const postUpdate = async () => {
    const body = updateBody.trim();
    if (!body) return;
    setUpdateBody("");
    try {
      await newProjectUpdate({ project_id: pid, kind: updateKind, body });
      addToast("Update posted.", "success");
      loadUpdates();
    } catch (e) { setUpdateBody(body); addToast(`Couldn't post update: ${e.message}`, "error"); }
  };
  const removeUpdate = async (u) => {
    if (confirm && !await confirm("Delete this update?", { title: "Delete update", confirmLabel: "Delete" })) return;
    try { await deleteProjectUpdate(u.id); loadUpdates(); addToast("Update deleted.", "success"); }
    catch (e) { addToast(`Couldn't delete update: ${e.message}`, "error"); }
  };
  const dividerAt = lastViewed
    ? updates.findIndex((u) => u.created_at && u.created_at < lastViewed)
    : -1;
  const showDivider = dividerAt > 0;

  /* ── Tasks list (tree) ── */
  const taskIds = new Set(tasks.map((t) => String(t.id)));
  const byParent = new Map();
  for (const t of openTasks) {
    if (t.parent_id && taskIds.has(String(t.parent_id))) {
      const key = String(t.parent_id);
      byParent.set(key, [...(byParent.get(key) || []), t]);
    }
  }
  const roots = openTasks.filter((t) => !t.parent_id || !taskIds.has(String(t.parent_id)));
  const datedRoots = roots.filter((t) => t.date).slice().sort((a, b) => String(a.date).localeCompare(String(b.date)));
  const undatedRoots = roots.filter((t) => !t.date);

  const renderRow = (t, depth) => {
    const kids = byParent.get(String(t.id)) || [];
    return (
      <div key={t.id}>
        <div className="db-list-item project-task" style={depth ? { marginLeft: depth * 24 } : undefined}>
          <button type="button" className="day-check" onClick={() => onCompleteTask?.(t)} title="Mark complete" aria-label={`Complete ${t.name}`}>
            <i className="fa-regular fa-circle" aria-hidden="true" />
          </button>
          <div className="db-list-item-content">
            <button type="button" className="p2-row-title" onClick={() => onOpenTask?.(t)}>{t.name}</button>
            <div className="db-list-item-subtitle">
              {t.date ? formatDisplayDate(t.date) : "No due date"}
              {t.time ? ` · ${formatTime12(String(t.time).slice(0, 5))}` : ""}
              {t.recurrence && t.recurrence !== "none" ? ` · ${t.recurrence}` : ""}
              {kids.length ? ` · ${kids.length} subtask${kids.length === 1 ? "" : "s"}` : ""}
            </div>
          </div>
          <StatusDot status={getStatus(t)} />
          <button type="button" className="btn-mini" onClick={() => onOpenTaskForm?.({ parent: t })}>Add subtask</button>
          <button type="button" className="icon-x sm" onClick={() => onDeleteTask?.(t)} aria-label={`Delete ${t.name}`}>
            <i className="fa-solid fa-xmark" aria-hidden="true" />
          </button>
        </div>
        {kids.map((k) => renderRow(k, depth + 1))}
      </div>
    );
  };

  const currentStageIdx = STAGES.findIndex((s) => s.value === stageOf(project));

  return (
    <>
      <nav className="project-crumbs" aria-label="Project navigation">
        <button type="button" className="btn-ghost btn-sm" onClick={onBack}>
          <i className="fa-solid fa-arrow-left" aria-hidden="true" /> All projects
        </button>
        {parentProject && (
          <button type="button" className="btn-ghost btn-sm" onClick={() => onOpenProject(parentProject.id)}>
            <i className="fa-solid fa-arrow-up" aria-hidden="true" />
            <span className="project-tile-dot" style={{ background: parentProject.color }} aria-hidden="true" />
            {parentProject.name}
          </button>
        )}
      </nav>

      <section className="db-card project-detail-header" aria-label="Project">
        <div className="project-detail-main">
          {parentProject && <div className="project-detail-parent">{parentProject.name} /</div>}
          <h2 className="project-detail-title">
            <span className="project-detail-dot" style={{ background: project.color }} aria-hidden="true" />
            {project.name}
          </h2>
          {project.description && <p className="project-detail-desc">{project.description}</p>}
          <div className="p2-project-meta">
            <StageDot stage={stageOf(project)} label={stageLabel(project)} />
            <span className="p2-mono">{stats.done} of {stats.total} completed</span>
            {project.due_date && <span>Target {formatDisplayDate(project.due_date)}</span>}
            {project.archived && <StatusDot status="backlog" label="Archived" />}
          </div>
        </div>
        <div className="header-actions">
          <button type="button" className="btn-secondary-sm" onClick={() => onEditProject(project)} title="Edit project">
            <i className="fa-solid fa-pen" aria-hidden="true" /> Edit
          </button>
          <button type="button" className="btn-delete" onClick={() => onDeleteProject(project)} title="Delete project">
            <i className="fa-solid fa-trash" aria-hidden="true" /> Delete
          </button>
        </div>
      </section>

      <PageTabs tabs={TABS} active={tab} onChange={setTab} />

      {tab === "overview" && (
        <div className="p2-tab-stack">
          <section className="db-card" aria-label="Lifecycle stage">
            <div className="db-card-header"><h3 className="db-card-title">Stage</h3></div>
            <div className="p2-stepper" role="group" aria-label="Project stage">
              {STAGES.map((s, i) => (
                <button
                  key={s.value}
                  type="button"
                  className={`p2-step${i < currentStageIdx ? " is-done" : ""}${i === currentStageIdx ? " is-current" : ""}`}
                  onClick={() => { if (s.value !== stageOf(project)) onStageChange?.(project, s.value); }}
                  aria-current={i === currentStageIdx ? "step" : undefined}
                >
                  {i < currentStageIdx && <i className="fa-solid fa-check" aria-hidden="true" />} {s.label}
                </button>
              ))}
            </div>
          </section>

          <div className="db-grid p2-dash-grid">
            <section className="db-card p2-span-7" aria-label="About">
              <div className="db-card-header"><h3 className="db-card-title">About</h3></div>
              {project.description
                ? <p className="project-detail-desc">{project.description}</p>
                : <p className="no-entries">No description yet. Use Edit to add the goal for this project.</p>}
              <div className="db-card-header p2-subhead-row"><h3 className="db-card-title">Recent updates</h3></div>
              {updates.length === 0 && <p className="no-entries">No updates yet.</p>}
              <div className="db-list plan-list">
                {updates.slice(0, 3).map((u) => (
                  <div className="db-list-item" key={u.id}>
                    <div className="db-list-item-content">
                      <div className="db-list-item-title">{u.body}</div>
                      <div className="db-list-item-subtitle">{kindLabel(u.kind)}{u.created_at ? ` · ${formatDisplayDate(String(u.created_at).slice(0, 10))}` : ""}</div>
                    </div>
                  </div>
                ))}
              </div>
              {updates.length > 3 && (
                <button type="button" className="btn-ghost btn-sm" onClick={() => setTab("updates")}>Show all updates</button>
              )}
              <div className="db-card-header p2-subhead-row"><h3 className="db-card-title">Milestones</h3></div>
              {milestones.length === 0 && <p className="no-entries">No milestones yet.</p>}
              {milestones.length > 0 && (
                <>
                  <ProgressBar value={milestoneProgress} label="Milestone progress" />
                  <div className="db-list plan-list">
                    {milestones.slice(0, 3).map((m) => (
                      <div className="db-list-item" key={m.id}>
                        <div className="db-list-item-content">
                          <div className="db-list-item-title">{m.name}</div>
                          <div className="db-list-item-subtitle">{m.target_date ? formatDisplayDate(m.target_date) : "No target date"}</div>
                        </div>
                        <StatusDot status={m.completed ? "done" : "backlog"} label={m.completed ? "Completed" : "Open"} />
                      </div>
                    ))}
                  </div>
                </>
              )}
            </section>

            <section className="db-card p2-span-5" aria-label="Facts">
              <div className="db-card-header"><h3 className="db-card-title">Facts</h3></div>
              <dl className="task-detail-grid">
                <div className="task-detail-row"><dt>Stage</dt><dd><StageDot stage={stageOf(project)} label={stageLabel(project)} /></dd></div>
                <div className="task-detail-row"><dt>Target date</dt><dd>{project.due_date ? formatDisplayDate(project.due_date) : "Not set"}</dd></div>
                <div className="task-detail-row">
                  <dt>Tasks</dt>
                  <dd>
                    <span className="p2-mono">{stats.done} of {stats.total} done</span>
                    <ProgressBar value={stats.progress} label="Task progress" />
                  </dd>
                </div>
                <div className="task-detail-row"><dt>Next milestone</dt><dd>{nextMilestone ? `${nextMilestone.name}${nextMilestone.target_date ? ` · ${formatDisplayDate(nextMilestone.target_date)}` : ""}` : "None"}</dd></div>
                <div className="task-detail-row"><dt>Overdue</dt><dd><span className="p2-mono">{stats.overdue}</span></dd></div>
                <div className="task-detail-row"><dt>Blocked</dt><dd><span className="p2-mono">{stats.blocked}</span></dd></div>
                <div className="task-detail-row"><dt>Completed</dt><dd><span className="p2-mono">{stats.done}</span></dd></div>
              </dl>
            </section>
          </div>

          <section className="db-card" aria-label="Sub-projects">
            <div className="db-card-header project-card-head">
              <h3 className="db-card-title">Sub-projects ({childrenProjects.length})</h3>
              <button type="button" className="btn-secondary-sm" onClick={onAddSubProject}><i className="fa-solid fa-plus" aria-hidden="true" /> Add</button>
            </div>
            <p className="project-card-desc">Group work into sub-projects. Each has its own tasks, events and recurring reminders.</p>
            {childrenProjects.length === 0 && <p className="no-entries">No sub-projects yet.</p>}
            {childrenProjects.length > 0 && (
              <div className="projects-grid">
                {childrenProjects.map((c) => (
                  <button key={c.id} type="button" className="project-tile is-nested" onClick={() => onOpenProject(c.id)}>
                    <span className="project-tile-dot" style={{ background: c.color }} aria-hidden="true" />
                    <span className="project-tile-body">
                      <span className="project-tile-name">{c.name}</span>
                      {c.description && <span className="project-tile-desc">{c.description}</span>}
                    </span>
                    <i className="fa-solid fa-chevron-right project-tile-chevron" aria-hidden="true" />
                  </button>
                ))}
              </div>
            )}
          </section>

          <section className="db-card" aria-label="Scheduled events">
            <div className="db-card-header">
              <h3 className="db-card-title">Scheduled events ({projectEvents.length})</h3>
              <button type="button" className="btn-secondary-sm" onClick={onAddEvent}>
                <i className="fa-solid fa-plus" aria-hidden="true" /> Add event
              </button>
            </div>
            {projectEvents.length === 0 && <p className="no-entries">No events linked to this project yet.</p>}
            <div className="db-list plan-list">
              {projectEvents.slice().sort((a, b) => String(a.date).localeCompare(String(b.date))).map((e) => (
                <div className="db-list-item" key={e.id}>
                  <div className="db-list-item-content">
                    <div className="db-list-item-title">{e.title}</div>
                    <div className="db-list-item-subtitle">{eventWhen(e)}{e.description ? ` — ${e.description}` : ""}</div>
                  </div>
                  <button type="button" className="btn-mini" onClick={() => onEditEvent(e)} title="Edit"><i className="fa-solid fa-pen" aria-hidden="true" /> Edit</button>
                  <button type="button" className="icon-x sm" onClick={() => onDeleteEvent(e)} aria-label={`Delete ${e.title}`}><i className="fa-solid fa-xmark" aria-hidden="true" /></button>
                </div>
              ))}
            </div>
          </section>

          <section className="db-card" aria-label="Initiatives">
            <div className="db-card-header project-card-head">
              <h3 className="db-card-title">Initiatives ({initiatives.length})</h3>
              <button type="button" className="btn-secondary-sm" onClick={onAddInitiative}>
                <i className="fa-solid fa-plus" aria-hidden="true" /> Add
              </button>
            </div>
            <p className="project-card-desc">Recurring commitments for this project (e.g. post on Instagram every week).</p>
            {initiatives.length === 0 && <p className="no-entries">No initiatives yet.</p>}
            <div className="db-list plan-list">
              {initiatives.map((i) => (
                <div className="db-list-item" key={i.id}>
                  <div className="db-list-item-content">
                    <div className="db-list-item-title">{i.name}</div>
                    <div className="db-list-item-subtitle">{i.recurrence} · {i.description || "no description"}</div>
                    <DocLinks entityType="initiative" entityId={i.id} title="Documents" compact />
                  </div>
                  <button type="button" className="btn-mini" onClick={() => onEditInitiative(i)} title="Edit"><i className="fa-solid fa-pen" aria-hidden="true" /> Edit</button>
                  <button type="button" className="icon-x sm" onClick={() => onDeleteInitiative(i)} aria-label={`Delete ${i.name}`}><i className="fa-solid fa-xmark" aria-hidden="true" /></button>
                </div>
              ))}
            </div>
          </section>
        </div>
      )}

      {tab === "tasks" && (
        <section className="db-card" aria-label="Tasks">
          <div className="db-card-header p2-tasks-head">
            <h3 className="db-card-title">Tasks ({openTasks.length} open, {doneTasks.length} completed)</h3>
            <div className="p2-tasks-tools">
              <div className="segmented" role="group" aria-label="Tasks view">
                <button type="button" className={`segmented-opt${tasksView === "board" ? " active" : ""}`} onClick={() => setTasksView("board")}>Board</button>
                <button type="button" className={`segmented-opt${tasksView === "list" ? " active" : ""}`} onClick={() => setTasksView("list")}>List</button>
              </div>
              <button type="button" className="btn-secondary-sm" onClick={() => onOpenTaskForm?.({})}>
                <i className="fa-solid fa-plus" aria-hidden="true" /> Add task
              </button>
            </div>
          </div>
          {tasksView === "board" ? (
            <KanbanBoard
              tasks={tasks}
              projects={projects}
              presetProjectId={pid}
              onOpenTask={onOpenTask}
              onCompleteTask={onCompleteTask}
              onMoveTask={(t, s) => onChangeTaskStatus?.(t, s)}
              onQuickAdd={onQuickAddTask}
            />
          ) : (
            <>
              {openTasks.length === 0 && <p className="no-entries">No active tasks for this project.</p>}
              {datedRoots.length > 0 && <div className="db-list plan-list">{datedRoots.map((t) => renderRow(t, 0))}</div>}
              {undatedRoots.length > 0 && (
                <>
                  <p className="db-subhead">No due date</p>
                  <div className="db-list plan-list">{undatedRoots.map((t) => renderRow(t, 0))}</div>
                </>
              )}
              {doneTasks.length > 0 && (
                <>
                  <button type="button" className="btn-ghost btn-sm project-done-toggle" onClick={() => setShowDone((v) => !v)} aria-expanded={showDone}>
                    <i className={`fa-solid ${showDone ? "fa-chevron-up" : "fa-chevron-down"}`} aria-hidden="true" />
                    {showDone ? "Hide completed" : `Completed (${doneTasks.length})`}
                  </button>
                  {showDone && (
                    <div className="db-list plan-list">
                      {doneTasks.map((t) => (
                        <div className="db-list-item project-task is-done" key={t.id}>
                          <span className="day-check done"><i className="fa-solid fa-circle-check" aria-hidden="true" /><span className="visually-hidden">Completed</span></span>
                          <div className="db-list-item-content">
                            <button type="button" className="p2-row-title" onClick={() => onOpenTask?.(t)}>{t.name}</button>
                            <div className="db-list-item-subtitle">
                              Completed{t.completed_date ? ` · ${formatDisplayDate(t.completed_date)}` : ""}
                            </div>
                          </div>
                          <button type="button" className="btn-mini" onClick={() => onReopenTask?.(t)} title="Reopen"><i className="fa-solid fa-rotate-left" aria-hidden="true" /> Reopen</button>
                          <button type="button" className="icon-x sm" onClick={() => onDeleteTask?.(t)} aria-label={`Delete ${t.name}`}><i className="fa-solid fa-xmark" aria-hidden="true" /></button>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </>
          )}
        </section>
      )}

      {tab === "milestones" && (
        <section className="db-card" aria-label="Milestones">
          <div className="db-card-header">
            <h3 className="db-card-title">Milestones ({milestones.filter((m) => m.completed).length} of {milestones.length} completed)</h3>
            <button type="button" className="btn-secondary-sm" onClick={() => setMilestoneForm({ name: "", target_date: "", criteria: "" })}>
              <i className="fa-solid fa-plus" aria-hidden="true" /> Add milestone
            </button>
          </div>
          {milestones.length > 0 && <ProgressBar value={milestoneProgress} label="Milestone progress" />}
          {milestones.length === 0 && <p className="no-entries">No milestones yet.</p>}
          <div className="db-list plan-list">
            {milestones.map((m) => (
              <div className="db-list-item" key={m.id}>
                <button type="button" className={`day-check${m.completed ? " done" : ""}`} onClick={() => toggleMilestone(m)} aria-label={`${m.completed ? "Reopen" : "Complete"} milestone ${m.name}`}>
                  <i className={`fa-${m.completed ? "solid fa-circle-check" : "regular fa-circle"}`} aria-hidden="true" />
                </button>
                <div className="db-list-item-content">
                  <div className="db-list-item-title">{m.name}</div>
                  <div className="db-list-item-subtitle">
                    {m.target_date ? formatDisplayDate(m.target_date) : "No target date"}
                    {m.criteria ? ` · ${m.criteria}` : ""}
                    {m.completed && m.completed_date ? ` · Completed ${formatDisplayDate(m.completed_date)}` : ""}
                  </div>
                </div>
                <StatusDot status={m.completed ? "done" : "backlog"} label={m.completed ? "Completed" : "Open"} />
                <button type="button" className="btn-mini" onClick={() => setMilestoneForm({ id: m.id, name: m.name || "", target_date: m.target_date || "", criteria: m.criteria || "" })}>Edit</button>
                <button type="button" className="icon-x sm" onClick={() => removeMilestone(m)} aria-label={`Delete ${m.name}`}><i className="fa-solid fa-xmark" aria-hidden="true" /></button>
              </div>
            ))}
          </div>
        </section>
      )}

      {tab === "updates" && (
        <section className="db-card" aria-label="Updates">
          <div className="db-card-header"><h3 className="db-card-title">Updates ({updates.length})</h3></div>
          <div className="p2-update-composer">
            <div className="form-row">
              <select value={updateKind} onChange={(e) => setUpdateKind(e.target.value)} aria-label="Update kind">
                {UPDATE_KINDS.map((k) => <option key={k.value} value={k.value}>{k.label}</option>)}
              </select>
            </div>
            <textarea value={updateBody} onChange={(e) => setUpdateBody(e.target.value)} rows={3} placeholder="Write an update" aria-label="Update text" />
            <div>
              <button type="button" className="btn btn-sm" onClick={postUpdate} disabled={!updateBody.trim()}>Post update</button>
            </div>
          </div>
          <div className="p2-update-feed">
            {updates.length === 0 && <p className="no-entries">No updates yet.</p>}
            {updates.map((u, idx) => (
              <div key={u.id}>
                {showDivider && idx === dividerAt && (
                  <div className="p2-since-divider" role="separator">Since your last visit</div>
                )}
                <article className={`p2-update${u.kind === "auto" ? " is-auto" : ""}`}>
                  <div className="p2-update-head">
                    <span className="p2-update-kicker">{kindLabel(u.kind)}</span>
                    {u.kind === "auto" && <StatusDot status="backlog" label="Automatic" />}
                    <span className="p2-update-time">
                      {u.created_at ? `${formatDisplayDate(String(u.created_at).slice(0, 10))} · ${new Date(u.created_at).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}` : ""}
                    </span>
                    <button type="button" className="icon-x sm" onClick={() => removeUpdate(u)} aria-label="Delete update"><i className="fa-solid fa-xmark" aria-hidden="true" /></button>
                  </div>
                  <p className="p2-update-body">{u.body}</p>
                </article>
              </div>
            ))}
          </div>
        </section>
      )}

      {tab === "resources" && (
        <section className="db-card" aria-label="Resources">
          <div className="db-card-header"><h3 className="db-card-title">Resources</h3></div>
          <DocLinks entityType="project" entityId={pid} title="Linked documents" />
          <p className="project-card-desc p2-resources-note">
            External URL links are not supported by the linked-documents store yet, so this tab shows documents and files only.
          </p>
        </section>
      )}

      {milestoneForm && (
        <FormModal
          title={milestoneForm.id ? "Edit milestone" : "New milestone"}
          submitLabel={milestoneForm.id ? "Save changes" : "Add milestone"}
          onClose={() => setMilestoneForm(null)}
          onSubmit={saveMilestone}
        >
          <Field label="Name">
            <input value={milestoneForm.name} onChange={(e) => setMilestoneForm({ ...milestoneForm, name: e.target.value })} data-autofocus required />
          </Field>
          <div className="uik-field">
            <span className="field-label">Target date</span>
            <DatePicker value={milestoneForm.target_date} onChange={(v) => setMilestoneForm({ ...milestoneForm, target_date: v })} placeholder="Target date" />
          </div>
          <Field label="Criteria (optional)">
            <textarea value={milestoneForm.criteria} onChange={(e) => setMilestoneForm({ ...milestoneForm, criteria: e.target.value })} rows={2} />
          </Field>
        </FormModal>
      )}
    </>
  );
}
