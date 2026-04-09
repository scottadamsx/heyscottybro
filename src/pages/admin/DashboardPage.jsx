import { useEffect, useState } from "react";
import { loadReminders, loadJournal, loadBudgetConfig } from "../../api/plannerApi";
import { expandReminders, formatDisplayDate, toDateStr } from "../../utils/plannerUtils";

export default function DashboardPage() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState({ reminders: [], journal: [], config: { categories: [], recurringBills: [] } });

  useEffect(() => {
    Promise.all([loadReminders(), loadJournal(), loadBudgetConfig()])
      .then(([reminders, journal, config]) => {
        setData({ reminders, journal, config });
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  if (loading) return <p className="no-entries">Loading dashboard...</p>;

  const today = new Date();
  const todayStr = toDateStr(today);
  const todayReminders = expandReminders(data.reminders, todayStr, todayStr);

  const dayOffset = today.getDay();
  const startOfWeek = new Date(today);
  startOfWeek.setDate(today.getDate() - dayOffset);

  const weeks = Array.from({ length: 4 }).map((_, index) => {
    const weekStart = new Date(startOfWeek);
    weekStart.setDate(startOfWeek.getDate() + index * 7);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    const reminders = expandReminders(data.reminders, toDateStr(weekStart), toDateStr(weekEnd));
    const label = index === 0 ? "This Week" : index === 1 ? "Next Week"
      : `Week of ${weekStart.toLocaleDateString(undefined, { month: "short", day: "numeric" })}`;
    return { label, reminders };
  });

  const activeTasks = data.reminders.filter((r) => !r.completed).length;
  const lastEntry = data.journal.length ? data.journal[data.journal.length - 1] : null;

  return (
    <div className="db-grid">
      <div className="db-card col-8">
        <div className="db-card-header">
          <h3 className="db-card-title">Tasks &amp; Reminders</h3>
        </div>
        <div className="todo-sections">
          <div className="todo-section">
            <h4>Due Today</h4>
            <div className="db-list">
              {todayReminders.length === 0 && <p className="no-entries">Nothing scheduled for today.</p>}
              {todayReminders.map((r) => (
                <div className="db-list-item" key={`${r.id}-${r.date}`}>
                  <div className="db-list-item-content">
                    <div className="db-list-item-title">{r.name}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="todo-section todo-section-upcoming">
            <h4>Upcoming by Week</h4>
            <div className="weekly-scroll-container">
              {weeks.map((w) => (
                <div className="weekly-card" key={w.label}>
                  <div className="weekly-card-title">{w.label}</div>
                  {w.reminders.length === 0 && <p className="no-entries-compact">No tasks.</p>}
                  {w.reminders.map((r) => (
                    <div className="weekly-reminder-item db-list-item" key={`${r.id}-${r.date}`}>
                      <div className="db-list-item-content">
                        <div className="weekly-reminder-name">{r.name}</div>
                        <div className="db-list-item-subtitle">{formatDisplayDate(r.date)}</div>
                      </div>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="db-card col-4">
        <h3 className="db-card-title">Quick Stats</h3>
        <div className="stat-grid">
          <div className="stat-item">
            <div className="stat-label">Active Tasks</div>
            <div className="stat-value">{activeTasks}</div>
          </div>
          <div className="stat-item">
            <div className="stat-label">Categories</div>
            <div className="stat-value">{data.config?.categories?.length || 0}</div>
          </div>
        </div>
      </div>

      <div className="db-card col-6">
        <h3 className="db-card-title">Recent Journal</h3>
        {lastEntry ? (
          <div className="db-list-item journal-snippet" style={{ flexDirection: "column", alignItems: "flex-start" }}>
            <div className="db-list-item-title">{lastEntry.title}</div>
            <p className="journal-snippet-body">{lastEntry.entry?.slice(0, 150)}{lastEntry.entry?.length > 150 ? "…" : ""}</p>
            <div className="db-list-item-subtitle">{formatDisplayDate(lastEntry.date)}</div>
          </div>
        ) : (
          <p className="no-entries">No journal entries yet.</p>
        )}
      </div>

      <div className="db-card col-6">
        <h3 className="db-card-title">Budget Overview</h3>
        <p style={{ color: "var(--text-secondary)", fontSize: "0.875rem" }}>
          Tracking <strong>{data.config?.recurringBills?.length || 0}</strong> recurring bills.
        </p>
      </div>
    </div>
  );
}
