import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  loadProjects, newProject, updateProject, deleteProject,
  loadInitiatives, newInitiative, updateInitiative, deleteInitiative,
  loadEventTypes, newEventType, deleteEventType, updateEventType,
  loadReminders, loadEvents, newReminder, completeReminder, updateReminder, deleteReminder, updateEvent, deleteEvent,
  logProjectUpdate, loadProjectMilestones,
} from "../../api/plannerApi";
import EventForm from "../../components/EventForm";
import { createEventWithAutoTasks, eventRowFromForm } from "../../lib/events";
import { formatTime12, formatDisplayDate, toDateStr, nextOccurrence } from "../../utils/plannerUtils";
import DatePicker from "../../components/DatePicker";
import { FormModal, Field } from "../../components/ui";
import TaskFormModal, { emptyTaskForm, taskToForm } from "../../components/TaskFormModal";
import { PageSkeleton } from "../../components/Skeleton";
import { useToast } from "../../contexts/ToastContext";
import { useConfirm } from "../../hooks/useConfirm";
import { useDetailPanel } from "../../contexts/DetailPanelContext";
import { onDataChange } from "../../utils/dataEvents";
import Dashboard from "./projects2/Dashboard.jsx";
import KanbanBoard from "./projects2/KanbanBoard.jsx";
import Pipeline from "./projects2/Pipeline.jsx";
import ProjectDetail from "./projects2/ProjectDetail.jsx";
import TaskPanelContent from "./projects2/TaskPanel.jsx";
import { STAGES, STAGE_LABEL, getStatus, statsFor, stageOf } from "./projects2/shared.jsx";
import "./plan.css";

// Auto-task templates read chronologically: N days before → day of → N days after.
const byOffset = (a, b) => (Number(a.offset_days) - Number(b.offset_days)) || String(a.name || "").localeCompare(String(b.name || ""));

// theme-fixed: the colour choices a user can store on a project / event type (user data, not UI chrome).
const PROJECT_COLORS = ["var(--accent)", "#22d3ee", "var(--green)", "var(--orange)", "#f87171", "#a78bfa", "var(--cyan)", "#ec4899"];

const emptyProject = { name: "", description: "", color: "#6366f1", stage: "idea", due_date: "", archived: false }; // theme-fixed: user colour (default project colour)
const emptyInitiative = { name: "", description: "", recurrence: "weekly" };
const emptyEventType = { name: "", color: "#22d3ee" }; // theme-fixed: user colour (default event-type colour)
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

function ProjectFields({ form, setForm }) {
  return (
    <>
      <Field label="Name">
        <input placeholder="Project name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} data-autofocus required />
      </Field>
      <Field label="Description (optional)">
        <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} />
      </Field>
      <div className="form-row">
        <Field label="Stage">
          <select value={form.stage || "idea"} onChange={(e) => setForm({ ...form, stage: e.target.value })}>
            {STAGES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </Field>
        <div className="uik-field">
          <span className="field-label">Target date</span>
          <DatePicker value={form.due_date || ""} onChange={(v) => setForm({ ...form, due_date: v })} placeholder="Target date" />
        </div>
      </div>
      <ColorField value={form.color} onChange={(color) => setForm({ ...form, color })} custom fallback={emptyProject.color} />
      <label className="checkbox-inline">
        <input type="checkbox" checked={Boolean(form.archived)} onChange={(e) => setForm({ ...form, archived: e.target.checked })} />
        Archived
      </label>
    </>
  );
}

