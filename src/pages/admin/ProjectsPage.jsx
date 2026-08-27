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
// Auto-task templates read chronologically: N days before → day of → N days after.
const byOffset = (a, b) => (Number(a.offset_days) - Number(b.offset_days)) || String(a.name || "").localeCompare(String(b.name || ""));

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
    <div className={`db-list-item${done ? " done" : ""}`} key={t.id}>
      {!done
        ? <button type="button" className="day-check" onClick={() => markDone(t)} title="Mark complete" aria-label={`Complete ${t.name}`}><i className="fa-regular fa-circle" /></button>
        : <span className="day-check done" aria-hidden="true"><i className="fa-solid fa-circle-check" /></span>}
      <div className="db-list-item-content">
        <Link className="db-list-item-title" to={`/admin/tasks/${t.id}`} style={{ textDecoration: done ? "line-through" : "none" }}>{t.name}</Link>
        <div className="db-list-item-subtitle">
          {done ? `Completed${t.completed_date ? " · " + formatDisplayDate(t.completed_date) : ""}` : t.date ? formatDisplayDate(t.date) : "No due date"}
          {t.time ? ` · ${String(t.time).slice(0, 5)}` : ""}{t.recurrence && t.recurrence !== "none" ? ` · ${t.recurrence}` : ""}
        </div>
      </div>
      {done && <button type="button" className="btn-mini" onClick={() => undoDone(t)} title="Undo"><i className="fa-solid fa-rotate-left" /> Undo</button>}
      <button type="button" className="icon-x sm" onClick={() => removeTask(t)} aria-label={`Delete ${t.name}`}><i className="fa-solid fa-xmark" /></button>
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
  const addEvent = async (values) => { await createEventWithAutoTasks({ ...values, project_id: selectedProject.id }, eventTypes); setShowEventForm(false); await loadAll(); };
  const saveEventEdit = async (values) => { await updateEvent(editingEvent.id, eventRowFromForm({ ...values, project_id: selectedProject.id })); setEditingEvent(null); await loadAll(); };
  const removeEvent = async (e) => {
    if (!await confirm(`Delete "${e.title}"?`, { title: "Delete event", confirmLabel: "Delete" })) return;
    setProjectEvents((prev) => prev.filter((x) => x.id !== e.id));
    try { await deleteEvent(e.id); } catch (err) { addToast("Couldn't delete: " + err.message, "error"); loadAll(); }
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
    } catch {
      // Nothing to roll back since we didn't add optimistically
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
        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
          <button className="btn btn-sm" onClick={() => setShowEventTypeForm(true)}>
            <i className="fa-solid fa-tag" /> Event Types
          </button>
          <button className="btn btn-sm" onClick={() => setShowProjectForm(true)}>
            <i className="fa-solid fa-plus" /> New Project
          </button>
        </div>
      </div>

      {/* Project list — always shown when nothing is selected */}
      {!selected && (
        <>
          {projects.length === 0 ? (
            <p className="no-entries">No projects yet. Hit &ldquo;New Project&rdquo; to get started.</p>
          ) : (
            <div className="projects-grid">
              {projects.filter(p => !p.parent_id).map(p => (
                <button
                  key={p.id}
                  className="project-tile"
                  style={{ "--project-color": p.color }}
                  onClick={() => setSelected(p.id)}
                >
                  <span className="project-tile-dot" style={{ background: p.color }} />
                  <div className="project-tile-body">
                    <div className="project-tile-name">{p.name}</div>
                    {p.description && <div className="project-tile-desc">{p.description}</div>}
                  </div>
                  <i className="fa-solid fa-chevron-right" style={{ color: "var(--text-muted)", fontSize: "0.75rem" }} />
                </button>
              ))}
            </div>
          )}
        </>
      )}

      {/* ── Project Detail ── */}
      {selected && selectedProject && (
        <>
          <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
            <button className="btn btn-sm" style={{ background: "var(--bg-raised)", color: "var(--text-secondary)", width: "fit-content" }} onClick={() => setSelected(null)}>
              ← All Projects
            </button>
            {parentProject && (
              <button className="btn btn-sm" style={{ background: "var(--bg-raised)", color: parentProject.color, width: "fit-content" }} onClick={() => setSelected(parentProject.id)}>
                ↑ {parentProject.name}
              </button>
            )}
          </div>

          {projectEdit ? (
            <form className="form-card project-edit-form" onSubmit={saveProjectEdit}>
              <div className="form-panel-head">
                <h3>Edit project</h3>
                <button type="button" className="icon-x" onClick={() => setProjectEdit(null)} aria-label="Cancel"><i className="fa-solid fa-xmark" /></button>
              </div>
              <input placeholder="Project name" value={projectEdit.name} onChange={(e) => setProjectEdit({ ...projectEdit, name: e.target.value })} required autoFocus />
              <textarea placeholder="Description (optional)" value={projectEdit.description} onChange={(e) => setProjectEdit({ ...projectEdit, description: e.target.value })} rows={2} />
              <div>
                <label className="field-label" htmlFor="project-edit-color">Colour</label>
                <div className="color-row">
                  <div className="color-picker">
                    {PROJECT_COLORS.map((c) => (
                      <button key={c} type="button" className={`color-swatch ${projectEdit.color === c ? "selected" : ""}`} style={{ background: c }} onClick={() => setProjectEdit({ ...projectEdit, color: c })} aria-label={`Colour ${c}`} />
                    ))}
                  </div>
                  <input id="project-edit-color" type="color" value={/^#[0-9a-f]{6}$/i.test(projectEdit.color) ? projectEdit.color : "#6366f1"} onChange={(e) => setProjectEdit({ ...projectEdit, color: e.target.value })} aria-label="Custom colour" />
                </div>
              </div>
              <div className="form-actions">
                <button className="btn" type="submit">Save changes</button>
                <button className="btn btn-secondary-sm" type="button" onClick={() => setProjectEdit(null)}>Cancel</button>
              </div>
            </form>
          ) : (
            <div className="project-detail-header" style={{ borderLeftColor: selectedProject.color, display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "1rem" }}>
              <div>
                {parentProject && <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", marginBottom: "2px" }}>{parentProject.name} /</div>}
                <h2 style={{ color: selectedProject.color }}>{selectedProject.name}</h2>
                {selectedProject.description && <p className="project-tile-desc">{selectedProject.description}</p>}
              </div>
              <div className="header-actions">
                <button type="button" className="btn-mini" onClick={() => setProjectEdit({ name: selectedProject.name || "", description: selectedProject.description || "", color: selectedProject.color || emptyProject.color })} title="Edit project">
                  <i className="fa-solid fa-pen" /> Edit
                </button>
                <button className="btn-sm btn-delete" onClick={() => handleDeleteProject(selectedProject.id)} title="Delete project">
                  <i className="fa-solid fa-trash" /> Delete
                </button>
              </div>
            </div>
          )}

          {/* Reference documents for this project */}
          <div className="db-card">
            <h3 className="db-card-title" style={{ marginBottom: "0.5rem" }}><i className="fa-solid fa-paperclip" /> Documents</h3>
            <DocLinks entityType="project" entityId={selectedProject.id} title="Linked documents" />
          </div>

          {/* Sub-projects (e.g. classes under a school project) */}
          <div className="db-card">
            <div className="db-card-header">
              <h3 className="db-card-title"><i className="fa-solid fa-diagram-project" /> Sub-projects</h3>
              <button className="btn btn-sm" onClick={openNewSub}><i className="fa-solid fa-plus" /> Add</button>
            </div>
            <p style={{ fontSize: "0.78rem", color: "var(--text-muted)", marginBottom: "0.75rem" }}>
              Group work into sub-projects (e.g. classes). Each has its own tasks, events &amp; recurring reminders.
            </p>
            {children.length === 0 && <p className="no-entries">No sub-projects yet.</p>}
            <div className="projects-grid">
              {children.map(c => (
                <button key={c.id} className="project-tile" style={{ "--project-color": c.color }} onClick={() => setSelected(c.id)}>
                  <span className="project-tile-dot" style={{ background: c.color }} />
                  <div className="project-tile-body">
                    <div className="project-tile-name">{c.name}</div>
                    {c.description && <div className="project-tile-desc">{c.description}</div>}
                  </div>
                  <i className="fa-solid fa-chevron-right" style={{ color: "var(--text-muted)", fontSize: "0.75rem" }} />
                </button>
              ))}
            </div>
          </div>

          {/* Tasks */}
          <div className="db-card">
            <div className="db-card-header">
              <h3 className="db-card-title"><i className="fa-solid fa-list-check" /> Tasks &amp; Due Dates</h3>
            </div>
            <form className="form-card form-inline proj-quick-form" style={{ background: "transparent", border: "none", padding: 0, marginBottom: "0.75rem" }} onSubmit={addQuickTask}>
              <div className="form-row">
                <input className="field-grow" placeholder="Task / test (e.g. Midterm)" value={quickTask.name} onChange={e => setQuickTask({ ...quickTask, name: e.target.value })} required />
                <DatePicker value={quickTask.date} onChange={(v) => setQuickTask({ ...quickTask, date: v })} placeholder="Due date" />
                <select value={quickTask.recurrence} onChange={e => setQuickTask({ ...quickTask, recurrence: e.target.value })}>
                  <option value="none">One-time</option>
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                </select>
                <button className="btn" type="submit"><i className="fa-solid fa-plus" /> Add</button>
              </div>
            </form>
            {projectTasks.length === 0 && <p className="no-entries">No active tasks for this project.</p>}
            {(() => {
              const dated = projectTasks.filter(t => t.date);
              const undated = projectTasks.filter(t => !t.date);
              return (
                <>
                  <div className="db-list">
                    {dated.sort((a, b) => a.date.localeCompare(b.date)).map(t => <TaskRow t={t} key={t.id} />)}
                  </div>
                  {undated.length > 0 && (
                    <>
                      <p style={{ fontSize: "0.72rem", color: "var(--text-muted)", margin: "0.75rem 0 0.5rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>No due date</p>
                      <div className="db-list">
                        {undated.map(t => <TaskRow t={t} key={t.id} />)}
                      </div>
                    </>
                  )}
                  {projectDone.length > 0 && (
                    <>
                      <button type="button" className="dashboard-expand" onClick={() => setShowDone((v) => !v)}>
                        {showDone ? "Hide completed" : `Completed (${projectDone.length})`}
                      </button>
                      {showDone && <div className="db-list">{projectDone.map(t => <TaskRow t={t} done key={t.id} />)}</div>}
                    </>
                  )}
                </>
              );
            })()}
          </div>

          {/* Events — add, edit and delete right here; same form as the calendar */}
          <div className="db-card">
            <div className="db-card-header">
              <h3 className="db-card-title"><i className="fa-solid fa-calendar-days" /> Scheduled Events</h3>
              <button className="btn btn-sm" onClick={() => { setEditingEvent(null); setShowEventForm((v) => !v); }}>
                <i className={`fa-solid ${showEventForm ? "fa-xmark" : "fa-plus"}`} /> {showEventForm ? "Cancel" : "Add event"}
              </button>
            </div>
            {showEventForm && (
              <div className="form-card">
                <EventForm lockProject={selectedProject.id} projects={projects} eventTypes={eventTypes} onSubmit={addEvent} onCancel={() => setShowEventForm(false)} />
              </div>
            )}
            {projectEvents.length === 0 && !showEventForm && <p className="no-entries">No events linked to this project yet.</p>}
            <div className="db-list">
              {projectEvents.slice().sort((a, b) => a.date.localeCompare(b.date)).map(e => (
                editingEvent?.id === e.id ? (
                  <div className="form-card" key={e.id}>
                    <EventForm initial={e} lockProject={selectedProject.id} projects={projects} eventTypes={eventTypes} submitLabel="Save changes" onSubmit={saveEventEdit} onCancel={() => setEditingEvent(null)} autoFocus={false} />
                  </div>
                ) : (
                  <div className="db-list-item" key={e.id}>
                    <div className="db-list-item-content">
                      <div className="db-list-item-title">{e.title}</div>
                      <div className="db-list-item-subtitle">{eventWhen(e)}{e.description ? ` — ${e.description}` : ""}</div>
                    </div>
                    <button type="button" className="btn-mini" onClick={() => { setShowEventForm(false); setEditingEvent(e); }} title="Edit"><i className="fa-solid fa-pen" /> Edit</button>
                    <button type="button" className="icon-x sm" onClick={() => removeEvent(e)} aria-label={`Delete ${e.title}`}><i className="fa-solid fa-xmark" /></button>
                  </div>
                )
              ))}
            </div>
          </div>

          {/* Initiatives */}
          <div className="db-card">
            <div className="db-card-header">
              <h3 className="db-card-title"><i className="fa-solid fa-rotate" /> Initiatives</h3>
              <button className="btn btn-sm" onClick={() => setShowInitiativeForm(true)}>
                <i className="fa-solid fa-plus" /> Add
              </button>
            </div>
            <p style={{ fontSize: "0.78rem", color: "var(--text-muted)", marginBottom: "0.75rem" }}>
              Recurring commitments for this project (e.g. post on Instagram every week).
            </p>
            {initiatives.length === 0 && <p className="no-entries">No initiatives yet.</p>}
            <div className="db-list">
              {initiatives.map(i => initEdit?.id === i.id ? (
                <form className="form-card" key={i.id} onSubmit={saveInitEdit}>
                  <input placeholder="Name" value={initEdit.name} onChange={(e) => setInitEdit({ ...initEdit, name: e.target.value })} required autoFocus />
                  <textarea placeholder="Description (optional)" value={initEdit.description} onChange={(e) => setInitEdit({ ...initEdit, description: e.target.value })} rows={2} />
                  <select value={initEdit.recurrence} onChange={(e) => setInitEdit({ ...initEdit, recurrence: e.target.value })} aria-label="Recurrence">
                    <option value="daily">Daily</option>
                    <option value="weekly">Weekly</option>
                    <option value="monthly">Monthly</option>
                  </select>
                  <div className="form-actions">
                    <button className="btn" type="submit">Save changes</button>
                    <button className="btn btn-secondary-sm" type="button" onClick={() => setInitEdit(null)}>Cancel</button>
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
                  <button type="button" className="btn-mini" onClick={() => setInitEdit({ id: i.id, name: i.name || "", description: i.description || "", recurrence: i.recurrence || "weekly" })} title="Edit"><i className="fa-solid fa-pen" /> Edit</button>
                  <button type="button" className="icon-x sm" onClick={() => deleteInitiative(i.id).then(() => loadProjectDetail(selected)).catch((err) => addToast(`Couldn't delete: ${err?.message || "unknown error"}`, "error"))} aria-label={`Delete ${i.name}`}><i className="fa-solid fa-xmark" aria-hidden="true" /></button>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {/* ── Event Types Section (always shown, below projects) ── */}
      {!selected && (
        <div className="db-card" style={{ marginTop: "1rem" }}>
          <div className="db-card-header">
            <h3 className="db-card-title"><i className="fa-solid fa-tag" /> Event Types &amp; Auto-Tasks</h3>
          </div>
          <p style={{ fontSize: "0.78rem", color: "var(--text-muted)", marginBottom: "0.75rem" }}>
            When you create a calendar event with a type (e.g. "Hike"), tasks are auto-created based on the template below.
          </p>
          {eventTypes.length === 0 && <p className="no-entries">No event types yet.</p>}
          {eventTypes.map(et => (
            <div key={et.id} className="event-type-card">
              {typeEdit?.id === et.id ? (
                <form className="form-card" onSubmit={saveTypeEdit}>
                  <input placeholder="Name" value={typeEdit.name} onChange={(e) => setTypeEdit({ ...typeEdit, name: e.target.value })} required autoFocus />
                  <div className="color-row">
                    <div className="color-picker">
                      {PROJECT_COLORS.map((c) => (
                        <button key={c} type="button" className={`color-swatch ${typeEdit.color === c ? "selected" : ""}`} style={{ background: c }} onClick={() => setTypeEdit({ ...typeEdit, color: c })} aria-label={`Colour ${c}`} />
                      ))}
                    </div>
                    <input type="color" value={/^#[0-9a-f]{6}$/i.test(typeEdit.color) ? typeEdit.color : "#22d3ee"} onChange={(e) => setTypeEdit({ ...typeEdit, color: e.target.value })} aria-label="Custom colour" />
                  </div>
                  <div className="form-actions">
                    <button className="btn" type="submit">Save changes</button>
                    <button className="btn btn-secondary-sm" type="button" onClick={() => setTypeEdit(null)}>Cancel</button>
                  </div>
                </form>
              ) : (
                <div className="event-type-header">
                  <span className="event-type-dot" style={{ background: et.color }} />
                  <span className="event-type-name">{et.name}</span>
                  <button type="button" className="btn-mini" onClick={() => setTypeEdit({ id: et.id, name: et.name || "", color: et.color || emptyEventType.color })} title="Edit name & colour">
                    <i className="fa-solid fa-pen" /> Edit
                  </button>
                  <button type="button" className="btn-sm" style={{ background: "var(--bg-hover)", color: "var(--text-secondary)" }}
                    onClick={() => { setAutoTaskEdit(null); setEditingAutoTasks(editingAutoTasks === et.id ? null : et.id); }}>
                    {editingAutoTasks === et.id ? "Done" : "Edit Tasks"}
                  </button>
                  <button type="button" className="btn-sm btn-delete" onClick={() => deleteEventType(et.id).then(loadAll).catch((err) => addToast(`Couldn't delete: ${err?.message || "unknown error"}`, "error"))} aria-label={`Delete ${et.name}`}><i className="fa-solid fa-xmark" aria-hidden="true" /></button>
                </div>
              )}
              {(et.auto_tasks || []).length > 0 && (
                <div className="auto-tasks-list">
                  {et.auto_tasks.slice().sort(byOffset).map((task, idx) => (
                    autoTaskEdit && autoTaskEdit.etId === et.id && autoTaskEdit.task === task ? (
                      <form key={idx} className="auto-task-edit" onSubmit={saveAutoTaskEdit}>
                        <input type="number" className="auto-task-offset-input" value={autoTaskEdit.offset_days} onChange={(e) => setAutoTaskEdit({ ...autoTaskEdit, offset_days: e.target.value })} aria-label="Days offset" />
                        <input className="auto-task-name-input" value={autoTaskEdit.name} onChange={(e) => setAutoTaskEdit({ ...autoTaskEdit, name: e.target.value })} placeholder="Task name" required autoFocus />
                        <button className="btn btn-sm" type="submit">Save</button>
                        <button className="btn btn-sm btn-secondary-sm" type="button" onClick={() => setAutoTaskEdit(null)}>Cancel</button>
                      </form>
                    ) : (
                      <div key={idx} className="auto-task-item">
                        <span className="auto-task-offset">
                          {task.offset_days < 0 ? `${Math.abs(task.offset_days)}d before` : task.offset_days === 0 ? "day of" : `${task.offset_days}d after`}
                        </span>
                        <span className="auto-task-name">{task.name}</span>
                        {editingAutoTasks === et.id && (
                          <>
                            <button type="button" className="btn-mini" onClick={() => setAutoTaskEdit({ etId: et.id, task, name: task.name || "", offset_days: task.offset_days ?? 0 })} title="Edit"><i className="fa-solid fa-pen" /> Edit</button>
                            <button type="button" className="icon-x sm" onClick={() => removeAutoTask(et.id, task)} aria-label={`Remove ${task.name}`}><i className="fa-solid fa-xmark" aria-hidden="true" /></button>
                          </>
                        )}
                      </div>
                    )
                  ))}
                </div>
              )}
              {editingAutoTasks === et.id && (
                <div className="auto-task-add">
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
        </div>
      )}

      {/* ── Modals ── */}
      {showProjectForm && (
        <div className="event-overlay" onClick={e => e.target.className === "event-overlay" && closeProjectForm()}>
          <form className="event-card" onSubmit={handleCreateProject}>
            <h3>{parentForCreate ? `New sub-project in ${selectedProject?.name || ""}` : "New Project"}</h3>
            <input placeholder={parentForCreate ? "Sub-project name (e.g. Math 101)" : "Project name"} value={projectForm.name} onChange={e => setProjectForm({ ...projectForm, name: e.target.value })} required />
            <textarea placeholder="Description (optional)" value={projectForm.description} onChange={e => setProjectForm({ ...projectForm, description: e.target.value })} />
            <div>
              <label style={{ fontSize: "0.78rem", color: "var(--text-muted)", display: "block", marginBottom: "0.375rem" }}>Colour</label>
              <div className="color-picker">
                {PROJECT_COLORS.map(c => (
                  <button key={c} type="button" className={`color-swatch ${projectForm.color === c ? "selected" : ""}`}
                    style={{ background: c }} onClick={() => setProjectForm({ ...projectForm, color: c })} />
                ))}
              </div>
            </div>
            <div className="budget-widget-actions">
              <button className="btn" type="submit">Create</button>
              <button className="btn" type="button" style={{ background: "var(--bg-raised)", color: "var(--text-secondary)" }} onClick={closeProjectForm}>Cancel</button>
            </div>
          </form>
        </div>
      )}

      {showInitiativeForm && (
        <div className="event-overlay" onClick={e => e.target.className === "event-overlay" && setShowInitiativeForm(false)}>
          <form className="event-card" onSubmit={handleCreateInitiative}>
            <h3>New Initiative</h3>
            <input placeholder="Name (e.g. Post on Instagram)" value={initiativeForm.name} onChange={e => setInitiativeForm({ ...initiativeForm, name: e.target.value })} required />
            <textarea placeholder="Description (optional)" value={initiativeForm.description} onChange={e => setInitiativeForm({ ...initiativeForm, description: e.target.value })} />
            <select value={initiativeForm.recurrence} onChange={e => setInitiativeForm({ ...initiativeForm, recurrence: e.target.value })}>
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
            </select>
            <div className="budget-widget-actions">
              <button className="btn" type="submit">Add Initiative</button>
              <button className="btn" type="button" style={{ background: "var(--bg-raised)", color: "var(--text-secondary)" }} onClick={() => setShowInitiativeForm(false)}>Cancel</button>
            </div>
          </form>
        </div>
      )}

      {showEventTypeForm && (
        <div className="event-overlay" onClick={e => e.target.className === "event-overlay" && setShowEventTypeForm(false)}>
          <form className="event-card" onSubmit={handleCreateEventType}>
            <h3>New Event Type</h3>
            <input placeholder="Name (e.g. Hike, Meeting, Party)" value={eventTypeForm.name} onChange={e => setEventTypeForm({ ...eventTypeForm, name: e.target.value })} required />
            <div>
              <label style={{ fontSize: "0.78rem", color: "var(--text-muted)", display: "block", marginBottom: "0.375rem" }}>Colour</label>
              <div className="color-picker">
                {PROJECT_COLORS.map(c => (
                  <button key={c} type="button" className={`color-swatch ${eventTypeForm.color === c ? "selected" : ""}`}
                    style={{ background: c }} onClick={() => setEventTypeForm({ ...eventTypeForm, color: c })} />
                ))}
              </div>
            </div>
            <div className="budget-widget-actions">
              <button className="btn" type="submit">Create</button>
              <button className="btn" type="button" style={{ background: "var(--bg-raised)", color: "var(--text-secondary)" }} onClick={() => setShowEventTypeForm(false)}>Cancel</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
