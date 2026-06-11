import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  loadProjects, newProject, deleteProject,
  loadInitiatives, newInitiative, deleteInitiative,
  loadEventTypes, newEventType, deleteEventType, updateEventType,
  loadReminders, loadEvents, newReminder,
} from "../../api/plannerApi";
import { formatDisplayDate } from "../../utils/plannerUtils";
import DatePicker from "../../components/DatePicker";

const PROJECT_COLORS = ["#6366f1", "#22d3ee", "#4ade80", "#f59e0b", "#f87171", "#a78bfa", "#fb923c", "#ec4899"];

const emptyProject = { name: "", description: "", color: "#6366f1" };
const emptyInitiative = { name: "", description: "", recurrence: "weekly" };
const emptyEventType = { name: "", color: "#22d3ee" };

export default function ProjectsPage() {
  const [params, setParams] = useSearchParams();
  const selected = params.get("id"); // selected project id (from URL)
  const setSelected = (id) => {
    const next = new URLSearchParams(params);
    if (id) next.set("id", String(id)); else next.delete("id");
    next.delete("new");
    setParams(next);
  };

  const [projects, setProjects] = useState([]);
  const [initiatives, setInitiatives] = useState([]);
  const [eventTypes, setEventTypes] = useState([]);
  const [projectTasks, setProjectTasks] = useState([]);
  const [projectEvents, setProjectEvents] = useState([]);

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
    setProjectEvents(events.filter(e => String(e.project_id) === String(projectId)));
  };

  useEffect(() => { loadAll(); }, []);

  useEffect(() => {
    if (selected) loadProjectDetail(selected);
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
    const p = await newProject({ ...projectForm, parent_id: parentForCreate || null });
    setProjectForm(emptyProject);
    setShowProjectForm(false);
    await loadAll();
    if (parentForCreate) {
      // created a sub-project — stay on the parent and refresh
      loadProjectDetail(parentForCreate);
      setParentForCreate(null);
    } else {
      setSelected(p.id);
    }
  };

  const addQuickTask = async (e) => {
    e.preventDefault();
    if (!quickTask.name.trim()) return;
    await newReminder({
      name: quickTask.name.trim(),
      date: quickTask.date || null,
      recurrence: quickTask.recurrence,
      project_id: selected,
    });
    setQuickTask({ name: "", date: "", recurrence: "none" });
    await loadProjectDetail(selected);
  };

  const handleDeleteProject = async (id) => {
    if (!confirm("Delete this project and all its tasks/initiatives?")) return;
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
    const updated = [...(et.auto_tasks || []), { ...newAutoTask, offset_days: Number(newAutoTask.offset_days) }];
    await updateEventType(editingAutoTasks, { auto_tasks: updated });
    setNewAutoTask({ offset_days: -3, name: "" });
    await loadAll();
  };

  const removeAutoTask = async (etId, idx) => {
    const et = eventTypes.find(x => x.id === etId);
    if (!et) return;
    const updated = et.auto_tasks.filter((_, i) => i !== idx);
    await updateEventType(etId, { auto_tasks: updated });
    await loadAll();
  };

  const selectedProject = projects.find(p => String(p.id) === String(selected));
  const children = selected ? projects.filter(p => String(p.parent_id) === String(selected)) : [];
  const parentProject = selectedProject?.parent_id
    ? projects.find(p => String(p.id) === String(selectedProject.parent_id))
    : null;
  const taskCountFor = (pid) => projectTasks.filter(t => String(t.project_id) === String(pid)).length;

  return (
    <div className="module-page">
      {/* ── Header ── */}
      <div className="module-header">
        <h1>Projects</h1>
        <div style={{ display: "flex", gap: "0.5rem" }}>
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

          <div className="project-detail-header" style={{ borderLeftColor: selectedProject.color, display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "1rem" }}>
            <div>
              {parentProject && <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", marginBottom: "2px" }}>{parentProject.name} /</div>}
              <h2 style={{ color: selectedProject.color }}>{selectedProject.name}</h2>
              {selectedProject.description && <p className="project-tile-desc">{selectedProject.description}</p>}
            </div>
            <button className="btn-sm btn-delete" onClick={() => handleDeleteProject(selectedProject.id)} title="Delete project">
              <i className="fa-solid fa-trash" /> Delete
            </button>
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
            <form className="form-card form-inline" style={{ background: "transparent", border: "none", padding: 0, marginBottom: "0.75rem" }} onSubmit={addQuickTask}>
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
                    {dated.map(t => (
                      <div className="db-list-item" key={t.id}>
                        <div className="db-list-item-content">
                          <div className="db-list-item-title">{t.name}</div>
                          <div className="db-list-item-subtitle">{formatDisplayDate(t.date)}{t.recurrence !== "none" ? ` · ${t.recurrence}` : ""}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                  {undated.length > 0 && (
                    <>
                      <p style={{ fontSize: "0.72rem", color: "var(--text-muted)", margin: "0.75rem 0 0.5rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>No due date</p>
                      <div className="db-list">
                        {undated.map(t => (
                          <div className="db-list-item" key={t.id}>
                            <div className="db-list-item-content">
                              <div className="db-list-item-title">{t.name}</div>
                              {t.recurrence !== "none" && <div className="db-list-item-subtitle">{t.recurrence}</div>}
                            </div>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </>
              );
            })()}
          </div>

          {/* Upcoming Events */}
          <div className="db-card">
            <div className="db-card-header">
              <h3 className="db-card-title"><i className="fa-solid fa-calendar-days" /> Scheduled Events</h3>
              <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>Add via Calendar page</span>
            </div>
            {projectEvents.length === 0 && <p className="no-entries">No events linked to this project.</p>}
            <div className="db-list">
              {projectEvents.map(e => (
                <div className="db-list-item" key={e.id}>
                  <div className="db-list-item-content">
                    <div className="db-list-item-title">{e.title}</div>
                    <div className="db-list-item-subtitle">{formatDisplayDate(e.date)}{e.description ? ` — ${e.description}` : ""}</div>
                  </div>
                </div>
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
              {initiatives.map(i => (
                <div className="db-list-item" key={i.id}>
                  <div className="db-list-item-content">
                    <div className="db-list-item-title">{i.name}</div>
                    <div className="db-list-item-subtitle">
                      {i.recurrence} · {i.description || "no description"}
                    </div>
                  </div>
                  <button className="btn-sm btn-delete" onClick={() => deleteInitiative(i.id).then(() => loadProjectDetail(selected))}>✕</button>
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
              <div className="event-type-header">
                <span className="event-type-dot" style={{ background: et.color }} />
                <span className="event-type-name">{et.name}</span>
                <button className="btn-sm" style={{ background: "var(--bg-hover)", color: "var(--text-secondary)" }}
                  onClick={() => setEditingAutoTasks(editingAutoTasks === et.id ? null : et.id)}>
                  {editingAutoTasks === et.id ? "Done" : "Edit Tasks"}
                </button>
                <button className="btn-sm btn-delete" onClick={() => deleteEventType(et.id).then(loadAll)}>✕</button>
              </div>
              {(et.auto_tasks || []).length > 0 && (
                <div className="auto-tasks-list">
                  {et.auto_tasks.map((task, idx) => (
                    <div key={idx} className="auto-task-item">
                      <span className="auto-task-offset">
                        {task.offset_days < 0 ? `${Math.abs(task.offset_days)}d before` : task.offset_days === 0 ? "day of" : `${task.offset_days}d after`}
                      </span>
                      <span className="auto-task-name">{task.name}</span>
                      {editingAutoTasks === et.id && (
                        <button className="btn-sm btn-delete" style={{ padding: "1px 6px" }} onClick={() => removeAutoTask(et.id, idx)}>✕</button>
                      )}
                    </div>
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
                    style={{ width: "90px" }}
                  />
                  <input
                    value={newAutoTask.name}
                    onChange={e => setNewAutoTask({ ...newAutoTask, name: e.target.value })}
                    placeholder="Task name (e.g. Post preview)"
                    style={{ flex: 1 }}
                  />
                  <button className="btn btn-sm" onClick={addAutoTask}>Add</button>
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
