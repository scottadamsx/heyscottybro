import { useEffect, useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import {
  loadProjects, newProject, updateProject, deleteProject,
  loadInitiatives, newInitiative, updateInitiative, deleteInitiative,
  loadEventTypes, newEventType, deleteEventType, updateEventType,
  loadReminders, loadEvents, newReminder, completeReminder, updateReminder, deleteReminder, updateEvent, deleteEvent,
} from "../../api/plannerApi";
import EventForm from "../../components/EventForm";
import { createEventWithAutoTasks, eventRowFromForm } from "../../lib/events";
import { formatTime12 } from "../../utils/plannerUtils";
import { formatDisplayDate } from "../../utils/plannerUtils";
import DatePicker from "../../components/DatePicker";
import DocLinks from "../../components/docs/DocLinks";
import { FormModal, Field } from "../../components/ui";
import { useToast } from "../../contexts/ToastContext";
import { useConfirm } from "../../hooks/useConfirm";
import "./plan.css";
// Auto-task templates read chronologically: N days before → day of → N days after.
const byOffset = (a, b) => (Number(a.offset_days) - Number(b.offset_days)) || String(a.name || "").localeCompare(String(b.name || ""));

// theme-fixed: the colour choices a user can store on a project / event type (user data, not UI chrome).
const PROJECT_COLORS = ["var(--accent)", "#22d3ee", "var(--green)", "var(--orange)", "#f87171", "#a78bfa", "var(--cyan)", "#ec4899"];

const emptyProject = { name: "", description: "", color: "#6366f1" }; // theme-fixed: user colour (default project colour)
const emptyInitiative = { name: "", description: "", recurrence: "weekly" };
const emptyEventType = { name: "", color: "#22d3ee" }; // theme-fixed: user colour (default event-type colour)
const emptyQuickTask = { name: "", date: "", recurrence: "none" };
const emptyAutoTask = { offset_days: -3, name: "" };

const RecurrenceOptions = ({ oneTime = false }) => (
  <>
    {oneTime && <option value="none">One-time</option>}
    <option value="daily">Daily</option>
    <option value="weekly">Weekly</option>
    <option value="monthly">Monthly</option>
  </>
);

/** Swatches (+ an optional custom picker) for a stored project / event-type colour. */
function ColorField({ value, onChange, custom = false, fallback }) {
  return (
    <div className="uik-field" role="group" aria-label="Colour">
      <span className="field-label">Colour</span>
      <div className="color-row">
        <div className="color-picker">
          {PROJECT_COLORS.map((c) => (
            <button key={c} type="button" className={`color-swatch ${value === c ? "selected" : ""}`} style={{ background: c }} onClick={() => onChange(c)} aria-label={`Colour ${c}`} aria-pressed={value === c} />
          ))}
        </div>
        {custom && <input type="color" value={/^#[0-9a-f]{6}$/i.test(value) ? value : fallback} onChange={(e) => onChange(e.target.value)} aria-label="Custom colour" />}
      </div>
    </div>
  );
}

// FormModal shows a thrown error and keeps the modal open with what was typed.
const requireName = (name, what = "a name") => { if (!String(name || "").trim()) throw new Error(`Give it ${what}.`); };
const failed = (what, err) => new Error(`Couldn't ${what}: ${err?.message || "unknown error"}`, { cause: err });

export default function ProjectsPage() {
  const [params, setParams] = useSearchParams();
  const selected = params.get("id"); // selected project id (from URL)
  const setSelected = (id) => {
    const next = new URLSearchParams(params);
    if (id) next.set("id", String(id)); else next.delete("id");
    next.delete("new");
    setParams(next);
  };

  const { addToast } = useToast();
  const { confirm, dialog } = useConfirm();
  const [projects, setProjects] = useState([]);
  const [initiatives, setInitiatives] = useState([]);
  // Edit state — one modal at a time per kind; forms are prefilled from the row.
  const [projectEdit, setProjectEdit] = useState(null);        // { name, description, color } for the selected project
  const [initEdit, setInitEdit] = useState(null);              // { id, name, description, recurrence }
  const [typeEdit, setTypeEdit] = useState(null);              // { id, name, color }
  const [autoTaskEdit, setAutoTaskEdit] = useState(null);      // { etId, task (ref), name, offset_days }
  const [eventTypes, setEventTypes] = useState([]);
  const [projectTasks, setProjectTasks] = useState([]);
  const [projectDone, setProjectDone] = useState([]);
  const [showDone, setShowDone] = useState(false);
  // Complete / undo / delete straight from the project — optimistic, with the
  // server result reconciled (a failed call puts the row back).
  const markDone = async (t) => {
    setProjectTasks((prev) => prev.filter((x) => x.id !== t.id));
    setProjectDone((prev) => [{ ...t, completed: true, completed_date: new Date().toISOString().slice(0, 10) }, ...prev]);
    try { await completeReminder(t.id); } catch (e) { setProjectTasks((prev) => [...prev, t]); setProjectDone((prev) => prev.filter((x) => x.id !== t.id)); addToast("Couldn't complete: " + e.message, "error"); }
  };
  const undoDone = async (t) => {
    setProjectDone((prev) => prev.filter((x) => x.id !== t.id));
    setProjectTasks((prev) => [...prev, { ...t, completed: false, completed_date: null }]);
    try { await updateReminder(t.id, { completed: false, completed_date: null }); } catch (e) { addToast("Couldn't undo: " + e.message, "error"); }
  };
  const removeTask = async (t) => {
    if (!await confirm(`Delete "${t.name}"?`, { title: "Delete task", confirmLabel: "Delete" })) return;
    setProjectTasks((prev) => prev.filter((x) => x.id !== t.id));
    setProjectDone((prev) => prev.filter((x) => x.id !== t.id));
    try { await deleteReminder(t.id); } catch (e) { addToast("Couldn't delete: " + e.message, "error"); }
  };
  const TaskRow = ({ t, done }) => (
    <div className={`db-list-item project-task${done ? " is-done" : ""}`} key={t.id}>
      {!done
        ? <button type="button" className="day-check" onClick={() => markDone(t)} title="Mark complete" aria-label={`Complete ${t.name}`}><i className="fa-regular fa-circle" aria-hidden="true" /></button>
        : <span className="day-check done"><i className="fa-solid fa-circle-check" aria-hidden="true" /><span className="visually-hidden">Completed</span></span>}
      <div className="db-list-item-content">
        <Link className="db-list-item-title project-task-link" to={`/admin/tasks/${t.id}`}>{t.name}</Link>
        <div className="db-list-item-subtitle">
          {done ? `Completed${t.completed_date ? " · " + formatDisplayDate(t.completed_date) : ""}` : t.date ? formatDisplayDate(t.date) : "No due date"}
          {t.time ? ` · ${formatTime12(String(t.time).slice(0, 5))}` : ""}{t.recurrence && t.recurrence !== "none" ? ` · ${t.recurrence}` : ""}
        </div>
      </div>
      {done && <button type="button" className="btn-mini" onClick={() => undoDone(t)} title="Undo"><i className="fa-solid fa-rotate-left" aria-hidden="true" /> Undo</button>}
      <button type="button" className="icon-x sm" onClick={() => removeTask(t)} aria-label={`Delete ${t.name}`}><i className="fa-solid fa-xmark" aria-hidden="true" /></button>
    </div>
  );
  const [projectEvents, setProjectEvents] = useState([]);
  const [showEventForm, setShowEventForm] = useState(false);
  const [editingEvent, setEditingEvent] = useState(null);
  const eventWhen = (e) => {
    const range = e.end_date && e.end_date > e.date ? `${formatDisplayDate(e.date)} – ${formatDisplayDate(e.end_date)}` : formatDisplayDate(e.date);
    const time = e.start_time ? ` · ${formatTime12(e.start_time)}${e.end_time ? ` – ${formatTime12(e.end_time)}` : ""}` : "";
    return range + time;
  };
  const addEvent = async (values) => { await createEventWithAutoTasks({ ...values, project_id: selectedProject.id }, eventTypes); await loadProjectDetail(selected); };
  const saveEventEdit = async (values) => { await updateEvent(editingEvent.id, eventRowFromForm({ ...values, project_id: selectedProject.id })); await loadProjectDetail(selected); };
  const removeEvent = async (e) => {
    if (!await confirm(`Delete "${e.title}"?`, { title: "Delete event", confirmLabel: "Delete" })) return;
    setProjectEvents((prev) => prev.filter((x) => x.id !== e.id));
    try { await deleteEvent(e.id); } catch (err) { addToast("Couldn't delete: " + err.message, "error"); loadProjectDetail(selected); }
  };

  const [showProjectForm, setShowProjectForm] = useState(false);
  const [showInitiativeForm, setShowInitiativeForm] = useState(false);
  const [showEventTypeForm, setShowEventTypeForm] = useState(false);
  const [editingAutoTasks, setEditingAutoTasks] = useState(null); // event_type being edited

  const [projectForm, setProjectForm] = useState(emptyProject);
  const [initiativeForm, setInitiativeForm] = useState(emptyInitiative);
  const [eventTypeForm, setEventTypeForm] = useState(emptyEventType);
  const [newAutoTask, setNewAutoTask] = useState(null); // { etId, offset_days, name } while the Add auto-task modal is open
  const [parentForCreate, setParentForCreate] = useState(null); // parent project id when adding a sub-project
  const [quickTask, setQuickTask] = useState(null); // the Add task modal's form, null when closed

  const loadAll = async () => {
    const [p, et] = await Promise.all([
      loadProjects().catch(() => []),
      loadEventTypes().catch(() => []),
    ]);
    setProjects(p);
    setEventTypes(et);
  };

  const loadProjectDetail = async (projectId) => {
    const [inits, reminders, events] = await Promise.all([
      loadInitiatives(projectId).catch(() => []),
      loadReminders().catch(() => []),
      loadEvents().catch(() => []),
    ]);
    setInitiatives(inits);
    setProjectTasks(reminders.filter(r => String(r.project_id) === String(projectId) && !r.completed));
    setProjectDone(reminders.filter(r => String(r.project_id) === String(projectId) && r.completed).sort((a, b) => String(b.completed_date || "").localeCompare(String(a.completed_date || ""))));
    setProjectEvents(events.filter(e => String(e.project_id) === String(projectId)));
  };

  useEffect(() => { loadAll(); }, []);

  useEffect(() => {
    if (selected) loadProjectDetail(selected);
    setProjectEdit(null); setInitEdit(null);
  }, [selected]);

  // Open the create form when arriving via the sidebar's "New project"
  useEffect(() => {
    if (params.get("new") === "1") setShowProjectForm(true);
  }, [params]);

  const closeProjectForm = () => {
    setShowProjectForm(false);
    setProjectForm(emptyProject);
    setParentForCreate(null);
    const next = new URLSearchParams(params);
    next.delete("new");
    setParams(next);
  };

  const openNewSub = () => {
    setParentForCreate(selected);
    setProjectForm({ ...emptyProject, color: selectedProject?.color || emptyProject.color });
    setShowProjectForm(true);
  };

  const handleCreateProject = async () => {
    requireName(projectForm.name);
    const fields = { ...projectForm, parent_id: parentForCreate || null };
    const wasSubProject = parentForCreate;
    let p;
    try { p = await newProject(fields); }
    catch (err) { throw failed("create project", err); }
    if (p?.id) {
      // Splice the real row directly into state — no full reload needed
      setProjects((prev) => [...prev, p]);
      if (!wasSubProject) setSelected(p.id);
    } else {
      // Local mode: no id returned, fall back to full reload
      await loadAll();
      if (!wasSubProject && p) setSelected(p.id);
    }
  };

  const addQuickTask = async () => {
    requireName(quickTask.name, "a task name");
    const fields = { name: quickTask.name.trim(), date: quickTask.date || null, recurrence: quickTask.recurrence, project_id: selected };
    const tempId = `temp-${Date.now()}`;
    setProjectTasks((prev) => [...prev, { id: tempId, completed: false, ...fields }]);
    try {
      const saved = await newReminder(fields);
      if (saved?.id) {
        setProjectTasks((prev) => prev.map((t) => t.id === tempId ? { ...saved, completed: false } : t));
      } else {
        await loadProjectDetail(selected);
      }
    } catch (err) {
      setProjectTasks((prev) => prev.filter((t) => t.id !== tempId));
      throw failed("add task", err);
    }
  };

  const handleDeleteProject = async (id) => {
    if (!await confirm("Delete this project and all its tasks/initiatives?", { title: "Delete project", confirmLabel: "Delete" })) return;
    await deleteProject(id);
    if (selected === id) setSelected(null);
    await loadAll();
  };

  const handleCreateInitiative = async () => {
    requireName(initiativeForm.name);
    try { await newInitiative({ ...initiativeForm, project_id: selected }); }
    catch (err) { throw failed("add initiative", err); }
    setInitiativeForm(emptyInitiative);
    await loadProjectDetail(selected);
  };

  const handleCreateEventType = async () => {
    requireName(eventTypeForm.name);
    try { await newEventType({ ...eventTypeForm, auto_tasks: [] }); }
    catch (err) { throw failed("create event type", err); }
    setEventTypeForm(emptyEventType);
    await loadAll();
  };

  const addAutoTask = async () => {
    requireName(newAutoTask?.name, "a task name");
    const et = eventTypes.find(x => x.id === newAutoTask.etId);
    if (!et) throw new Error("That event type no longer exists.");
    const { etId, ...task } = newAutoTask;
    const updated = [...(et.auto_tasks || []), { ...task, name: task.name.trim(), offset_days: Number(task.offset_days) || 0 }].sort(byOffset);
    try { await updateEventType(etId, { auto_tasks: updated }); }
    catch (err) { throw failed("add auto-task", err); }
    await loadAll();
  };

  const removeAutoTask = async (etId, task) => {
    const et = eventTypes.find(x => x.id === etId);
    if (!et) return;
    if (!await confirm(`Remove "${task.name}" from ${et.name}'s auto-tasks?`, { title: "Remove auto-task", confirmLabel: "Remove" })) return;
    const updated = et.auto_tasks.filter((t) => t !== task);
    try { await updateEventType(etId, { auto_tasks: updated }); await loadAll(); }
    catch (err) { addToast(`Couldn't remove auto-task: ${err?.message || "unknown error"}`, "error"); }
  };

  const selectedProject = projects.find(p => String(p.id) === String(selected));

  const saveProjectEdit = async () => {
    requireName(projectEdit?.name);
    if (!selectedProject) throw new Error("That project no longer exists.");
    const id = selectedProject.id;
    const prev = selectedProject;
    const updates = { name: projectEdit.name.trim(), description: projectEdit.description || "", color: projectEdit.color };
    setProjects((list) => list.map((p) => p.id === id ? { ...p, ...updates } : p));
    try { await updateProject(id, updates); addToast("Project updated.", "success"); }
    catch (err) { setProjects((list) => list.map((p) => p.id === id ? prev : p)); throw failed("save project", err); }
  };

  const saveInitEdit = async () => {
    requireName(initEdit?.name);
    const { id } = initEdit;
    const prev = initiatives.find((i) => i.id === id);
    const fields = { name: initEdit.name.trim(), description: initEdit.description || "", recurrence: initEdit.recurrence };
    setInitiatives((list) => list.map((i) => i.id === id ? { ...i, ...fields } : i));
    try { await updateInitiative(id, fields); addToast("Initiative updated.", "success"); }
    catch (err) { setInitiatives((list) => list.map((i) => i.id === id ? prev : i)); throw failed("save initiative", err); }
  };

  const saveTypeEdit = async () => {
    requireName(typeEdit?.name);
    const { id } = typeEdit;
    const prev = eventTypes.find((t) => t.id === id);
    const updates = { name: typeEdit.name.trim(), color: typeEdit.color };
    setEventTypes((list) => list.map((t) => t.id === id ? { ...t, ...updates } : t));
    try { await updateEventType(id, updates); addToast("Event type updated.", "success"); }
    catch (err) { setEventTypes((list) => list.map((t) => t.id === id ? prev : t)); throw failed("save event type", err); }
  };

  const saveAutoTaskEdit = async () => {
    requireName(autoTaskEdit?.name, "a task name");
    const { etId, task } = autoTaskEdit;
    const et = eventTypes.find((x) => x.id === etId);
    if (!et) throw new Error("That event type no longer exists.");
    const prevTasks = et.auto_tasks || [];
    const updated = prevTasks.map((t) => t === task ? { ...t, name: autoTaskEdit.name.trim(), offset_days: Number(autoTaskEdit.offset_days) || 0 } : t).sort(byOffset);
    setEventTypes((list) => list.map((t) => t.id === etId ? { ...t, auto_tasks: updated } : t));
    try { await updateEventType(etId, { auto_tasks: updated }); }
    catch (err) { setEventTypes((list) => list.map((t) => t.id === etId ? { ...t, auto_tasks: prevTasks } : t)); throw failed("save auto-task", err); }
  };
  const children = selected ? projects.filter(p => String(p.parent_id) === String(selected)) : [];
  const parentProject = selectedProject?.parent_id
    ? projects.find(p => String(p.id) === String(selectedProject.parent_id))
    : null;

  return (
    <div className="module-page">
      {dialog}
      {/* ── Header ── */}
      <div className="module-header">
        <h1>Projects</h1>
        <div className="header-actions">
          <button type="button" className="btn-secondary-sm" onClick={() => setShowEventTypeForm(true)}>
            <i className="fa-solid fa-tag" aria-hidden="true" /> Event types
          </button>
          <button type="button" className="btn btn-sm" onClick={() => setShowProjectForm(true)}>
            <i className="fa-solid fa-plus" aria-hidden="true" /> New project
          </button>
        </div>
      </div>

      {/* Project list — always shown when nothing is selected */}
      {!selected && (
        <>
          {projects.length === 0 ? (
            <p className="no-entries">No projects yet. Hit &ldquo;New project&rdquo; to get started.</p>
          ) : (
            <div className="projects-grid">
              {projects.filter(p => !p.parent_id).map(p => (
                <button
                  key={p.id}
                  type="button"
                  className="project-tile"
                  onClick={() => setSelected(p.id)}
                >
                  <span className="project-tile-dot" style={{ background: p.color }} aria-hidden="true" />
                  <span className="project-tile-body">
                    <span className="project-tile-name">{p.name}</span>
                    {p.description && <span className="project-tile-desc">{p.description}</span>}
                  </span>
                  <i className="fa-solid fa-chevron-right project-tile-chevron" aria-hidden="true" />
                </button>
              ))}
            </div>
          )}
        </>
      )}

      {/* ── Project Detail ── */}
      {selected && selectedProject && (
        <>
          <nav className="project-crumbs" aria-label="Project navigation">
            <button type="button" className="btn-ghost btn-sm" onClick={() => setSelected(null)}>
              <i className="fa-solid fa-arrow-left" aria-hidden="true" /> All projects
            </button>
            {parentProject && (
              <button type="button" className="btn-ghost btn-sm" onClick={() => setSelected(parentProject.id)}>
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
                <span className="project-detail-dot" style={{ background: selectedProject.color }} aria-hidden="true" />
                {selectedProject.name}
              </h2>
              {selectedProject.description && <p className="project-detail-desc">{selectedProject.description}</p>}
            </div>
            <div className="header-actions">
              <button type="button" className="btn-secondary-sm" onClick={() => setProjectEdit({ name: selectedProject.name || "", description: selectedProject.description || "", color: selectedProject.color || emptyProject.color })} title="Edit project">
                <i className="fa-solid fa-pen" aria-hidden="true" /> Edit
              </button>
              <button type="button" className="btn-delete" onClick={() => handleDeleteProject(selectedProject.id)} title="Delete project">
                <i className="fa-solid fa-trash" aria-hidden="true" /> Delete
              </button>
            </div>
          </section>

          {/* Reference documents for this project */}
          <section className="db-card" aria-label="Documents">
            <div className="db-card-header"><h3 className="db-card-title">Documents</h3></div>
            <DocLinks entityType="project" entityId={selectedProject.id} title="Linked documents" />
          </section>

          {/* Sub-projects (e.g. classes under a school project) */}
          <section className="db-card" aria-label="Sub-projects">
            <div className="db-card-header project-card-head">
              <h3 className="db-card-title">Sub-projects</h3>
              <button type="button" className="btn-secondary-sm" onClick={openNewSub}><i className="fa-solid fa-plus" aria-hidden="true" /> Add</button>
            </div>
            <p className="project-card-desc">
              Group work into sub-projects (e.g. classes). Each has its own tasks, events &amp; recurring reminders.
            </p>
            {children.length === 0 && <p className="no-entries">No sub-projects yet.</p>}
            {children.length > 0 && (
              <div className="projects-grid">
                {children.map(c => (
                  <button key={c.id} type="button" className="project-tile is-nested" onClick={() => setSelected(c.id)}>
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

          {/* Tasks */}
          <section className="db-card" aria-label="Tasks and due dates">
            <div className="db-card-header">
              <h3 className="db-card-title">Tasks &amp; due dates</h3>
              <button type="button" className="btn-secondary-sm" onClick={() => setQuickTask(emptyQuickTask)}><i className="fa-solid fa-plus" aria-hidden="true" /> Add task</button>
            </div>
            {projectTasks.length === 0 && <p className="no-entries">No active tasks for this project.</p>}
            {(() => {
              const dated = projectTasks.filter(t => t.date);
              const undated = projectTasks.filter(t => !t.date);
              return (
                <>
                  {dated.length > 0 && (
                    <div className="db-list plan-list">
                      {dated.sort((a, b) => a.date.localeCompare(b.date)).map(t => <TaskRow t={t} key={t.id} />)}
                    </div>
                  )}
                  {undated.length > 0 && (
                    <>
                      <p className="db-subhead">No due date</p>
                      <div className="db-list plan-list">
                        {undated.map(t => <TaskRow t={t} key={t.id} />)}
                      </div>
                    </>
                  )}
                  {projectDone.length > 0 && (
                    <>
                      <button type="button" className="btn-ghost btn-sm project-done-toggle" onClick={() => setShowDone((v) => !v)} aria-expanded={showDone}>
                        <i className={`fa-solid ${showDone ? "fa-chevron-up" : "fa-chevron-down"}`} aria-hidden="true" />
                        {showDone ? "Hide completed" : `Completed (${projectDone.length})`}
                      </button>
                      {showDone && <div className="db-list plan-list">{projectDone.map(t => <TaskRow t={t} done key={t.id} />)}</div>}
                    </>
                  )}
                </>
              );
            })()}
          </section>

          {/* Events — add, edit and delete right here; same form as the calendar */}
          <section className="db-card" aria-label="Scheduled events">
            <div className="db-card-header">
              <h3 className="db-card-title">Scheduled events</h3>
              <button type="button" className="btn-secondary-sm" onClick={() => { setEditingEvent(null); setShowEventForm(true); }}>
                <i className="fa-solid fa-plus" aria-hidden="true" /> Add event
              </button>
            </div>
            {projectEvents.length === 0 && <p className="no-entries">No events linked to this project yet.</p>}
            <div className="db-list plan-list">
              {projectEvents.slice().sort((a, b) => a.date.localeCompare(b.date)).map(e => (
                <div className="db-list-item" key={e.id}>
                  <div className="db-list-item-content">
                    <div className="db-list-item-title">{e.title}</div>
                    <div className="db-list-item-subtitle">{eventWhen(e)}{e.description ? ` — ${e.description}` : ""}</div>
                  </div>
                  <button type="button" className="btn-mini" onClick={() => { setShowEventForm(false); setEditingEvent(e); }} title="Edit"><i className="fa-solid fa-pen" aria-hidden="true" /> Edit</button>
                  <button type="button" className="icon-x sm" onClick={() => removeEvent(e)} aria-label={`Delete ${e.title}`}><i className="fa-solid fa-xmark" aria-hidden="true" /></button>
                </div>
              ))}
            </div>
          </section>

          {/* Initiatives */}
          <section className="db-card" aria-label="Initiatives">
            <div className="db-card-header project-card-head">
              <h3 className="db-card-title">Initiatives</h3>
              <button type="button" className="btn-secondary-sm" onClick={() => setShowInitiativeForm(true)}>
                <i className="fa-solid fa-plus" aria-hidden="true" /> Add
              </button>
            </div>
            <p className="project-card-desc">
              Recurring commitments for this project (e.g. post on Instagram every week).
            </p>
            {initiatives.length === 0 && <p className="no-entries">No initiatives yet.</p>}
            <div className="db-list plan-list">
              {initiatives.map(i => (
                <div className="db-list-item" key={i.id}>
                  <div className="db-list-item-content">
                    <div className="db-list-item-title">{i.name}</div>
                    <div className="db-list-item-subtitle">
                      {i.recurrence} · {i.description || "no description"}
                    </div>
                    <DocLinks entityType="initiative" entityId={i.id} title="Documents" compact />
                  </div>
                  <button type="button" className="btn-mini" onClick={() => setInitEdit({ id: i.id, name: i.name || "", description: i.description || "", recurrence: i.recurrence || "weekly" })} title="Edit"><i className="fa-solid fa-pen" aria-hidden="true" /> Edit</button>
                  <button type="button" className="icon-x sm" onClick={async () => { if (!await confirm(`Delete the initiative "${i.name}"?`, { title: "Delete initiative", confirmLabel: "Delete" })) return; deleteInitiative(i.id).then(() => loadProjectDetail(selected)).catch((err) => addToast(`Couldn't delete: ${err?.message || "unknown error"}`, "error")); }} aria-label={`Delete ${i.name}`}><i className="fa-solid fa-xmark" aria-hidden="true" /></button>
                </div>
              ))}
            </div>
          </section>
        </>
      )}

      {/* ── Event Types Section (always shown, below projects) ── */}
      {!selected && (
        <section className="db-card event-types-card" aria-label="Event types and auto-tasks">
          <div className="db-card-header project-card-head">
            <h3 className="db-card-title">Event types &amp; auto-tasks</h3>
          </div>
          <p className="project-card-desc">
            When you create a calendar event with a type (e.g. "Hike"), tasks are auto-created based on the template below.
          </p>
          {eventTypes.length === 0 && <p className="no-entries">No event types yet.</p>}
          {eventTypes.map(et => (
            <div key={et.id} className="event-type-card">
              <div className="event-type-header">
                <span className="event-type-dot" style={{ background: et.color }} aria-hidden="true" />
                <span className="event-type-name">{et.name}</span>
                <button type="button" className="btn-mini" onClick={() => setTypeEdit({ id: et.id, name: et.name || "", color: et.color || emptyEventType.color })} title="Edit name & colour">
                  <i className="fa-solid fa-pen" aria-hidden="true" /> Edit
                </button>
                <button type="button" className={`btn-mini${editingAutoTasks === et.id ? " accent" : ""}`} aria-expanded={editingAutoTasks === et.id}
                  onClick={() => setEditingAutoTasks(editingAutoTasks === et.id ? null : et.id)}>
                  {editingAutoTasks === et.id ? "Done" : "Edit tasks"}
                </button>
                <button type="button" className="icon-x sm" onClick={async () => { if (!await confirm(`Delete the event type "${et.name}" and its auto-tasks? Events already created keep their tasks.`, { title: "Delete event type", confirmLabel: "Delete" })) return; deleteEventType(et.id).then(loadAll).catch((err) => addToast(`Couldn't delete: ${err?.message || "unknown error"}`, "error")); }} aria-label={`Delete ${et.name}`}><i className="fa-solid fa-xmark" aria-hidden="true" /></button>
              </div>
              {(et.auto_tasks || []).length > 0 && (
                <div className="auto-tasks-list event-type-tasks">
                  {et.auto_tasks.slice().sort(byOffset).map((task, idx) => (
                    <div key={idx} className="event-type-task">
                      <span className="event-type-offset">
                        {task.offset_days < 0 ? `${Math.abs(task.offset_days)}d before` : task.offset_days === 0 ? "day of" : `${task.offset_days}d after`}
                      </span>
                      <span className="event-type-task-name">{task.name}</span>
                      {editingAutoTasks === et.id && (
                        <>
                          <button type="button" className="btn-mini" onClick={() => setAutoTaskEdit({ etId: et.id, task, name: task.name || "", offset_days: task.offset_days ?? 0 })} title="Edit"><i className="fa-solid fa-pen" aria-hidden="true" /> Edit</button>
                          <button type="button" className="icon-x sm" onClick={() => removeAutoTask(et.id, task)} aria-label={`Remove ${task.name}`}><i className="fa-solid fa-xmark" aria-hidden="true" /></button>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              )}
              {editingAutoTasks === et.id && (
                <div className="event-type-add">
                  <button type="button" className="btn-secondary-sm" onClick={() => setNewAutoTask({ etId: et.id, ...emptyAutoTask })}>
                    <i className="fa-solid fa-plus" aria-hidden="true" /> Add auto-task
                  </button>
                </div>
              )}
            </div>
          ))}
        </section>
      )}

      {/* ── Modals (DR-019: every form lives in one) ── */}
      {showProjectForm && (
        <FormModal
          title={parentForCreate ? `New sub-project in ${selectedProject?.name || ""}` : "New project"}
          submitLabel="Create"
          onClose={closeProjectForm}
          onSubmit={handleCreateProject}
        >
          <Field label="Name">
            <input placeholder={parentForCreate ? "e.g. Math 101" : "Project name"} value={projectForm.name} onChange={e => setProjectForm({ ...projectForm, name: e.target.value })} data-autofocus required />
          </Field>
          <Field label="Description (optional)">
            <textarea value={projectForm.description} onChange={e => setProjectForm({ ...projectForm, description: e.target.value })} rows={2} />
          </Field>
          <ColorField value={projectForm.color} onChange={(color) => setProjectForm({ ...projectForm, color })} />
        </FormModal>
      )}

      {projectEdit && (
        <FormModal title="Edit project" submitLabel="Save changes" onClose={() => setProjectEdit(null)} onSubmit={saveProjectEdit}>
          <Field label="Name">
            <input value={projectEdit.name} onChange={(e) => setProjectEdit({ ...projectEdit, name: e.target.value })} data-autofocus required />
          </Field>
          <Field label="Description (optional)">
            <textarea value={projectEdit.description} onChange={(e) => setProjectEdit({ ...projectEdit, description: e.target.value })} rows={2} />
          </Field>
          <ColorField value={projectEdit.color} onChange={(color) => setProjectEdit({ ...projectEdit, color })} custom fallback={emptyProject.color} />
        </FormModal>
      )}

      {quickTask && (
        <FormModal title={`Add task to ${selectedProject?.name || "project"}`} submitLabel="Add task" onClose={() => setQuickTask(null)} onSubmit={addQuickTask}>
          <Field label="Task">
            <input placeholder="Task / test (e.g. Midterm)" value={quickTask.name} onChange={e => setQuickTask({ ...quickTask, name: e.target.value })} data-autofocus required />
          </Field>
          <div className="form-row">
            <div className="uik-field">
              <span className="field-label">Due date</span>
              <DatePicker value={quickTask.date} onChange={(v) => setQuickTask({ ...quickTask, date: v })} placeholder="Due date" />
            </div>
            <Field label="Repeats">
              <select value={quickTask.recurrence} onChange={e => setQuickTask({ ...quickTask, recurrence: e.target.value })}>
                <RecurrenceOptions oneTime />
              </select>
            </Field>
          </div>
        </FormModal>
      )}

      {selectedProject && showEventForm && (
        <EventForm modalTitle="New event" lockProject={selectedProject.id} projects={projects} eventTypes={eventTypes} onSubmit={addEvent} onClose={() => setShowEventForm(false)} />
      )}
      {selectedProject && editingEvent && (
        <EventForm key={editingEvent.id} modalTitle="Edit event" initial={editingEvent} lockProject={selectedProject.id} projects={projects} eventTypes={eventTypes} submitLabel="Save changes" onSubmit={saveEventEdit} onClose={() => setEditingEvent(null)} />
      )}

      {showInitiativeForm && (
        <FormModal title="New initiative" submitLabel="Add initiative" onClose={() => setShowInitiativeForm(false)} onSubmit={handleCreateInitiative}>
          <Field label="Name">
            <input placeholder="e.g. Post on Instagram" value={initiativeForm.name} onChange={e => setInitiativeForm({ ...initiativeForm, name: e.target.value })} data-autofocus required />
          </Field>
          <Field label="Description (optional)">
            <textarea value={initiativeForm.description} onChange={e => setInitiativeForm({ ...initiativeForm, description: e.target.value })} rows={2} />
          </Field>
          <Field label="Repeats">
            <select value={initiativeForm.recurrence} onChange={e => setInitiativeForm({ ...initiativeForm, recurrence: e.target.value })}>
              <RecurrenceOptions />
            </select>
          </Field>
        </FormModal>
      )}

      {initEdit && (
        <FormModal title="Edit initiative" submitLabel="Save changes" onClose={() => setInitEdit(null)} onSubmit={saveInitEdit}>
          <Field label="Name">
            <input value={initEdit.name} onChange={(e) => setInitEdit({ ...initEdit, name: e.target.value })} data-autofocus required />
          </Field>
          <Field label="Description (optional)">
            <textarea value={initEdit.description} onChange={(e) => setInitEdit({ ...initEdit, description: e.target.value })} rows={2} />
          </Field>
          <Field label="Repeats">
            <select value={initEdit.recurrence} onChange={(e) => setInitEdit({ ...initEdit, recurrence: e.target.value })}>
              <RecurrenceOptions />
            </select>
          </Field>
        </FormModal>
      )}

      {showEventTypeForm && (
        <FormModal title="New event type" submitLabel="Create" onClose={() => setShowEventTypeForm(false)} onSubmit={handleCreateEventType}>
          <Field label="Name">
            <input placeholder="e.g. Hike, Meeting, Party" value={eventTypeForm.name} onChange={e => setEventTypeForm({ ...eventTypeForm, name: e.target.value })} data-autofocus required />
          </Field>
          <ColorField value={eventTypeForm.color} onChange={(color) => setEventTypeForm({ ...eventTypeForm, color })} />
        </FormModal>
      )}

      {typeEdit && (
        <FormModal title="Edit event type" submitLabel="Save changes" onClose={() => setTypeEdit(null)} onSubmit={saveTypeEdit}>
          <Field label="Name">
            <input value={typeEdit.name} onChange={(e) => setTypeEdit({ ...typeEdit, name: e.target.value })} data-autofocus required />
          </Field>
          <ColorField value={typeEdit.color} onChange={(color) => setTypeEdit({ ...typeEdit, color })} custom fallback={emptyEventType.color} />
        </FormModal>
      )}

      {(newAutoTask || autoTaskEdit) && (() => {
        const editing = Boolean(autoTaskEdit);
        const value = editing ? autoTaskEdit : newAutoTask;
        const setValue = editing ? setAutoTaskEdit : setNewAutoTask;
        const typeName = eventTypes.find((t) => t.id === value.etId)?.name || "event type";
        return (
          <FormModal
            title={editing ? "Edit auto-task" : `Add auto-task to ${typeName}`}
            submitLabel={editing ? "Save" : "Add"}
            onClose={() => (editing ? setAutoTaskEdit(null) : setNewAutoTask(null))}
            onSubmit={editing ? saveAutoTaskEdit : addAutoTask}
          >
            <Field label="Task name">
              <input placeholder="e.g. Post preview" value={value.name} onChange={(e) => setValue({ ...value, name: e.target.value })} data-autofocus required />
            </Field>
            <Field label="Days from the event" hint="Negative = before (−3 is three days before), 0 = the day of, positive = after.">
              <input type="number" value={value.offset_days} onChange={(e) => setValue({ ...value, offset_days: e.target.value })} />
            </Field>
          </FormModal>
        );
      })()}
    </div>
  );
}
