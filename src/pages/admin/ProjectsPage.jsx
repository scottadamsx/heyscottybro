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
  // Inline edit state — one at a time per kind; forms are prefilled from the row.
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
  const addEvent = async (values) => { await createEventWithAutoTasks({ ...values, project_id: selectedProject.id }, eventTypes); setShowEventForm(false); await loadProjectDetail(selected); };
  const saveEventEdit = async (values) => { await updateEvent(editingEvent.id, eventRowFromForm({ ...values, project_id: selectedProject.id })); setEditingEvent(null); await loadProjectDetail(selected); };
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
  const [newAutoTask, setNewAutoTask] = useState({ offset_days: -3, name: "" });
  const [parentForCreate, setParentForCreate] = useState(null); // parent project id when adding a sub-project
  const [quickTask, setQuickTask] = useState({ name: "", date: "", recurrence: "none" });

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

  const handleCreateProject = async (e) => {
    e.preventDefault();
    if (!projectForm.name.trim()) return;
    const fields = { ...projectForm, parent_id: parentForCreate || null };
    const wasSubProject = parentForCreate;
    setProjectForm(emptyProject);
    setShowProjectForm(false);
    setParentForCreate(null);
    try {
      const p = await newProject(fields);
      if (p?.id) {
        // Splice the real row directly into state — no full reload needed
        setProjects((prev) => [...prev, p]);
        if (!wasSubProject) setSelected(p.id);
      } else {
        // Local mode: no id returned, fall back to full reload
        await loadAll();
        if (!wasSubProject && p) setSelected(p.id);
      }
    } catch (err) {
      // Nothing was added optimistically; reopen the form with what was typed.
      setProjectForm({ ...emptyProject, ...fields, parent_id: undefined });
      setParentForCreate(wasSubProject || null);
      setShowProjectForm(true);
      addToast(`Couldn't create project: ${err?.message || "unknown error"}`, "error");
    }
  };

  const addQuickTask = async (e) => {
    e.preventDefault();
    if (!quickTask.name.trim()) return;
    const fields = { name: quickTask.name.trim(), date: quickTask.date || null, recurrence: quickTask.recurrence, project_id: selected };
    const tempId = `temp-${Date.now()}`;
    setProjectTasks((prev) => [...prev, { id: tempId, completed: false, ...fields }]);
    setQuickTask({ name: "", date: "", recurrence: "none" });
    try {
      const saved = await newReminder(fields);
      if (saved?.id) {
        setProjectTasks((prev) => prev.map((t) => t.id === tempId ? { ...saved, completed: false } : t));
      } else {
        await loadProjectDetail(selected);
      }
    } catch {
      setProjectTasks((prev) => prev.filter((t) => t.id !== tempId));
    }
  };

  const handleDeleteProject = async (id) => {
    if (!await confirm("Delete this project and all its tasks/initiatives?", { title: "Delete project", confirmLabel: "Delete" })) return;
    await deleteProject(id);
    if (selected === id) setSelected(null);
    await loadAll();
  };

  const handleCreateInitiative = async (e) => {
    e.preventDefault();
    if (!initiativeForm.name.trim()) return;
    await newInitiative({ ...initiativeForm, project_id: selected });
    setInitiativeForm(emptyInitiative);
    setShowInitiativeForm(false);
    await loadProjectDetail(selected);
  };

  const handleCreateEventType = async (e) => {
    e.preventDefault();
    if (!eventTypeForm.name.trim()) return;
    await newEventType({ ...eventTypeForm, auto_tasks: [] });
    setEventTypeForm(emptyEventType);
    setShowEventTypeForm(false);
    await loadAll();
  };

  const addAutoTask = async () => {
    if (!newAutoTask.name.trim() || !editingAutoTasks) return;
    const et = eventTypes.find(x => x.id === editingAutoTasks);
    if (!et) return;
    const updated = [...(et.auto_tasks || []), { ...newAutoTask, name: newAutoTask.name.trim(), offset_days: Number(newAutoTask.offset_days) || 0 }].sort(byOffset);
    try { await updateEventType(editingAutoTasks, { auto_tasks: updated }); setNewAutoTask({ offset_days: -3, name: "" }); await loadAll(); }
    catch (err) { addToast(`Couldn't add auto-task: ${err?.message || "unknown error"}`, "error"); }
  };

  const removeAutoTask = async (etId, task) => {
    const et = eventTypes.find(x => x.id === etId);
    if (!et) return;
    const updated = et.auto_tasks.filter((t) => t !== task);
    try { await updateEventType(etId, { auto_tasks: updated }); await loadAll(); }
    catch (err) { addToast(`Couldn't remove auto-task: ${err?.message || "unknown error"}`, "error"); }
  };

  const selectedProject = projects.find(p => String(p.id) === String(selected));

  const saveProjectEdit = async (e) => {
    e.preventDefault();
    if (!projectEdit?.name.trim() || !selectedProject) return;
    const id = selectedProject.id;
    const prev = selectedProject;
    const updates = { name: projectEdit.name.trim(), description: projectEdit.description || "", color: projectEdit.color };
    setProjects((list) => list.map((p) => p.id === id ? { ...p, ...updates } : p));
    setProjectEdit(null);
    try { await updateProject(id, updates); addToast("Project updated.", "success"); }
    catch (err) { setProjects((list) => list.map((p) => p.id === id ? prev : p)); addToast(`Couldn't save project: ${err?.message || "unknown error"}`, "error"); }
  };

  const saveInitEdit = async (e) => {
    e.preventDefault();
    if (!initEdit?.name.trim()) return;
    const { id } = initEdit;
    const prev = initiatives.find((i) => i.id === id);
    const fields = { name: initEdit.name.trim(), description: initEdit.description || "", recurrence: initEdit.recurrence };
    setInitiatives((list) => list.map((i) => i.id === id ? { ...i, ...fields } : i));
    setInitEdit(null);
    try { await updateInitiative(id, fields); addToast("Initiative updated.", "success"); }
    catch (err) { setInitiatives((list) => list.map((i) => i.id === id ? prev : i)); addToast(`Couldn't save initiative: ${err?.message || "unknown error"}`, "error"); }
  };

  const saveTypeEdit = async (e) => {
    e.preventDefault();
    if (!typeEdit?.name.trim()) return;
    const { id } = typeEdit;
    const prev = eventTypes.find((t) => t.id === id);
    const updates = { name: typeEdit.name.trim(), color: typeEdit.color };
    setEventTypes((list) => list.map((t) => t.id === id ? { ...t, ...updates } : t));
    setTypeEdit(null);
    try { await updateEventType(id, updates); addToast("Event type updated.", "success"); }
    catch (err) { setEventTypes((list) => list.map((t) => t.id === id ? prev : t)); addToast(`Couldn't save event type: ${err?.message || "unknown error"}`, "error"); }
  };

  const saveAutoTaskEdit = async (e) => {
    e.preventDefault();
    if (!autoTaskEdit?.name.trim()) return;
    const { etId, task } = autoTaskEdit;
    const et = eventTypes.find((x) => x.id === etId);
    if (!et) return;
    const prevTasks = et.auto_tasks || [];
    const updated = prevTasks.map((t) => t === task ? { ...t, name: autoTaskEdit.name.trim(), offset_days: Number(autoTaskEdit.offset_days) || 0 } : t).sort(byOffset);
    setEventTypes((list) => list.map((t) => t.id === etId ? { ...t, auto_tasks: updated } : t));
    setAutoTaskEdit(null);
    try { await updateEventType(etId, { auto_tasks: updated }); }
    catch (err) { setEventTypes((list) => list.map((t) => t.id === etId ? { ...t, auto_tasks: prevTasks } : t)); addToast(`Couldn't save auto-task: ${err?.message || "unknown error"}`, "error"); }
  };
  const children = selected ? projects.filter(p => String(p.parent_id) === String(selected)) : [];
  const parentProject = selectedProject?.parent_id
    ? projects.find(p => String(p.id) === String(selectedProject.parent_id))
    : null;
  const taskCountFor = (pid) => projectTasks.filter(t => String(t.project_id) === String(pid)).length;

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

          {projectEdit ? (
            <form className="form-card project-edit-form" onSubmit={saveProjectEdit}>
              <div className="form-panel-head">
                <h3>Edit project</h3>
                <button type="button" className="icon-x" onClick={() => setProjectEdit(null)} aria-label="Cancel"><i className="fa-solid fa-xmark" aria-hidden="true" /></button>
              </div>
              <input placeholder="Project name" aria-label="Project name" value={projectEdit.name} onChange={(e) => setProjectEdit({ ...projectEdit, name: e.target.value })} required autoFocus />
              <textarea placeholder="Description (optional)" aria-label="Description" value={projectEdit.description} onChange={(e) => setProjectEdit({ ...projectEdit, description: e.target.value })} rows={2} />
              <div>
                <label className="field-label" htmlFor="project-edit-color">Colour</label>
                <div className="color-row">
                  <div className="color-picker">
                    {PROJECT_COLORS.map((c) => (
                      <button key={c} type="button" className={`color-swatch ${projectEdit.color === c ? "selected" : ""}`} style={{ background: c }} onClick={() => setProjectEdit({ ...projectEdit, color: c })} aria-label={`Colour ${c}`} aria-pressed={projectEdit.color === c} />
                    ))}
                  </div>
                  <input id="project-edit-color" type="color" value={/^#[0-9a-f]{6}$/i.test(projectEdit.color) ? projectEdit.color : "#6366f1"} onChange={(e) => setProjectEdit({ ...projectEdit, color: e.target.value })} aria-label="Custom colour" />
                </div>
              </div>
              <div className="form-actions">
                <button className="btn" type="submit">Save changes</button>
                <button className="btn btn-secondary" type="button" onClick={() => setProjectEdit(null)}>Cancel</button>
              </div>
            </form>
          ) : (
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
          )}

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
            </div>
            <form className="form-card form-inline proj-quick-form project-quick-form" onSubmit={addQuickTask} aria-label="Add a task to this project">
              <div className="form-row">
                <input className="field-grow" placeholder="Task / test (e.g. Midterm)" aria-label="Task name" value={quickTask.name} onChange={e => setQuickTask({ ...quickTask, name: e.target.value })} required />
                <DatePicker value={quickTask.date} onChange={(v) => setQuickTask({ ...quickTask, date: v })} placeholder="Due date" />
                <select value={quickTask.recurrence} onChange={e => setQuickTask({ ...quickTask, recurrence: e.target.value })} aria-label="Repeats">
                  <option value="none">One-time</option>
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                </select>
                <button className="btn" type="submit"><i className="fa-solid fa-plus" aria-hidden="true" /> Add</button>
              </div>
            </form>
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
              <button type="button" className="btn-secondary-sm" onClick={() => { setEditingEvent(null); setShowEventForm((v) => !v); }} aria-expanded={showEventForm}>
                <i className={`fa-solid ${showEventForm ? "fa-xmark" : "fa-plus"}`} aria-hidden="true" /> {showEventForm ? "Cancel" : "Add event"}
              </button>
            </div>
            {showEventForm && (
              <div className="form-card project-event-form">
                <EventForm lockProject={selectedProject.id} projects={projects} eventTypes={eventTypes} onSubmit={addEvent} onCancel={() => setShowEventForm(false)} />
              </div>
            )}
            {projectEvents.length === 0 && !showEventForm && <p className="no-entries">No events linked to this project yet.</p>}
            <div className="db-list plan-list">
              {projectEvents.slice().sort((a, b) => a.date.localeCompare(b.date)).map(e => (
                editingEvent?.id === e.id ? (
                  <div className="form-card project-event-form" key={e.id}>
                    <EventForm initial={e} lockProject={selectedProject.id} projects={projects} eventTypes={eventTypes} submitLabel="Save changes" onSubmit={saveEventEdit} onCancel={() => setEditingEvent(null)} autoFocus={false} />
                  </div>
                ) : (
                  <div className="db-list-item" key={e.id}>
                    <div className="db-list-item-content">
                      <div className="db-list-item-title">{e.title}</div>
                      <div className="db-list-item-subtitle">{eventWhen(e)}{e.description ? ` — ${e.description}` : ""}</div>
                    </div>
                    <button type="button" className="btn-mini" onClick={() => { setShowEventForm(false); setEditingEvent(e); }} title="Edit"><i className="fa-solid fa-pen" aria-hidden="true" /> Edit</button>
                    <button type="button" className="icon-x sm" onClick={() => removeEvent(e)} aria-label={`Delete ${e.title}`}><i className="fa-solid fa-xmark" aria-hidden="true" /></button>
                  </div>
                )
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
              {initiatives.map(i => initEdit?.id === i.id ? (
                <form className="form-card" key={i.id} onSubmit={saveInitEdit}>
                  <input placeholder="Name" aria-label="Name" value={initEdit.name} onChange={(e) => setInitEdit({ ...initEdit, name: e.target.value })} required autoFocus />
                  <textarea placeholder="Description (optional)" aria-label="Description" value={initEdit.description} onChange={(e) => setInitEdit({ ...initEdit, description: e.target.value })} rows={2} />
                  <select value={initEdit.recurrence} onChange={(e) => setInitEdit({ ...initEdit, recurrence: e.target.value })} aria-label="Recurrence">
                    <option value="daily">Daily</option>
                    <option value="weekly">Weekly</option>
                    <option value="monthly">Monthly</option>
                  </select>
                  <div className="form-actions">
                    <button className="btn" type="submit">Save changes</button>
                    <button className="btn btn-secondary" type="button" onClick={() => setInitEdit(null)}>Cancel</button>
                  </div>
                </form>
              ) : (
                <div className="db-list-item" key={i.id}>
                  <div className="db-list-item-content">
                    <div className="db-list-item-title">{i.name}</div>
                    <div className="db-list-item-subtitle">
                      {i.recurrence} · {i.description || "no description"}
                    </div>
                    <DocLinks entityType="initiative" entityId={i.id} title="Documents" compact />
                  </div>
                  <button type="button" className="btn-mini" onClick={() => setInitEdit({ id: i.id, name: i.name || "", description: i.description || "", recurrence: i.recurrence || "weekly" })} title="Edit"><i className="fa-solid fa-pen" aria-hidden="true" /> Edit</button>
                  <button type="button" className="icon-x sm" onClick={() => deleteInitiative(i.id).then(() => loadProjectDetail(selected)).catch((err) => addToast(`Couldn't delete: ${err?.message || "unknown error"}`, "error"))} aria-label={`Delete ${i.name}`}><i className="fa-solid fa-xmark" aria-hidden="true" /></button>
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
              {typeEdit?.id === et.id ? (
                <form className="form-card" onSubmit={saveTypeEdit}>
                  <input placeholder="Name" aria-label="Name" value={typeEdit.name} onChange={(e) => setTypeEdit({ ...typeEdit, name: e.target.value })} required autoFocus />
                  <div className="color-row">
                    <div className="color-picker">
                      {PROJECT_COLORS.map((c) => (
                        <button key={c} type="button" className={`color-swatch ${typeEdit.color === c ? "selected" : ""}`} style={{ background: c }} onClick={() => setTypeEdit({ ...typeEdit, color: c })} aria-label={`Colour ${c}`} aria-pressed={typeEdit.color === c} />
                      ))}
                    </div>
                    <input type="color" value={/^#[0-9a-f]{6}$/i.test(typeEdit.color) ? typeEdit.color : "#22d3ee"} onChange={(e) => setTypeEdit({ ...typeEdit, color: e.target.value })} aria-label="Custom colour" />
                  </div>
                  <div className="form-actions">
                    <button className="btn" type="submit">Save changes</button>
                    <button className="btn btn-secondary" type="button" onClick={() => setTypeEdit(null)}>Cancel</button>
                  </div>
                </form>
              ) : (
                <div className="event-type-header">
                  <span className="event-type-dot" style={{ background: et.color }} aria-hidden="true" />
                  <span className="event-type-name">{et.name}</span>
                  <button type="button" className="btn-mini" onClick={() => setTypeEdit({ id: et.id, name: et.name || "", color: et.color || emptyEventType.color })} title="Edit name & colour">
                    <i className="fa-solid fa-pen" aria-hidden="true" /> Edit
                  </button>
                  <button type="button" className={`btn-mini${editingAutoTasks === et.id ? " accent" : ""}`} aria-expanded={editingAutoTasks === et.id}
                    onClick={() => { setAutoTaskEdit(null); setEditingAutoTasks(editingAutoTasks === et.id ? null : et.id); }}>
                    {editingAutoTasks === et.id ? "Done" : "Edit tasks"}
                  </button>
                  <button type="button" className="icon-x sm" onClick={() => deleteEventType(et.id).then(loadAll).catch((err) => addToast(`Couldn't delete: ${err?.message || "unknown error"}`, "error"))} aria-label={`Delete ${et.name}`}><i className="fa-solid fa-xmark" aria-hidden="true" /></button>
                </div>
              )}
              {(et.auto_tasks || []).length > 0 && (
                <div className="auto-tasks-list event-type-tasks">
                  {et.auto_tasks.slice().sort(byOffset).map((task, idx) => (
                    autoTaskEdit && autoTaskEdit.etId === et.id && autoTaskEdit.task === task ? (
                      <form key={idx} className="auto-task-edit" onSubmit={saveAutoTaskEdit}>
                        <input type="number" className="auto-task-offset-input" value={autoTaskEdit.offset_days} onChange={(e) => setAutoTaskEdit({ ...autoTaskEdit, offset_days: e.target.value })} aria-label="Days offset" />
                        <input className="auto-task-name-input" value={autoTaskEdit.name} onChange={(e) => setAutoTaskEdit({ ...autoTaskEdit, name: e.target.value })} placeholder="Task name" aria-label="Task name" required autoFocus />
                        <button className="btn btn-sm" type="submit">Save</button>
                        <button className="btn-secondary-sm" type="button" onClick={() => setAutoTaskEdit(null)}>Cancel</button>
                      </form>
                    ) : (
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
                    )
                  ))}
                </div>
              )}
              {editingAutoTasks === et.id && (
                <div className="event-type-add">
                  <input
                    type="number"
                    value={newAutoTask.offset_days}
                    onChange={e => setNewAutoTask({ ...newAutoTask, offset_days: e.target.value })}
                    placeholder="Days offset"
                    className="auto-task-offset-input"
                    aria-label="Days offset"
                  />
                  <input
                    value={newAutoTask.name}
                    onChange={e => setNewAutoTask({ ...newAutoTask, name: e.target.value })}
                    placeholder="Task name (e.g. Post preview)"
                    className="auto-task-name-input"
                    aria-label="Task name"
                  />
                  <button type="button" className="btn btn-sm" onClick={addAutoTask}>Add</button>
                </div>
              )}
            </div>
          ))}
        </section>
      )}

      {/* ── Modals ── */}
      {showProjectForm && (
        <div className="event-overlay" onClick={e => e.target.className === "event-overlay" && closeProjectForm()}>
          <form className="event-card project-modal" onSubmit={handleCreateProject} role="dialog" aria-modal="true" aria-labelledby="project-modal-title">
            <h3 id="project-modal-title">{parentForCreate ? `New sub-project in ${selectedProject?.name || ""}` : "New project"}</h3>
            <input placeholder={parentForCreate ? "Sub-project name (e.g. Math 101)" : "Project name"} aria-label="Name" value={projectForm.name} onChange={e => setProjectForm({ ...projectForm, name: e.target.value })} required />
            <textarea placeholder="Description (optional)" aria-label="Description" value={projectForm.description} onChange={e => setProjectForm({ ...projectForm, description: e.target.value })} />
            <div role="group" aria-labelledby="project-colour-label">
              <span className="field-label" id="project-colour-label">Colour</span>
              <div className="color-picker">
                {PROJECT_COLORS.map(c => (
                  <button key={c} type="button" className={`color-swatch ${projectForm.color === c ? "selected" : ""}`}
                    style={{ background: c }} onClick={() => setProjectForm({ ...projectForm, color: c })} aria-label={`Colour ${c}`} aria-pressed={projectForm.color === c} />
                ))}
              </div>
            </div>
            <div className="form-actions project-modal-actions">
              <button className="btn btn-secondary" type="button" onClick={closeProjectForm}>Cancel</button>
              <button className="btn" type="submit">Create</button>
            </div>
          </form>
        </div>
      )}

      {showInitiativeForm && (
        <div className="event-overlay" onClick={e => e.target.className === "event-overlay" && setShowInitiativeForm(false)}>
          <form className="event-card project-modal" onSubmit={handleCreateInitiative} role="dialog" aria-modal="true" aria-labelledby="initiative-modal-title">
            <h3 id="initiative-modal-title">New initiative</h3>
            <input placeholder="Name (e.g. Post on Instagram)" aria-label="Name" value={initiativeForm.name} onChange={e => setInitiativeForm({ ...initiativeForm, name: e.target.value })} required />
            <textarea placeholder="Description (optional)" aria-label="Description" value={initiativeForm.description} onChange={e => setInitiativeForm({ ...initiativeForm, description: e.target.value })} />
            <select value={initiativeForm.recurrence} onChange={e => setInitiativeForm({ ...initiativeForm, recurrence: e.target.value })} aria-label="Repeats">
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
            </select>
            <div className="form-actions project-modal-actions">
              <button className="btn btn-secondary" type="button" onClick={() => setShowInitiativeForm(false)}>Cancel</button>
              <button className="btn" type="submit">Add initiative</button>
            </div>
          </form>
        </div>
      )}

      {showEventTypeForm && (
        <div className="event-overlay" onClick={e => e.target.className === "event-overlay" && setShowEventTypeForm(false)}>
          <form className="event-card project-modal" onSubmit={handleCreateEventType} role="dialog" aria-modal="true" aria-labelledby="event-type-modal-title">
            <h3 id="event-type-modal-title">New event type</h3>
            <input placeholder="Name (e.g. Hike, Meeting, Party)" aria-label="Name" value={eventTypeForm.name} onChange={e => setEventTypeForm({ ...eventTypeForm, name: e.target.value })} required />
            <div role="group" aria-labelledby="event-type-colour-label">
              <span className="field-label" id="event-type-colour-label">Colour</span>
              <div className="color-picker">
                {PROJECT_COLORS.map(c => (
                  <button key={c} type="button" className={`color-swatch ${eventTypeForm.color === c ? "selected" : ""}`}
                    style={{ background: c }} onClick={() => setEventTypeForm({ ...eventTypeForm, color: c })} aria-label={`Colour ${c}`} aria-pressed={eventTypeForm.color === c} />
                ))}
              </div>
            </div>
            <div className="form-actions project-modal-actions">
              <button className="btn btn-secondary" type="button" onClick={() => setShowEventTypeForm(false)}>Cancel</button>
              <button className="btn" type="submit">Create</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
