import { useEffect, useState, useCallback } from "react";
import { loadReminders, loadJournal, loadBudgetConfig, loadEvents, loadProjects, loadInitiatives, getAIBriefing } from "../../api/plannerApi";
import { expandReminders, formatDisplayDate, toDateStr } from "../../utils/plannerUtils";

export default function DashboardPage() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState({ reminders: [], journal: [], config: { categories: [], recurringBills: [] }, events: [], projects: [], initiatives: [] });
  const [aiText, setAiText] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState("");
  const [aiLoaded, setAiLoaded] = useState(false);

  useEffect(() => {
    Promise.all([
      loadReminders().catch(() => []),
      loadJournal().catch(() => []),
      loadBudgetConfig().catch(() => ({ categories: [], recurringBills: [] })),
      loadEvents().catch(() => []),
      loadProjects().catch(() => []),
      loadInitiatives().catch(() => []),
    ]).then(([reminders, journal, config, events, projects, initiatives]) => {
      setData({ reminders, journal, config, events, projects, initiatives });
      setLoading(false);
    });
  }, []);

  const fetchBriefing = useCallback(async () => {
    setAiLoading(true);
    setAiError("");
    try {
      const text = await getAIBriefing({
        reminders: data.reminders,
        events: data.events,
        projects: data.projects,
        initiatives: data.initiatives,
      });
      setAiText(text);
      setAiLoaded(true);
    } catch (e) {
      setAiError(e.message || "Failed to load briefing.");
    } finally {
      setAiLoading(false);
    }
  }, [data]);

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

  const upcomingEvents = data.events
    .filter(e => e.date >= todayStr)
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 5);

  const activeTasks = data.reminders.filter((r) => !r.completed).length;
  const lastEntry = data.journal.length ? data.journal[data.journal.length - 1] : null;

  const todayFormatted = today.toLocaleDateString("en-AU", { weekday: "long", month: "long", day: "numeric" });

  return (
    <div className="db-grid">
      {/* ── AI Briefing Card ── */}
      <div className="db-card col-12 ai-briefing-card">
        <div className="ai-briefing-header">
          <div>
            <div className="ai-briefing-date">{todayFormatted}</div>
            <h2 className="ai-briefing-title">Your Daily Briefing</h2>
          </div>
          <button
            className="btn btn-sm ai-refresh-btn"
            onClick={fetchBriefing}
            disabled={aiLoading}
          >
            {aiLoading
              ? <><i className="fa-solid fa-spinner fa-spin" /> Thinking…</>
              : aiLoaded
                ? <><i className="fa-solid fa-rotate-right" /> Refresh</>
                : <><i className="fa-solid fa-wand-magic-sparkles" /> Generate Briefing</>}
          </button>
        </div>
        {!aiLoaded && !aiLoading && !aiError && (
          <p className="ai-briefing-placeholder">
            Hit <strong>Generate Briefing</strong> to get a personalised AI summary of your day.
          </p>
        )}
        {aiLoading && (
          <div className="ai-briefing-loading">
            <div className="ai-loading-dots"><span /><span /><span /></div>
            <span>Claude is reading your schedule…</span>
          </div>
        )}
        {aiError && <p className="error-message">{aiError}</p>}
        {aiText && !aiLoading && (
          <p className="ai-briefing-text">{aiText}</p>
        )}
      </div>

      {/* ── Today's Tasks ── */}
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

      {/* ── Right Column ── */}
      <div className="db-card col-4">
        <h3 className="db-card-title">Quick Stats</h3>
        <div className="stat-grid">
          <div className="stat-item">
            <div className="stat-label">Active Tasks</div>
            <div className="stat-value">{activeTasks}</div>
          </div>
          <div className="stat-item">
            <div className="stat-label">Projects</div>
            <div className="stat-value">{data.projects.length}</div>
          </div>
          <div className="stat-item">
            <div className="stat-label">Upcoming Events</div>
            <div className="stat-value">{upcomingEvents.length}</div>
          </div>
          <div className="stat-item">
            <div className="stat-label">Categories</div>
            <div className="stat-value">{data.config?.categories?.length || 0}</div>
          </div>
        </div>
      </div>

      {/* ── Upcoming Events ── */}
      {upcomingEvents.length > 0 && (
        <div className="db-card col-6">
          <h3 className="db-card-title">Upcoming Events</h3>
          <div className="db-list" style={{ marginTop: "0.5rem" }}>
            {upcomingEvents.map(e => (
              <div className="db-list-item" key={e.id}>
                <div className="db-list-item-content">
                  <div className="db-list-item-title">{e.title}</div>
                  <div className="db-list-item-subtitle">{formatDisplayDate(e.date)}{e.description ? ` — ${e.description}` : ""}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Active Projects ── */}
      {data.projects.length > 0 && (
        <div className={`db-card ${upcomingEvents.length > 0 ? "col-6" : "col-12"}`}>
          <h3 className="db-card-title">Active Projects</h3>
          <div className="db-list" style={{ marginTop: "0.5rem" }}>
            {data.projects.map(p => (
              <div className="db-list-item" key={p.id}>
                <div style={{ display: "flex", alignItems: "center", gap: "0.625rem" }}>
                  <span style={{ width: "10px", height: "10px", borderRadius: "50%", background: p.color, flexShrink: 0 }} />
                  <div className="db-list-item-content">
                    <div className="db-list-item-title">{p.name}</div>
                    {p.description && <div className="db-list-item-subtitle">{p.description}</div>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Recent Journal ── */}
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