// FormModal shows a thrown error and keeps the modal open with what was typed.
const requireName = (name, what = "a name") => { if (!String(name || "").trim()) throw new Error(`Give it ${what}.`); };
const failed = (what, err) => new Error(`Couldn't ${what}: ${err?.message || "unknown error"}`, { cause: err });
const safeLog = async (projectId, body) => { try { await logProjectUpdate(projectId, body); } catch { /* best-effort auto entries */ } };

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
  const { openPanel, closePanel } = useDetailPanel();
  const [loading, setLoading] = useState(true);
  const [projects, setProjects] = useState([]);
  const [allTasks, setAllTasks] = useState([]);
  const [allMilestones, setAllMilestones] = useState([]);
  const [initiatives, setInitiatives] = useState([]);
  const [eventTypes, setEventTypes] = useState([]);
  const [projectEvents, setProjectEvents] = useState([]);

  // Home view + filters
  const [homeView, setHomeView] = useState("dashboard");
  const [stageFilter, setStageFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState("recent");
  const [archivedOnly, setArchivedOnly] = useState(false);

  // Edit state — one modal at a time per kind; forms are prefilled from the row.
  const [projectEdit, setProjectEdit] = useState(null);
  const [initEdit, setInitEdit] = useState(null);
  const [typeEdit, setTypeEdit] = useState(null);
  const [autoTaskEdit, setAutoTaskEdit] = useState(null);
  const [showProjectForm, setShowProjectForm] = useState(false);
  const [showInitiativeForm, setShowInitiativeForm] = useState(false);
  const [showEventTypeForm, setShowEventTypeForm] = useState(false);
  const [projectForm, setProjectForm] = useState(emptyProject);
  const [initiativeForm, setInitiativeForm] = useState(emptyInitiative);
  const [eventTypeForm, setEventTypeForm] = useState(emptyEventType);
  const [newAutoTask, setNewAutoTask] = useState(null);
  const [parentForCreate, setParentForCreate] = useState(null);
  const [editingAutoTasks, setEditingAutoTasks] = useState(null);
  const [showEventForm, setShowEventForm] = useState(false);
  const [editingEvent, setEditingEvent] = useState(null);
  const [taskForm, setTaskForm] = useState(null); // { editing?, initial, preset: { status, parent_id } }

  const selectedProject = projects.find((p) => String(p.id) === String(selected));

  const loadAll = async () => {
    const [p, et, tasks, milestones] = await Promise.all([
      loadProjects().catch(() => []),
      loadEventTypes().catch(() => []),
      loadReminders().catch(() => []),
      // All milestones (no project filter) feed the dashboard's Suggested panel.
      loadProjectMilestones().catch(() => []),
    ]);
    setProjects(p);
    setEventTypes(et);
    setAllTasks(tasks);
    setAllMilestones(Array.isArray(milestones) ? milestones : []);
  };

  const loadProjectDetail = async (projectId) => {
    const [inits, events] = await Promise.all([
      loadInitiatives(projectId).catch(() => []),
      loadEvents().catch(() => []),
    ]);
    setInitiatives(inits);
    setProjectEvents(events.filter((e) => String(e.project_id) === String(projectId)));
  };

  const loadRef = useRef(loadAll);
  const detailRef = useRef(loadProjectDetail);
  const selectedRef = useRef(selected);
  useEffect(() => {
    loadRef.current = loadAll;
    detailRef.current = loadProjectDetail;
    selectedRef.current = selected;
  });

  useEffect(() => {
    loadAll().finally(() => setLoading(false));
  }, []);

  // Freshness: any write to these collections (ours, another tab, the
  // assistant) refreshes the lists without a manual reload.
  useEffect(() => {
    const reload = () => { loadRef.current(); if (selectedRef.current) detailRef.current(selectedRef.current); };
    const offs = [
      onDataChange("projects", reload),
      onDataChange("reminders", reload),
      onDataChange("events", reload),
      onDataChange("project_milestones", reload),
      onDataChange("project_updates", reload),
    ];
    return () => offs.forEach((off) => off && off());
  }, []);

  useEffect(() => {
    if (selected) loadProjectDetail(selected);
    setProjectEdit(null); setInitEdit(null);
  }, [selected]);

  // Open the create form when arriving via the sidebar's "New project"
  useEffect(() => {
    if (params.get("new") === "1") setShowProjectForm(true);
  }, [params]);

  /* ── Task actions (shared by board, list, dashboard, panel) ── */

  const reloadTasks = async () => { setAllTasks(await loadReminders().catch(() => allTasks)); };

  const completeViaApi = async (task) => {
    const recurring = task.recurrence && task.recurrence !== "none";
    const today = toDateStr(new Date());
    const occurrence = recurring ? (nextOccurrence(task, today) || today) : today;
    return completeReminder(task.id, occurrence);
  };

  const completeTask = async (task) => {
    const recurring = task.recurrence && task.recurrence !== "none";
    const prev = allTasks;
    if (!recurring) {
      setAllTasks((list) => list.map((t) => t.id === task.id
        ? { ...t, completed: true, completed_date: toDateStr(new Date()), status: "done" } : t));
    }
    try { await completeViaApi(task); if (recurring) await reloadTasks(); }
    catch (e) { setAllTasks(prev); addToast(`Couldn't complete: ${e.message}`, "error"); }
  };

  // Mirrors TaskDetailPage's Reopen: updateReminder({ completed: false,
  // completed_date: null }). A stale status of "done" is also cleared so the
  // effective status cannot stay Done.
  const reopenTask = async (task) => {
    const prev = allTasks;
    setAllTasks((list) => list.map((t) => t.id === task.id
      ? { ...t, completed: false, completed_date: null, status: t.status === "done" ? "backlog" : t.status } : t));
    try {
      await updateReminder(task.id, { completed: false, completed_date: null });
      if (task.status === "done") await updateReminder(task.id, { status: "backlog" });
    } catch (e) { setAllTasks(prev); addToast(`Couldn't reopen: ${e.message}`, "error"); }
  };

  // A status move writes STATUS ONLY (never a date). Done goes through
  // completeReminder; leaving Done reopens first, then writes the status.
  const changeTaskStatus = async (task, newStatus) => {
    const current = getStatus(task);
    if (current === newStatus) return;
    const prev = allTasks;
    setAllTasks((list) => list.map((t) => {
      if (t.id !== task.id) return t;
      if (newStatus === "done") return { ...t, status: "done", completed: task.recurrence && task.recurrence !== "none" ? t.completed : true };
      if (current === "done") return { ...t, status: newStatus, completed: false, completed_date: null };
      return { ...t, status: newStatus };
    }));
    try {
      if (newStatus === "done") { await completeViaApi(task); await reloadTasks(); }
      else if (current === "done" || task.completed) {
        await updateReminder(task.id, { completed: false, completed_date: null });
        await updateReminder(task.id, { status: newStatus });
      } else {
        await updateReminder(task.id, { status: newStatus });
      }
    } catch (e) {
      setAllTasks(prev);
      addToast(`Couldn't move task: ${e.message}`, "error");
    }
  };

  const deleteTask = async (task) => {
    if (!await confirm(`Delete "${task.name}"?`, { title: "Delete task", confirmLabel: "Delete" })) return;
    const prev = allTasks;
    setAllTasks((list) => list.filter((t) => t.id !== task.id));
    closePanel();
    try { await deleteReminder(task.id); addToast("Task deleted.", "success"); }
    catch (e) { setAllTasks(prev); addToast(`Couldn't delete task: ${e.message}`, "error"); }
  };

  const quickAddTask = async ({ name, status, project_id }) => {
    try {
      const saved = await newReminder({ name, project_id: project_id || null, status });
      if (saved?.id) {
        let row = saved;
        if (status && status !== "done" && row.status !== status) {
          await updateReminder(row.id, { status });
          row = { ...row, status };
        }
        if (status === "done") { await completeReminder(row.id); row = { ...row, completed: true, status: "done" }; }
        setAllTasks((list) => [...list.filter((t) => t.id !== row.id), row]);
      } else await reloadTasks();
    } catch (e) { addToast(`Couldn't add task: ${e.message}`, "error"); }
  };

  const openTaskForm = ({ project = null, parent = null, status = null, task = null } = {}) => {
    if (task) { setTaskForm({ editing: task, initial: taskToForm(task), preset: {} }); return; }
    const projectId = project?.id || parent?.project_id || selectedProject?.id || "";
    setTaskForm({
      initial: { ...emptyTaskForm, project_id: projectId ? String(projectId) : "" },
      preset: { status, parent_id: parent?.id || null },
    });
  };

  const saveTaskForm = async (fields) => {
    if (taskForm.editing) {
      await updateReminder(taskForm.editing.id, fields);
      addToast("Task updated.", "success");
      await reloadTasks();
      return;
    }
    const { status, parent_id } = taskForm.preset || {};
    const saved = await newReminder({ ...fields, ...(status ? { status } : {}), ...(parent_id ? { parent_id } : {}) });
    if (saved?.id) {
      if (parent_id && String(saved.parent_id) !== String(parent_id)) {
        await updateReminder(saved.id, { parent_id });
      }
      if (status === "done") await completeReminder(saved.id);
      else if (status && saved.status !== status) await updateReminder(saved.id, { status });
    }
    addToast("Task added.", "success");
    await reloadTasks();
  };

  const openTask = (task) => {
    openPanel({
      title: task.name,
      content: (
        <TaskPanelContent
          task={task}
          projects={projects}
          allTasks={allTasks}
          onChangeStatus={changeTaskStatus}
          onComplete={completeTask}
          onReopen={reopenTask}
          onDelete={deleteTask}
          onReload={reloadTasks}
          addToast={addToast}
          confirm={confirm}
        />
      ),
    });
  };

  /* ── Project actions ── */

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
    const fields = {
      name: projectForm.name.trim(), description: projectForm.description || "",
      color: projectForm.color, parent_id: parentForCreate || null,
      stage: projectForm.stage || "idea", due_date: projectForm.due_date || null,
      archived: Boolean(projectForm.archived),
    };
    const wasSubProject = parentForCreate;
    let p;
    try { p = await newProject(fields); }
    catch (err) { throw failed("create project", err); }
    if (p?.id) {
      // newProject's contract carries stage only; due_date/archived flow
      // through updateProject, so apply them right after create.
      if (fields.due_date || fields.archived) {
        try {
          await updateProject(p.id, { due_date: fields.due_date, archived: fields.archived });
          p = { ...p, due_date: fields.due_date, archived: fields.archived };
        } catch { /* the project exists; the edit form can set these */ }
      }
      setProjects((prev) => [...prev, p]);
      if (!wasSubProject) setSelected(p.id);
    } else {
      await loadAll();
      if (!wasSubProject && p) setSelected(p.id);
    }
    addToast("Project created.", "success");
  };

  const openProjectEdit = (project) => setProjectEdit({
    id: project.id,
    name: project.name || "", description: project.description || "",
    color: project.color || emptyProject.color, stage: project.stage || "idea",
    due_date: project.due_date || "", archived: Boolean(project.archived),
  });

  const saveProjectEdit = async () => {
    requireName(projectEdit?.name);
    const current = projects.find((p) => String(p.id) === String(projectEdit.id));
    if (!current) throw new Error("That project no longer exists.");
    const id = current.id;
    const prev = current;
    const updates = {
      name: projectEdit.name.trim(), description: projectEdit.description || "",
      color: projectEdit.color, stage: projectEdit.stage || "idea",
      due_date: projectEdit.due_date || null, archived: Boolean(projectEdit.archived),
    };
    setProjects((list) => list.map((p) => p.id === id ? { ...p, ...updates } : p));
    try {
      await updateProject(id, updates);
      if (prev.stage !== updates.stage) await safeLog(id, `Stage moved to ${STAGE_LABEL[updates.stage] || updates.stage}`);
      addToast("Project updated.", "success");
    } catch (err) {
      setProjects((list) => list.map((p) => p.id === id ? prev : p));
      throw failed("save project", err);
    }
  };

  const handleDeleteProject = async (projectOrId) => {
    const id = projectOrId?.id ?? projectOrId;
    const target = projects.find((p) => String(p.id) === String(id));
    if (!await confirm(`Delete "${target?.name || "this project"}" and all its tasks/initiatives?`, { title: "Delete project", confirmLabel: "Delete" })) return;
    try {
      await deleteProject(id);
      addToast("Project deleted.", "success");
      if (String(selected) === String(id)) setSelected(null);
      await loadAll();
    } catch (err) {
      addToast(`Couldn't delete project: ${err?.message || "unknown error"}`, "error");
    }
  };

  const toggleArchive = async (project) => {
    const prev = projects;
    const archived = !project.archived;
    setProjects((list) => list.map((p) => p.id === project.id ? { ...p, archived } : p));
    try { await updateProject(project.id, { archived }); addToast(archived ? "Project archived." : "Project unarchived.", "success"); }
    catch (e) { setProjects(prev); addToast(`Couldn't update project: ${e.message}`, "error"); }
  };

  const changeProjectStage = async (project, stage) => {
    if (stageOf(project) === stage) return;
    const prev = projects;
    setProjects((list) => list.map((p) => p.id === project.id ? { ...p, stage } : p));
    try {
      await updateProject(project.id, { stage });
      await safeLog(project.id, `Stage moved to ${STAGE_LABEL[stage] || stage}`);
      addToast(`Stage moved to ${STAGE_LABEL[stage] || stage}.`, "success");
    } catch (e) { setProjects(prev); addToast(`Couldn't move project: ${e.message}`, "error"); }
  };

  /* ── Events / initiatives / event types (preserved from the old page) ── */

  const eventWhen = (e) => {
    const range = e.end_date && e.end_date > e.date ? `${formatDisplayDate(e.date)} – ${formatDisplayDate(e.end_date)}` : formatDisplayDate(e.date);
    const time = e.start_time ? ` · ${formatTime12(e.start_time)}${e.end_time ? ` – ${formatTime12(e.end_time)}` : ""}` : "";
    return range + time;
  };
  const addEvent = async (values) => {
    const created = await createEventWithAutoTasks({ ...values, project_id: selectedProject.id }, eventTypes);
    if (created?.people_warning) addToast(created.people_warning, "error");
    await loadProjectDetail(selected);
  };
  const saveEventEdit = async (values) => {
    const res = await updateEvent(editingEvent.id, eventRowFromForm({ ...values, project_id: selectedProject.id }));
    if (res?.people_warning) addToast(res.people_warning, "error");
    await loadProjectDetail(selected);
  };
  const removeEvent = async (e) => {
    if (!await confirm(`Delete "${e.title}"?`, { title: "Delete event", confirmLabel: "Delete" })) return;
    setProjectEvents((prev) => prev.filter((x) => x.id !== e.id));
    try { await deleteEvent(e.id); } catch (err) { addToast("Couldn't delete: " + err.message, "error"); loadProjectDetail(selected); }
  };

  const handleCreateInitiative = async () => {
    requireName(initiativeForm.name);
    try { await newInitiative({ ...initiativeForm, project_id: selected }); }
    catch (err) { throw failed("add initiative", err); }
    setInitiativeForm(emptyInitiative);
    await loadProjectDetail(selected);
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
  const deleteInitiativeRow = async (i) => {
    if (!await confirm(`Delete the initiative "${i.name}"?`, { title: "Delete initiative", confirmLabel: "Delete" })) return;
    try { await deleteInitiative(i.id); await loadProjectDetail(selected); }
    catch (err) { addToast(`Couldn't delete: ${err?.message || "unknown error"}`, "error"); }
  };

  const handleCreateEventType = async () => {
    requireName(eventTypeForm.name);
    try { await newEventType({ ...eventTypeForm, auto_tasks: [] }); }
    catch (err) { throw failed("create event type", err); }
    setEventTypeForm(emptyEventType);
    await loadAll();
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
  const addAutoTask = async () => {
    requireName(newAutoTask?.name, "a task name");
    const et = eventTypes.find((x) => x.id === newAutoTask.etId);
    if (!et) throw new Error("That event type no longer exists.");
    const { etId, ...task } = newAutoTask;
    const updated = [...(et.auto_tasks || []), { ...task, name: task.name.trim(), offset_days: Number(task.offset_days) || 0 }].sort(byOffset);
    try { await updateEventType(etId, { auto_tasks: updated }); }
    catch (err) { throw failed("add auto-task", err); }
    await loadAll();
  };
  const removeAutoTask = async (etId, task) => {
    const et = eventTypes.find((x) => x.id === etId);
    if (!et) return;
    if (!await confirm(`Remove "${task.name}" from ${et.name}'s auto-tasks?`, { title: "Remove auto-task", confirmLabel: "Remove" })) return;
    const updated = et.auto_tasks.filter((t) => t !== task);
    try { await updateEventType(etId, { auto_tasks: updated }); await loadAll(); }
    catch (err) { addToast(`Couldn't remove auto-task: ${err?.message || "unknown error"}`, "error"); }
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

  /* ── Home filtering / sorting ── */
  const q = search.trim().toLowerCase();
  const matchesSearch = (p) => !q || `${p.name} ${p.description || ""}`.toLowerCase().includes(q);
  const matchesStage = (p) => stageFilter === "all" || stageOf(p) === stageFilter;
  const matchesArchive = (p) => archivedOnly ? Boolean(p.archived) : !p.archived;
  const lastActivity = (p) => {
    const mine = allTasks.filter((t) => String(t.project_id) === String(p.id));
    return mine.map((t) => t.completed_date || t.date || t.created_at || "").sort().pop() || p.created_at || "";
  };
  const visibleProjects = projects
    .filter((p) => !p.parent_id && matchesSearch(p) && matchesStage(p) && matchesArchive(p))
    .slice()
    .sort((a, b) => {
      if (sortBy === "name") return String(a.name).localeCompare(String(b.name));
      if (sortBy === "target") return String(a.due_date || "9999").localeCompare(String(b.due_date || "9999"));
      if (sortBy === "progress") return statsFor(b, allTasks).progress - statsFor(a, allTasks).progress;
      return String(lastActivity(b)).localeCompare(String(lastActivity(a))); // recently active
    });
  const pipelineProjects = projects.filter((p) => !p.parent_id && matchesSearch(p) && matchesArchive(p));
  const archivedCount = projects.filter((p) => !p.parent_id && p.archived).length;
  const children = selected ? projects.filter((p) => String(p.parent_id) === String(selected)) : [];
  const parentProject = selectedProject?.parent_id
    ? projects.find((p) => String(p.id) === String(selectedProject.parent_id))
    : null;
  const projectTasks = selected ? allTasks.filter((t) => String(t.project_id) === String(selected)) : [];

  return (
    <div className="module-page">
      {dialog}
      <div className="module-header">
        <h1>Projects</h1>
        <div className="header-actions">
          <button type="button" className="btn-secondary-sm" onClick={() => setShowEventTypeForm(true)}>
            <i className="fa-solid fa-tag" aria-hidden="true" /> Event types
          </button>
          <button type="button" className="btn btn-sm" onClick={() => { setParentForCreate(null); setProjectForm(emptyProject); setShowProjectForm(true); }}>
            <i className="fa-solid fa-plus" aria-hidden="true" /> New project
          </button>
        </div>
      </div>

      {loading && <PageSkeleton variant="page" label="Loading projects" />}

      {!loading && !selected && (
        <>
          <div className="p2-home-controls">
            <div className="segmented" role="group" aria-label="Projects view">
              {[["dashboard", "Dashboard"], ["board", "Board"], ["pipeline", "Pipeline"]].map(([key, label]) => (
                <button key={key} type="button" className={`segmented-opt${homeView === key ? " active" : ""}`} onClick={() => setHomeView(key)}>{label}</button>
              ))}
            </div>
            <select value={stageFilter} onChange={(e) => setStageFilter(e.target.value)} aria-label="Filter by stage" className="p2-filter-select">
              <option value="all">All stages</option>
              {STAGES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
            <input
              className="p2-search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search projects"
              aria-label="Search projects"
            />
            <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} aria-label="Sort projects" className="p2-filter-select">
              <option value="recent">Recently active</option>
              <option value="name">Name</option>
              <option value="target">Target date</option>
              <option value="progress">Progress</option>
            </select>
            <button
              type="button"
              className={`btn-secondary-sm${archivedOnly ? " is-on" : ""}`}
              onClick={() => setArchivedOnly((v) => !v)}
              aria-pressed={archivedOnly}
            >
              Archived ({archivedCount})
            </button>
          </div>

          {projects.filter((p) => !p.parent_id).length === 0 ? (
            <p className="no-entries">No projects yet. Hit &ldquo;New project&rdquo; to get started.</p>
          ) : homeView === "dashboard" ? (
            <Dashboard
              projects={visibleProjects}
              tasks={allTasks}
              milestones={allMilestones}
              onOpenProject={setSelected}
              onOpenTask={openTask}
              onEditProject={openProjectEdit}
              onArchiveProject={toggleArchive}
              onNewTaskForProject={(project) => openTaskForm({ project })}
            />
          ) : homeView === "board" ? (
            <KanbanBoard
              tasks={allTasks}
              projects={projects}
              onOpenTask={openTask}
              onCompleteTask={completeTask}
              onMoveTask={changeTaskStatus}
              onQuickAddRequest={(status) => openTaskForm({ status })}
            />
          ) : (
            <Pipeline
              projects={pipelineProjects}
              tasks={allTasks}
              onOpenProject={(p) => setSelected(p.id)}
              onMoveProject={changeProjectStage}
            />
          )}

          {/* Event Types Section (preserved) */}
          <section className="db-card event-types-card" aria-label="Event types and auto-tasks">
            <div className="db-card-header project-card-head">
              <h3 className="db-card-title">Event types &amp; auto-tasks</h3>
            </div>
            <p className="project-card-desc">
              When you create a calendar event with a type (e.g. &ldquo;Hike&rdquo;), tasks are auto-created based on the template below.
            </p>
            {eventTypes.length === 0 && <p className="no-entries">No event types yet.</p>}
            {eventTypes.map((et) => (
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
        </>
      )}

      {!loading && selected && !selectedProject && (
        <>
          <nav className="project-crumbs" aria-label="Project navigation">
            <button type="button" className="btn-ghost btn-sm" onClick={() => setSelected(null)}>
              <i className="fa-solid fa-arrow-left" aria-hidden="true" /> All projects
            </button>
          </nav>
          <p className="no-entries">That project could not be found. It may have been deleted.</p>
        </>
      )}

      {!loading && selected && selectedProject && (
        <ProjectDetail
          project={selectedProject}
          projects={projects}
          tasks={projectTasks}
          childrenProjects={children}
          parentProject={parentProject}
          initiatives={initiatives}
          projectEvents={projectEvents}
          eventWhen={eventWhen}
          confirm={confirm}
          addToast={addToast}
          onBack={() => setSelected(null)}
          onOpenProject={setSelected}
          onEditProject={openProjectEdit}
          onDeleteProject={handleDeleteProject}
          onStageChange={changeProjectStage}
          onOpenTask={openTask}
          onCompleteTask={completeTask}
          onReopenTask={reopenTask}
          onChangeTaskStatus={changeTaskStatus}
          onDeleteTask={deleteTask}
          onQuickAddTask={quickAddTask}
          onOpenTaskForm={openTaskForm}
          onAddSubProject={openNewSub}
          onAddInitiative={() => setShowInitiativeForm(true)}
          onEditInitiative={(i) => setInitEdit({ id: i.id, name: i.name || "", description: i.description || "", recurrence: i.recurrence || "weekly" })}
          onDeleteInitiative={deleteInitiativeRow}
          onAddEvent={() => { setEditingEvent(null); setShowEventForm(true); }}
          onEditEvent={(e) => { setShowEventForm(false); setEditingEvent(e); }}
          onDeleteEvent={removeEvent}
        />
      )}

      {/* ── Modals ── */}
      {showProjectForm && (
        <FormModal
          title={parentForCreate ? `New sub-project in ${selectedProject?.name || ""}` : "New project"}
          submitLabel="Create"
          onClose={closeProjectForm}
          onSubmit={handleCreateProject}
        >
          <ProjectFields form={projectForm} setForm={setProjectForm} />
        </FormModal>
      )}

      {projectEdit && (
        <FormModal title="Edit project" submitLabel="Save changes" onClose={() => setProjectEdit(null)} onSubmit={saveProjectEdit}>
          <ProjectFields form={projectEdit} setForm={setProjectEdit} />
        </FormModal>
      )}

      {taskForm && (
        <TaskFormModal
          title={taskForm.editing ? "Edit task" : "New task"}
          submitLabel={taskForm.editing ? "Save changes" : "Add task"}
          initial={taskForm.initial}
          projects={projects}
          onSave={saveTaskForm}
          onClose={() => setTaskForm(null)}
        />
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
            <input placeholder="e.g. Post on Instagram" value={initiativeForm.name} onChange={(e) => setInitiativeForm({ ...initiativeForm, name: e.target.value })} data-autofocus required />
          </Field>
          <Field label="Description (optional)">
            <textarea value={initiativeForm.description} onChange={(e) => setInitiativeForm({ ...initiativeForm, description: e.target.value })} rows={2} />
          </Field>
          <Field label="Repeats">
            <select value={initiativeForm.recurrence} onChange={(e) => setInitiativeForm({ ...initiativeForm, recurrence: e.target.value })}>
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
            <input placeholder="e.g. Hike, Meeting, Party" value={eventTypeForm.name} onChange={(e) => setEventTypeForm({ ...eventTypeForm, name: e.target.value })} data-autofocus required />
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
