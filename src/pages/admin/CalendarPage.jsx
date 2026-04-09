import { useEffect, useMemo, useState } from "react";
import { loadReminders, loadEvents, loadTransactions, newEvent, deleteEvent, loadProjects, loadEventTypes, newReminder } from "../../api/plannerApi";
import { expandReminders, toDateStr } from "../../utils/plannerUtils";

function monthLabel(year, month) {
  return new Date(year, month, 1).toLocaleDateString(undefined, { month: "long", year: "numeric" });
}

export default function CalendarPage() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [reminders, setReminders] = useState([]);
  const [events, setEvents] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [projects, setProjects] = useState([]);
  const [eventTypes, setEventTypes] = useState([]);

  const [selectedDate, setSelectedDate] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [selectedProject, setSelectedProject] = useState("");
  const [selectedEventType, setSelectedEventType] = useState("");
  const [dayEvents, setDayEvents] = useState([]); // events on selected date

  const load = async () => {
    const [r, e, t, p, et] = await Promise.all([
      loadReminders(), loadEvents(), loadTransactions(), loadProjects(), loadEventTypes()
    ]);
    setReminders(r);
    setEvents(e);
    setTransactions(t);
    setProjects(p);
    setEventTypes(et);
  };

  useEffect(() => { load(); }, []);

  const itemsByDate = useMemo(() => {
    const first = new Date(year, month, 1);
    const last = new Date(year, month + 1, 0);
    const expanded = expandReminders(reminders, toDateStr(first), toDateStr(last));
    const map = {};
    expanded.forEach((item) => {
      map[item.date] = map[item.date] || [];
      map[item.date].push({ kind: "reminder", label: item.name });
    });
    events.forEach((item) => {
      map[item.date] = map[item.date] || [];
      map[item.date].push({ kind: "event", label: item.title });
    });
    transactions.filter((t) => t.type === "future").forEach((item) => {
      map[item.date] = map[item.date] || [];
      map[item.date].push({ kind: "future", label: item.description });
    });
    return map;
  }, [year, month, reminders, events, transactions]);

  const firstDayIndex = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < firstDayIndex; i++) cells.push(null);
  for (let day = 1; day <= daysInMonth; day++) cells.push(day);

  const prevMonth = () => month === 0 ? (setMonth(11), setYear(year - 1)) : setMonth(month - 1);
  const nextMonth = () => month === 11 ? (setMonth(0), setYear(year + 1)) : setMonth(month + 1);

  const openDay = (date) => {
    setSelectedDate(date);
    setTitle("");
    setDescription("");
    setSelectedProject("");
    setSelectedEventType("");
    setDayEvents(events.filter(e => e.date === date));
  };

  const saveEvent = async () => {
    if (!selectedDate || !title.trim()) return;
    await newEvent({
      title: title.trim(),
      description: description.trim(),
      date: selectedDate,
      project_id: selectedProject || null,
      event_type_id: selectedEventType || null,
    });

    // Auto-create tasks based on event type template
    if (selectedEventType) {
      const et = eventTypes.find(x => x.id === selectedEventType);
      if (et?.auto_tasks?.length) {
        const eventDate = new Date(selectedDate + "T00:00:00");
        for (const task of et.auto_tasks) {
          const taskDate = new Date(eventDate);
          taskDate.setDate(eventDate.getDate() + Number(task.offset_days));
          const taskDateStr = toDateStr(taskDate);
          await newReminder({
            name: `${task.name} — ${title.trim()}`,
            date: taskDateStr,
            recurrence: "none",
            project_id: selectedProject || null,
          });
        }
      }
    }

    setSelectedDate("");
    await load();
  };

  return (
    <div className="module-page">
      <div className="module-header">
        <h1>Calendar</h1>
        <div style={{ display: "flex", gap: "0.5rem" }}>
          <button className="btn-sm btn-secondary-sm btn" onClick={prevMonth}>← Prev</button>
          <button className="btn-sm btn-secondary-sm btn" onClick={nextMonth}>Next →</button>
        </div>
      </div>

      <div className="db-card">
        <h3 className="db-card-title" style={{ marginBottom: "1rem" }}>{monthLabel(year, month)}</h3>
        <div className="calendar-grid-react">
          {["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].map((name) => (
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
                {(itemsByDate[date] || []).slice(0, 3).map((item, idx) => (
                  <span key={idx} className={`calendar-item ${item.kind}-item`}>{item.label}</span>
                ))}
              </button>
            );
          })}
        </div>
      </div>

      {selectedDate && (
        <div className="event-overlay" onClick={(e) => { if (e.target.className === "event-overlay") setSelectedDate(""); }}>
          <div className="event-card">
            <h3>
              {new Date(selectedDate + "T00:00:00").toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}
            </h3>

            {/* Existing events on this day */}
            {dayEvents.length > 0 && (
              <div style={{ marginBottom: "0.5rem" }}>
                {dayEvents.map(e => (
                  <div key={e.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0.375rem 0.5rem", background: "var(--bg-raised)", borderRadius: "6px", marginBottom: "4px", fontSize: "0.82rem" }}>
                    <span>{e.title}{e.description ? ` — ${e.description}` : ""}</span>
                    <button className="btn-sm btn-delete" style={{ padding: "1px 6px" }} onClick={() => deleteEvent(e.id).then(load).then(() => setDayEvents(prev => prev.filter(x => x.id !== e.id)))}>✕</button>
                  </div>
                ))}
              </div>
            )}

            <input placeholder="New event title" value={title} onChange={(e) => setTitle(e.target.value)} />
            <textarea placeholder="Description (optional)" value={description} onChange={(e) => setDescription(e.target.value)} />

            {eventTypes.length > 0 && (
              <select value={selectedEventType} onChange={e => setSelectedEventType(e.target.value)}>
                <option value="">No event type</option>
                {eventTypes.map(et => (
                  <option key={et.id} value={et.id}>{et.name}</option>
                ))}
              </select>
            )}

            {selectedEventType && (() => {
              const et = eventTypes.find(x => x.id === selectedEventType);
              return et?.auto_tasks?.length ? (
                <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", background: "var(--bg-raised)", borderRadius: "6px", padding: "0.5rem" }}>
                  <strong style={{ color: "var(--accent-light)" }}>Auto-tasks that will be created:</strong>
                  {et.auto_tasks.map((t, i) => (
                    <div key={i}>· {t.name} ({t.offset_days < 0 ? `${Math.abs(t.offset_days)}d before` : t.offset_days === 0 ? "day of" : `${t.offset_days}d after`})</div>
                  ))}
                </div>
              ) : null;
            })()}

            {projects.length > 0 && (
              <select value={selectedProject} onChange={e => setSelectedProject(e.target.value)}>
                <option value="">No project</option>
                {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            )}

            <div className="budget-widget-actions">
              <button className="btn" onClick={saveEvent}>Save</button>
              <button className="btn" style={{ background: "var(--bg-raised)", color: "var(--text-secondary)" }} onClick={() => setSelectedDate("")}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
