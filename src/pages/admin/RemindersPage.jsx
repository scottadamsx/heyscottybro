import { useEffect, useMemo, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { loadReminders, newReminder, completeReminder, updateReminder, deleteReminder, loadProjects, loadEvents } from "../../api/plannerApi";
import { formatDisplayDate, toDateStr, nextOccurrence, formatTime12 } from "../../utils/plannerUtils";
import TaskFormModal, { taskToForm } from "../../components/TaskFormModal";
import { onDataChange } from "../../utils/dataEvents";
import { useConfirm } from "../../hooks/useConfirm";
import { useToast } from "../../contexts/ToastContext";
import { loadAccountability, logHabitDone, logHabitMissed, unlogHabitMissed } from "../../api/accountabilityApi";
import { dueHabits, missedHabits } from "../../utils/habitSchedule";
import DueHabitReminders from "../../components/DueHabitReminders";
import RescheduleSheet from "../../components/RescheduleSheet";
import "./plan.css";

export default function RemindersPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const openTask = (id) => navigate(`/admin/tasks/${id}`);
  const filter = params.get("project") || "all"; // "all" | "none" | project id (driven by the side panel)

  const { confirm, dialog } = useConfirm();
  const { addToast } = useToast();
  const [list, setList] = useState([]);
  const [habits, setHabits] = useState(null);
  const [habitSaving, setHabitSaving] = useState(null);
  const [projects, setProjects] = useState([]);
  // The task modal: null (closed) | { id: null } (new) | the row being edited.
  const [taskModal, setTaskModal] = useState(null);
  const [scheduling, setScheduling] = useState(null); // { item, events } — the Fit-it-in dialog
  const openSchedule = async (r) => {
    try { setScheduling({ item: r, events: await loadEvents() }); }
    catch (err) { addToast(`Couldn't open the day view: ${err?.message || "unknown error"}`, "error"); }
  };
  // Computed per render (not module-level) so overdue highlighting stays
  // correct if the tab is left open past midnight.
  const [todayStr, setTodayStr] = useState(() => toDateStr(new Date()));
  useEffect(() => {
    const refresh = () => setTodayStr(toDateStr(new Date()));
    const timer = window.setInterval(refresh, 30_000);
    document.addEventListener("visibilitychange", refresh);
    return () => { window.clearInterval(timer); document.removeEventListener("visibilitychange", refresh); };
  }, []);

  // Loads are allSettled so one failing source can't blank the other; every
  // failure is named in a banner with a Retry (QF-3 — no silent empty list).
  const LOAD_SOURCES = [
    ["tasks", loadReminders, setList],
    ["projects", loadProjects, setProjects],
    ["habits", loadAccountability, setHabits],
  ];
  const [loadErrors, setLoadErrors] = useState([]);
  const load = async () => {
    const results = await Promise.allSettled(LOAD_SOURCES.map(([, fn]) => fn()));
    const failed = [];
    results.forEach((res, i) => {
      const [name, , set] = LOAD_SOURCES[i];
      if (res.status === "fulfilled") set(res.value);
      else { console.error(`[tasks] failed to load ${name}`, res.reason); failed.push(`${name} (${res.reason?.message || res.reason})`); }
    });
    setLoadErrors(failed);
  };

  useEffect(() => { load(); }, []);

  // Refresh when Frodo creates/updates/deletes reminders from the ChatBot
  useEffect(() => onDataChange("reminders", load), []);
  useEffect(() => onDataChange("projects", load), []);
  useEffect(() => onDataChange("accountability", load), []);

  const habitRows = useMemo(() => habits ? dueHabits(habits, todayStr) : [], [habits, todayStr]);
  const missedRows = useMemo(() => habits ? missedHabits(habits, todayStr) : [], [habits, todayStr]);
  // "Missed it": cross today's habit out (not done, no streak) and undo it.
  const setHabitMissed = async (tracker, missed) => {
    if (habitSaving) return;
    setHabitSaving(tracker.id);
    try {
      setHabits(await (missed ? logHabitMissed(tracker, todayStr) : unlogHabitMissed(tracker, todayStr)));
      addToast(missed ? `${tracker.name} crossed out for today.` : `${tracker.name} is back on today's list.`, "success");
    } catch (err) {
      addToast(`Couldn't update habit: ${err?.message || "unknown error"}`, "error");
    } finally { setHabitSaving(null); }
  };
  const completeHabit = async (tracker) => {
    if (habitSaving) return;
    setHabitSaving(tracker.id);
    try {
      setHabits(await logHabitDone(tracker, todayStr));
      addToast(`${tracker.name} completed.`, "success");
    } catch (err) {
      addToast(`Couldn't complete habit: ${err?.message || "unknown error"}`, "error");
    } finally { setHabitSaving(null); }
  };

  const filtered = useMemo(() => {
    if (filter === "all") return list;
    if (filter === "none") return list.filter(r => !r.project_id);
    return list.filter(r => String(r.project_id) === String(filter));
  }, [list, filter]);

  // Active rows carry `next`: the pending occurrence (one-time = its date;
  // recurring = the first occurrence after the last one ticked off). Lists
  // sort and flag overdue by it, so a missed weekly task shows its missed date.
  const active = useMemo(() => filtered
    .filter((r) => !r.completed && r.date)
    .map((r) => ({ ...r, next: nextOccurrence(r, todayStr) }))
    .sort((a, b) => String(a.next || a.date).localeCompare(String(b.next || b.date))), [filtered, todayStr]);
  const noDate = useMemo(() => filtered.filter((r) => !r.completed && !r.date), [filtered]);
  const completed = useMemo(() => filtered.filter((r) => r.completed), [filtered]);

  const handleComplete = async (r) => {
    const recurring = r.recurrence && r.recurrence !== "none";
    const occurrence = recurring ? (r.next || todayStr) : todayStr;
    // Optimistic: one-time → done; recurring → that occurrence done, series stays.
    setList((prev) => prev.map((x) => x.id === r.id
      ? (recurring ? { ...x, completed_date: occurrence } : { ...x, completed: true, completed_date: occurrence })
      : x));
    try {
      const patch = await completeReminder(r.id, occurrence);
      setList((prev) => prev.map((x) => x.id === r.id ? { ...x, ...patch } : x));
    } catch (err) {
      addToast(`Couldn't complete task: ${err?.message || "unknown error"}`, "error");
      await load();
    }
  };

  const handleUncomplete = async (id) => {
    const r = list.find((x) => x.id === id);
    if (!(await confirm(`Mark "${r?.name || "this task"}" as incomplete?`, { title: "Undo completion", confirmLabel: "Undo" }))) return;
    setList((prev) => prev.map((x) => x.id === id ? { ...x, completed: false, completed_date: null } : x));
    try { await updateReminder(id, { completed: false, completed_date: null }); } catch { await load(); }
  };

  const handleDelete = async (id) => {
    const r = list.find((x) => x.id === id);
    if (!(await confirm(`Delete "${r?.name || "this task"}"?`, { title: "Delete task", confirmLabel: "Delete" }))) return;
    setList((prev) => prev.filter((x) => x.id !== id));
    try { await deleteReminder(id); } catch { await load(); }
  };

  // Saves throw on failure so the modal stays open with the error and what
  // was typed; the list is updated optimistically and rolled back.
  const saveEdit = async (id, fields) => {
    const prev = list.find((x) => x.id === id);
    setList((l) => l.map((x) => x.id === id ? { ...x, ...fields } : x));
    try {
      await updateReminder(id, fields);
      addToast("Task updated.", "success");
    } catch (err) {
      setList((l) => l.map((x) => x.id === id ? prev : x));
      throw new Error(`Couldn't save task: ${err?.message || "unknown error"}`, { cause: err });
    }
  };

  const addReminder = async (fields) => {
    const tempId = `temp-${Date.now()}`;
    setList((prev) => [...prev, { id: tempId, completed: false, ...fields }]);
    try {
      const saved = await newReminder(fields);
      if (saved?.id) {
        setList((prev) => prev.map((r) => r.id === tempId ? { completed: false, ...saved } : r));
      } else {
        await load();
      }
    } catch (err) {
      setList((prev) => prev.filter((r) => r.id !== tempId));
      throw new Error(`Couldn't add task: ${err?.message || "unknown error"}`, { cause: err });
    }
  };

  const projectName = (id) => projects.find(p => p.id === id)?.name || "";
  const projectColor = (id) => projects.find(p => p.id === id)?.color || "var(--text-muted)";

  const renderTask = (r) => {
    const overdue = r.next && r.next < todayStr;
    // Display-only formatting: the stored time stays "HH:MM" (QF-4).
    const meta = [
      r.time ? formatTime12(String(r.time).slice(0, 5)) : null,
      r.show_on_calendar === false ? "off calendar" : null,
      r.recurrence && r.recurrence !== "none" ? r.recurrence : null,
      r.recur_until ? `until ${r.recur_until}` : null,
      r.recur_times ? `${r.recur_times}×` : null,
    ].filter(Boolean);
    return (
      <div className="db-list-item task-row" key={r.id}>
        <span
          className="db-list-item-content task-row-main"
          role="button"
          tabIndex={0}
          onClick={() => openTask(r.id)}
          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openTask(r.id); } }}
        >
          <span className="db-list-item-title task-row-title">{r.name}</span>
          {(r.date || meta.length > 0 || r.project_id) && (
            <span className="db-list-item-subtitle task-row-meta">
              {r.date && (
                <span className={overdue ? "task-overdue" : undefined}>
                  {overdue ? "Overdue · " : ""}{formatDisplayDate(r.next || r.date)}
                </span>
              )}
              {meta.map((m, i) => <span key={i}>{(r.date || i > 0) ? " · " : ""}{m}</span>)}
              {r.project_id && (
                <span className="task-row-project">
                  {(r.date || meta.length > 0) ? " · " : ""}
                  <span className="task-row-dot" style={{ background: projectColor(r.project_id) }} aria-hidden="true" />
                  {projectName(r.project_id)}
                </span>
              )}
            </span>
          )}
        </span>
        <span className="task-row-actions">
          {(r.recurrence || "none") === "none" && (overdue
            ? <button type="button" className="btn-mini accent" onClick={() => openSchedule(r)}><i className="fa-solid fa-clock-rotate-left" aria-hidden="true" /> Fit it in</button>
            : <button type="button" className="btn-mini" onClick={() => openSchedule(r)} title="Schedule a time" aria-label={`Schedule ${r.name}`}><i className="fa-regular fa-clock" aria-hidden="true" /></button>)}
          <button type="button" className="btn-mini" onClick={() => setTaskModal(r)} title="Edit task">
            <i className="fa-solid fa-pen" aria-hidden="true" /> Edit
          </button>
          <button type="button" className="btn-sm btn-complete" onClick={() => handleComplete(r)}>
            Done
          </button>
          <button type="button" className="icon-x sm" onClick={() => handleDelete(r.id)} aria-label={`Delete ${r.name}`}>
            <i className="fa-solid fa-xmark" aria-hidden="true" />
          </button>
        </span>
      </div>
    );
  };

  return (
    <div className="module-page">
      {dialog}
      {scheduling && (
        <RescheduleSheet
          item={scheduling.item}
          kind="task"
          reminders={list}
          events={scheduling.events}
          today={todayStr}
          onClose={() => setScheduling(null)}
          onMoved={load}
        />
      )}
      {loadErrors.length > 0 && (
        <div className="load-error" role="alert">
          <p className="load-error-msg">Couldn't load {loadErrors.join(", ")}</p>
          <button type="button" className="btn-secondary-sm" onClick={load}>Retry</button>
        </div>
      )}
      <div className="module-header tasks-head">
        <h1>Tasks &amp; reminders</h1>
        {/* Inside Plan the page h1 is hidden (Plan owns it); this names the section instead. */}
        <h2 className="section-title tasks-embed-title">Tasks &amp; reminders</h2>
        <button type="button" className="btn" onClick={() => setTaskModal({ id: null })}>
          <i className="fa-solid fa-plus" aria-hidden="true" /> New task
        </button>
      </div>

      {taskModal && (
        <TaskFormModal
          key={taskModal.id || "new"}
          title={taskModal.id ? "Edit task" : "New task"}
          submitLabel={taskModal.id ? "Save changes" : "Add task"}
          initial={taskModal.id ? taskToForm(taskModal) : undefined}
          projects={projects}
          onSave={(fields) => (taskModal.id ? saveEdit(taskModal.id, fields) : addReminder(fields))}
          onClose={() => setTaskModal(null)}
        />
      )}

      <div className="tasks-layout">
        <div className="tasks-list">
          {filter === "all" && !loadErrors.some((error) => error.startsWith("habits (")) && (habits
            ? <DueHabitReminders rows={habitRows} missedRows={missedRows} busyId={habitSaving} onDone={completeHabit}
                onMiss={(t) => setHabitMissed(t, true)} onUnmiss={(t) => setHabitMissed(t, false)}
                onEdit={(id) => navigate(`/admin/life?tab=habits&id=${encodeURIComponent(id)}`)} />
            : <p className="field-hint" role="status">Loading due habits…</p>)}
          <section className="db-card" aria-label="Active tasks">
            <div className="db-card-header"><h3 className="db-card-title">Active ({active.length})</h3></div>
            {active.length === 0 && <p className="no-entries">No active tasks. All clear.</p>}
            {active.length > 0 && <div className="db-list task-list">{active.map(renderTask)}</div>}
          </section>

          <section className="db-card" aria-label="Tasks with no due date">
            <div className="db-card-header"><h3 className="db-card-title">No due date ({noDate.length})</h3></div>
            {noDate.length === 0 && <p className="no-entries">No undated tasks.</p>}
            {noDate.length > 0 && <div className="db-list task-list">{noDate.map(renderTask)}</div>}
          </section>

          {completed.length > 0 && (
            <section className="db-card" aria-label="Completed tasks">
              <div className="db-card-header"><h3 className="db-card-title">Completed ({completed.length})</h3></div>
              <div className="db-list task-list">
                {completed.map((r) => (
                  <div className="db-list-item task-row is-done" key={r.id}>
                    <span className="db-list-item-content">
                      <span className="db-list-item-title task-row-title">{r.name}</span>
                      <span className="db-list-item-subtitle">{formatDisplayDate(r.completed_date || r.date)}</span>
                    </span>
                    <span className="task-row-actions">
                      <button type="button" className="btn-mini" onClick={() => handleUncomplete(r.id)} title="Undo completion">
                        <i className="fa-solid fa-rotate-left" aria-hidden="true" /> Undo
                      </button>
                    </span>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
