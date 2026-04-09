import { useEffect, useMemo, useState } from "react";
import { loadReminders, loadEvents, loadTransactions, newEvent } from "../../api/plannerApi";
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
  const [selectedDate, setSelectedDate] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");

  const load = async () => {
    const [r, e, t] = await Promise.all([loadReminders(), loadEvents(), loadTransactions()]);
    setReminders(r);
    setEvents(e);
    setTransactions(t);
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

  const saveEvent = async () => {
    if (!selectedDate || !title.trim()) return;
    await newEvent({ title: title.trim(), description: description.trim(), date: selectedDate });
    setSelectedDate("");
    setTitle("");
    setDescription("");
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
                onClick={() => setSelectedDate(date)}
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
            <h3>Add Event — {selectedDate}</h3>
            <input placeholder="Event title" value={title} onChange={(e) => setTitle(e.target.value)} />
            <textarea placeholder="Description (optional)" value={description} onChange={(e) => setDescription(e.target.value)} />
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
