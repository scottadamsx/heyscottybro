import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  loadReminders, loadEvents, loadTransactions, newEvent, deleteEvent,
  loadProjects, loadEventTypes, newReminder, completeReminder, updateReminder, deleteReminder,
} from "../../api/plannerApi";
import { expandReminders, toDateStr, formatDisplayDate } from "../../utils/plannerUtils";
import { onDataChange } from "../../utils/dataEvents";
import { useConfirm } from "../../hooks/useConfirm";
import DocLinks from "../../components/docs/DocLinks";

function monthLabel(year, month) {
  return new Date(year, month, 1).toLocaleDateString(undefined, { month: "long", year: "numeric" });
}

export default function CalendarPage() {
  const now = new Date();
  const [params, setParams] = useSearchParams();
  const { confirm, dialog } = useConfirm();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [reminders, setReminders] = useState([]);
  const [events, setEvents] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [projects, setProjects] = useState([]);
  const [eventTypes, setEventTypes] = useState([]);

  const [selectedDate, setSelectedDate] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [addMode, setAddMode] = useState("event"); // "event" | "task"

  // Filters — stored in URL so the sidebar can read them
  const filterProject = params.get("fp") || "";
  const filterKind = params.get("fk") || "all";
  const showCompleted = params.get("fc") !== "0";

  const setFilter = (key, value) => {
    setParams((prev) => {
      const next = new URLSearchParams(prev);
      if (!value || value === "all" || (key === "fc" && value === "1")) next.delete(key);
      else next.set(key, value);
      return next;
    });
  };
  const clearFilters = () => {
    setParams((prev) => {
      const next = new URLSearchParams(prev);
      next.delete("fp"); next.delete("fk"); next.delete("fc");
      return next;
    });
  };

  // event form
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [selectedProject, setSelectedProject] = useState("");
  const [selectedEventType, setSelectedEventType] = useState("");
  // task form
  const [taskName, setTaskName] = useState("");
  const [taskRecur, setTaskRecur] = useState("none");

  const load = async () => {
    const [r, e, t, p, et] = await Promise.all([
      loadReminders().catch(() => []),
      loadEvents().catch(() => []),
      loadTransactions().catch(() => []),
      loadProjects().catch(() => []),
      loadEventTypes().catch(() => []),
    ]);
    setReminders(r);
    setEvents(e);
    setTransactions(t);
    setProjects(p);
    setEventTypes(et);
  };

  useEffect(() => { load(); }, []);

  // Refresh calendar when Frodo creates/updates/deletes items from the ChatBot
  useEffect(() => {
    const unsubs = [
      onDataChange("reminders", load),
      onDataChange("events", load),
      onDataChange("transactions", load),
    ];
    return () => unsubs.forEach((u) => u());
  }, []);

  // Sidebar "jump to date" — navigate the grid to that month and open the day
  useEffect(() => {
    const d = params.get("date");
    if (!d) return;
    const [y, m] = d.split("-").map(Number);
    if (y && m) {
      setYear(y);
      setMonth(m - 1);
      openDay(d);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params]);

  const itemsByDate = useMemo(() => {
    const first = new Date(year, month, 1);
    const last = new Date(year, month + 1, 0);
    const map = {};

    const byProject = (item) => !filterProject || String(item.project_id) === filterProject;

    if (filterKind !== "events") {
      const visible = reminders.filter((r) => r.show_on_calendar !== false && !r.completed && byProject(r));
      expandReminders(visible, toDateStr(first), toDateStr(last)).forEach((item) => {
        map[item.date] = map[item.date] || [];
        map[item.date].push({ kind: "reminder", label: item.name });
      });

      if (showCompleted) {
        reminders
          .filter((r) => r.completed && r.show_on_calendar !== false && byProject(r))
          .forEach((r) => {
            const doneDate = r.date;
            if (!doneDate) return;
            const [dY, dM] = doneDate.split("-").map(Number);
            if (dY === year && dM === month + 1) {
              map[doneDate] = map[doneDate] || [];
              map[doneDate].push({ kind: "done", label: r.name });
            }
          });
      }
    }

    if (filterKind !== "tasks") {
      // expandReminders is generic over date/recurrence/recur_until/recur_times,
      // so it expands recurring events too (events have no `completed` to skip).
      expandReminders(events.filter(byProject), toDateStr(first), toDateStr(last)).forEach((item) => {
        map[item.date] = map[item.date] || [];
        map[item.date].push({ kind: "event", label: item.title });
      });
      transactions.filter((t) => t.type === "future").forEach((item) => {
        map[item.date] = map[item.date] || [];
        map[item.date].push({ kind: "future", label: item.description });
      });
    }

    return map;
  }, [year, month, reminders, events, transactions, filterProject, filterKind, showCompleted]);

  const firstDayIndex = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < firstDayIndex; i++) cells.push(null);
  for (let day = 1; day <= daysInMonth; day++) cells.push(day);

  const prevMonth = () => month === 0 ? (setMonth(11), setYear(year - 1)) : setMonth(month - 1);
  const nextMonth = () => month === 11 ? (setMonth(0), setYear(year + 1)) : setMonth(month + 1);

  const resetForms = () => {
    setTitle(""); setDescription(""); setSelectedProject(""); setSelectedEventType("");
    setTaskName(""); setTaskRecur("none");
  };

  const openDay = (date) => {
    setSelectedDate(date);
    setShowAdd(false);
    setAddMode("event");
    resetForms();
  };

  const goToDay = (offset) => {
    if (!selectedDate) return;
    const d = new Date(selectedDate + "T00:00:00");
    d.setDate(d.getDate() + offset);
    setYear(d.getFullYear());
    setMonth(d.getMonth());
    openDay(toDateStr(d));
  };

  // swipe between days on touch devices
  const touchX = useRef(null);
  const onTouchStart = (e) => { touchX.current = e.changedTouches[0].clientX; };
  const onTouchEnd = (e) => {
    if (touchX.current == null) return;
    const dx = e.changedTouches[0].clientX - touchX.current;
    touchX.current = null;
    if (Math.abs(dx) > 55) goToDay(dx < 0 ? 1 : -1);
  };

  // Derived day data — auto-refreshes after load(). Filters applied.
  const byProject = (item) => !filterProject || String(item.project_id) === filterProject;
  const dayEvents = selectedDate && filterKind !== "tasks"
    ? expandReminders(events.filter(byProject), selectedDate, selectedDate)
    : [];
  const dayTasks = selectedDate && filterKind !== "events"
    ? expandReminders(reminders.filter((r) => !r.completed && byProject(r)), selectedDate, selectedDate)
    : [];
  const dayDone = selectedDate && filterKind !== "events" && showCompleted
    ? reminders.filter((r) => r.completed && r.date === selectedDate && byProject(r))
    : [];

  const projectColor = (id) => projects.find((p) => String(p.id) === String(id))?.color;

  const saveEvent = async () => {
    if (!selectedDate || !title.trim()) return;
    const tempId = `temp-${Date.now()}`;
    const optimistic = {
      id: tempId,
      title: title.trim(),
      description: description.trim(),
      date: selectedDate,
      project_id: selectedProject || null,
      event_type_id: selectedEventType || null,
      recurrence: "none",
    };
    setEvents((prev) => [...prev, optimistic]);
    setTitle(""); setDescription(""); setSelectedEventType("");
    try {
      await newEvent({
        title: optimistic.title,
        description: optimistic.description,
        date: selectedDate,
        project_id: selectedProject || null,
        event_type_id: selectedEventType || null,
      });
      // Auto-create tasks based on event type template
      if (selectedEventType) {
        const et = eventTypes.find((x) => x.id === selectedEventType);
        if (et?.auto_tasks?.length) {
          const eventDate = new Date(selectedDate + "T00:00:00");
          for (const task of et.auto_tasks) {
            const taskDate = new Date(eventDate);
            taskDate.setDate(eventDate.getDate() + Number(task.offset_days));
            await newReminder({
              name: `${task.name} — ${optimistic.title}`,
              date: toDateStr(taskDate),
              recurrence: "none",
              project_id: selectedProject || null,
            });
          }
        }
      }
      await load();
    } catch {
      setEvents((prev) => prev.filter((e) => e.id !== tempId));
    }
  };

  const saveTask = async () => {
    if (!selectedDate || !taskName.trim()) return;
    const tempId = `temp-${Date.now()}`;
    const optimistic = {
      id: tempId,
      name: taskName.trim(),
      date: selectedDate,
      recurrence: taskRecur,
      project_id: selectedProject || null,
      completed: false,
      show_on_calendar: true,
    };
    setReminders((prev) => [...prev, optimistic]);
    setTaskName(""); setTaskRecur("none");
    try {
      await newReminder({
        name: optimistic.name,
        date: selectedDate,
        recurrence: taskRecur,
        project_id: selectedProject || null,
      });
      await load();
    } catch {
      setReminders((prev) => prev.filter((r) => r.id !== tempId));
    }
  };

  const handleUncomplete = async (id) => {
    const t = reminders.find((x) => x.id === id);
    if (!(await confirm(`Mark "${t?.name || "this task"}" as incomplete?`, { title: "Undo completion", confirmLabel: "Undo" }))) return;
    setReminders((prev) => prev.map((r) => r.id === id ? { ...r, completed: false, completed_date: null } : r));
    try { await updateReminder(id, { completed: false, completed_date: null }); } catch { await load(); }
  };

  const longDate = selectedDate
    ? new Date(selectedDate + "T00:00:00").toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })
    : "";

  return (
    <div className="module-page">
      {dialog}
      <div className="module-header">
        <h1>Calendar</h1>
        <div style={{ display: "flex", gap: "0.5rem" }}>
          <button className="btn-sm btn-secondary-sm btn" onClick={prevMonth}>← Prev</button>
          <button className="btn-sm btn-secondary-sm btn" onClick={nextMonth}>Next →</button>
        </div>
      </div>

      {/* Filter bar */}
      <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", alignItems: "center", marginBottom: "0.75rem" }}>
        <select
          className="form-select"
          style={{ flex: "1", minWidth: "140px", maxWidth: "200px" }}
          value={filterProject}
          onChange={(e) => setFilter("fp", e.target.value)}
        >
          <option value="">All projects</option>
          {projects.map((p) => (
            <option key={p.id} value={String(p.id)}>{p.name}</option>
          ))}
        </select>

        <div style={{ display: "flex", gap: "0.25rem" }}>
          {[["all", "All"], ["events", "Events"], ["tasks", "Tasks"]].map(([val, label]) => (
            <button
              key={val}
              className={`btn-sm ${filterKind === val ? "btn" : "btn-secondary-sm btn"}`}
              style={filterKind === val ? { background: "var(--accent)", color: "#fff", border: "none" } : {}}
              onClick={() => setFilter("fk", val)}
            >
              {label}
            </button>
          ))}
        </div>

        <button
          className={`btn-sm ${showCompleted ? "btn" : "btn-secondary-sm btn"}`}
          style={showCompleted ? { background: "var(--accent)", color: "#fff", border: "none" } : {}}
          onClick={() => setFilter("fc", showCompleted ? "0" : "1")}
        >
          ✓ Done
        </button>

        {(filterProject || filterKind !== "all" || !showCompleted) && (
          <button
            onClick={clearFilters}
            style={{ marginLeft: "auto", background: "none", border: "none", color: "var(--text-muted)", fontSize: "0.75rem", cursor: "pointer", textDecoration: "underline", padding: "0.25rem 0" }}
          >
            Clear filters
          </button>
        )}
      </div>

      <div className="db-card">
        <h3 className="db-card-title" style={{ marginBottom: "1rem" }}>{monthLabel(year, month)}</h3>
        <div className="calendar-grid-react">
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((name) => (
            <div key={name} className="calendar-day-name">{name}</div>
          ))}
          {cells.map((day, i) => {
            if (!day) return <div key={`e-${i}`} className="calendar-cell empty" />;
            const date = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
            const isToday = date === toDateStr(now);
            return (
              <button
                key={date}
                type="button"
                className="calendar-cell"
                style={isToday ? { borderColor: "var(--accent)" } : {}}
                onClick={() => openDay(date)}
              >
                <span className="day-number" style={isToday ? { color: "var(--accent)" } : {}}>{day}</span>
                {(() => {
                  const items = itemsByDate[date] || [];
                  const evCount = items.filter((x) => x.kind === "event" || x.kind === "future").length;
                  const taskCount = items.filter((x) => x.kind === "reminder").length;
                  const doneCount = items.filter((x) => x.kind === "done").length;
                  if (items.length === 0) return null;
                  return (
                    <>
                      {evCount > 0 && <span className="calendar-count event-count">{evCount} event{evCount !== 1 ? "s" : ""}</span>}
                      {taskCount > 0 && <span className="calendar-count task-count">{taskCount} task{taskCount !== 1 ? "s" : ""}</span>}
                      {doneCount > 0 && <span className="calendar-count done-count">{doneCount} done</span>}
                    </>
                  );
                })()}
              </button>
            );
          })}
        </div>
      </div>

      {selectedDate && (
        <div className="event-overlay" onClick={(e) => { if (e.target.classList.contains("event-overlay")) setSelectedDate(""); }}>
          <div className="day-modal" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
            <div className="day-modal-head">
              <button className="day-nav" onClick={() => goToDay(-1)} aria-label="Previous day"><i className="fa-solid fa-chevron-left" /></button>
              <div className="day-modal-titles">
                <div className="day-modal-dow">{longDate.split(",")[0]}</div>
                <div className="day-modal-date">{longDate.split(", ").slice(1).join(", ") || longDate}</div>
              </div>
              <button className="day-nav" onClick={() => goToDay(1)} aria-label="Next day"><i className="fa-solid fa-chevron-right" /></button>
              <button className="icon-x" onClick={() => setSelectedDate("")} aria-label="Close"><i className="fa-solid fa-xmark" /></button>
            </div>

            <div className="day-modal-body">
              {/* Events */}
              <div className="day-section">
                <div className="day-section-head">
                  <span><i className="fa-regular fa-calendar" /> Events</span>
                  <span className="day-count">{dayEvents.length}</span>
                </div>
                {dayEvents.length === 0 && <p className="day-empty">Nothing scheduled.</p>}
                {dayEvents.map((e) => (
                  <div className="day-item" key={e.id}>
                    <span className="day-item-dot" style={{ background: projectColor(e.project_id) || "var(--accent)" }} />
                    <div className="day-item-body">
                      <div className="day-item-title">{e.title}</div>
                      {e.description && <div className="day-item-sub">{e.description}</div>}
                      <DocLinks entityType="event" entityId={e.id} title="Documents" compact />
                    </div>
                    <button className="icon-x sm" onClick={async () => { if (await confirm(`Delete "${e.title}"?`, { title: "Delete event", confirmLabel: "Delete" })) { setEvents((prev) => prev.filter((x) => x.id !== e.id)); deleteEvent(e.id).catch(load); } }} aria-label="Delete event"><i className="fa-solid fa-xmark" /></button>
                  </div>
                ))}
              </div>

              {/* Tasks */}
              <div className="day-section">
                <div className="day-section-head">
                  <span><i className="fa-solid fa-list-check" /> Tasks</span>
                  <span className="day-count">
                    {dayTasks.length} active{dayDone.length > 0 ? ` · ${dayDone.length} done` : ""}
                  </span>
                </div>
                {dayTasks.length === 0 && dayDone.length === 0 && <p className="day-empty">No tasks due.</p>}

                {dayTasks.map((t) => (
                  <div className="day-item" key={`${t.id}-${t.date}`}>
                    <button className="day-check" onClick={() => completeReminder(t.id).then(load)} title="Mark complete"><i className="fa-regular fa-circle" /></button>
                    <div className="day-item-body">
                      <div className="day-item-title">{t.name}</div>
                      {t.recurrence && t.recurrence !== "none" && <div className="day-item-sub">{t.recurrence}</div>}
                    </div>
                    <button className="icon-x sm" onClick={async () => { if (await confirm(`Delete "${t.name}"?`, { title: "Delete task", confirmLabel: "Delete" })) { setReminders((prev) => prev.filter((r) => r.id !== t.id)); deleteReminder(t.id).catch(load); } }} aria-label="Delete task"><i className="fa-solid fa-xmark" /></button>
                  </div>
                ))}

                {dayDone.map((t) => (
                  <div className="day-item done" key={`done-${t.id}`}>
                    <span className="day-check done" title="Completed"><i className="fa-solid fa-circle-check" /></span>
                    <div className="day-item-body">
                      <div className="day-item-title">{t.name}</div>
                      <div className="day-item-sub">Completed{t.completed_date ? ` · ${formatDisplayDate(t.completed_date)}` : ""}</div>
                    </div>
                    <span style={{ display: "flex", gap: "0.25rem" }}>
                      <button className="btn-sm" onClick={() => handleUncomplete(t.id)} title="Undo completion">↩ Undo</button>
                      <button className="icon-x sm" onClick={async () => { if (await confirm(`Delete "${t.name}"?`, { title: "Delete task", confirmLabel: "Delete" })) { setReminders((prev) => prev.filter((r) => r.id !== t.id)); deleteReminder(t.id).catch(load); } }} aria-label="Delete task"><i className="fa-solid fa-xmark" /></button>
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Add */}
            <div className="day-add">
              {!showAdd ? (
                <button className="btn day-add-trigger" onClick={() => setShowAdd(true)}>
                  <i className="fa-solid fa-plus" /> Add event or task
                </button>
              ) : (
              <>
              <div className="day-add-top">
                <span className="day-add-label">Add to this day</span>
                <button className="icon-x sm" onClick={() => setShowAdd(false)} aria-label="Close add"><i className="fa-solid fa-xmark" /></button>
              </div>
              <div className="day-seg">
                <button className={addMode === "event" ? "active" : ""} onClick={() => setAddMode("event")}><i className="fa-regular fa-calendar" /> Event</button>
                <button className={addMode === "task" ? "active" : ""} onClick={() => setAddMode("task")}><i className="fa-solid fa-list-check" /> Task</button>
              </div>

              {addMode === "event" ? (
                <div className="day-add-form">
                  <input placeholder="Event title" value={title} onChange={(e) => setTitle(e.target.value)} />
                  <textarea placeholder="Description (optional)" value={description} onChange={(e) => setDescription(e.target.value)} rows={2} style={{ resize: "vertical" }} />
                  {eventTypes.length > 0 && (
                    <select value={selectedEventType} onChange={(e) => setSelectedEventType(e.target.value)}>
                      <option value="">No event type</option>
                      {eventTypes.map((et) => <option key={et.id} value={et.id}>{et.name}</option>)}
                    </select>
                  )}
                  {projects.length > 0 && (
                    <select value={selectedProject} onChange={(e) => setSelectedProject(e.target.value)}>
                      <option value="">No project</option>
                      {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                  )}
                  <button className="btn" onClick={saveEvent}><i className="fa-solid fa-plus" /> Add event</button>
                </div>
              ) : (
                <div className="day-add-form">
                  <input placeholder="Task name" value={taskName} onChange={(e) => setTaskName(e.target.value)} />
                  <div className="form-row">
                    <select value={taskRecur} onChange={(e) => setTaskRecur(e.target.value)}>
                      <option value="none">One-time</option>
                      <option value="daily">Daily</option>
                      <option value="weekly">Weekly</option>
                      <option value="monthly">Monthly</option>
                    </select>
                    {projects.length > 0 && (
                      <select value={selectedProject} onChange={(e) => setSelectedProject(e.target.value)}>
                        <option value="">No project</option>
                        {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                      </select>
                    )}
                  </div>
                  <button className="btn" onClick={saveTask}><i className="fa-solid fa-plus" /> Add task</button>
                </div>
              )}
              </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
