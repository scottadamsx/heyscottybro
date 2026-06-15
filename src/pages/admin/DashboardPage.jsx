import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { loadReminders, loadJournal, loadBudgetConfig, loadEvents, loadProjects, loadInitiatives, loadTransactions, getAIBriefing, loadAgentActions } from "../../api/plannerApi";
import { expandReminders, remindersForDay, formatDisplayDate, formatMoney, getWeekRange, toDateStr } from "../../utils/plannerUtils";
import { describeAction, actionTime } from "../../utils/agentActions";
import { apiToPage, uiShape, computeBudgetSnapshot, getUpcomingBills } from "../../components/budget/budgetSummary";
import ConnectionStatus from "../../components/ConnectionStatus";
import AccountabilitySummary from "../../components/AccountabilitySummary";
import StorageUsage from "../../components/StorageUsage";
import { Stagger, Item } from "../../components/motion/Stagger";

const addDaysStr = (str, n) => { const d = new Date(str + "T00:00:00"); d.setDate(d.getDate() + n); return toDateStr(d); };
const weekdayLabel = (ds) => new Date(ds + "T00:00:00").toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" });

// Agent action one-liners + timestamp helpers now live in utils/agentActions
// (shared with the Command Center).

export default function DashboardPage() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState({ reminders: [], journal: [], config: { categories: [], recurringBills: [], incomeSources: [] }, events: [], projects: [], initiatives: [], transactions: [] });
  const [agentActions, setAgentActions] = useState([]);
  const [aiText, setAiText] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState("");
  const [aiLoaded, setAiLoaded] = useState(false);
  const [showWeek, setShowWeek] = useState(false);
  const navigate = useNavigate();
  // Clicking a task opens its dedicated detail page (no inline modal).
  const openTask = (id) => navigate(`/admin/tasks/${id}`);

  useEffect(() => {
    Promise.all([
      loadReminders().catch(() => []),
      loadJournal().catch(() => []),
      loadBudgetConfig().catch(() => ({ categories: [], recurringBills: [], incomeSources: [] })),
      loadEvents().catch(() => []),
      loadProjects().catch(() => []),
      loadInitiatives().catch(() => []),
      loadTransactions().catch(() => []),
      loadAgentActions(10).catch(() => []),
    ]).then(([reminders, journal, config, events, projects, initiatives, transactions, actions]) => {
      setData({ reminders, journal, config, events, projects, initiatives, transactions });
      setAgentActions(actions);
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

  const upcomingEvents = data.events
    .filter(e => e.date >= todayStr)
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 5);

  const activeTasks = data.reminders.filter((r) => !r.completed).length;
  const lastEntry = data.journal.length ? data.journal[data.journal.length - 1] : null;

  const todayFormatted = today.toLocaleDateString("en-AU", { weekday: "long", month: "long", day: "numeric" });

  // ── Budget: derived from the SAME snapshot the Budget page uses, so the
  // "free to spend this week" figure and bills always match across screens. ──
  const budgetConfig = apiToPage(data.config || {});
  const budgetTx = (data.transactions || []).map(uiShape);
  const budget = computeBudgetSnapshot(budgetConfig, budgetTx, todayStr);
  const currentWeek = budget.currentWeek;
  const upcomingBills = getUpcomingBills(budgetConfig, budgetTx, todayStr, 6);

  // ── Reminders: today + upcoming + this-week grouped by day ──
  const activeReminders = data.reminders.filter((r) => !r.completed);
  // Today is its own list (every same-day occurrence, deduped) so the count
  // always matches the full reminders list. The old code lumped today into a
  // 30-day window and sliced to 4, which silently dropped same-day items once
  // more than four things were coming up.
  const todayItems = remindersForDay(activeReminders, todayStr);
  // Upcoming = the next 30 days *after* today, capped for the compact card.
  const upcomingAll = expandReminders(activeReminders, addDaysStr(todayStr, 1), addDaysStr(todayStr, 30))
    .sort((a, b) => a.date.localeCompare(b.date));
  const nextFew = upcomingAll.slice(0, 4);
  const wr = getWeekRange(today);
  const weekItems = expandReminders(activeReminders, wr.startStr, wr.endStr);
  const weekByDay = [];
  for (let i = 0; i < 7; i++) {
    const ds = addDaysStr(wr.startStr, i);
    weekByDay.push({ ds, items: weekItems.filter((r) => r.date === ds) });
  }

  return (
    <Stagger className="db-grid">
      {/* ── AI Briefing Card ── */}
      <Item className="db-card col-12 ai-briefing-card">
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
      </Item>

      {/* ── Tasks & Reminders (compact + expand) ── */}
      <Item className="db-card col-8">
        <div className="db-card-header">
          <h3 className="db-card-title">Tasks &amp; Reminders</h3>
          <button className="btn btn-sm btn-secondary-sm" onClick={() => setShowWeek(true)}>
            <i className="fa-solid fa-up-right-and-down-left-from-center" /> This week
          </button>
        </div>

        {/* Today — every same-day reminder, so the count matches the full list */}
        <div className="db-subhead">
          <span>Today</span>
          <span className="db-count">{todayItems.length}</span>
        </div>
        <div className="db-list">
          {todayItems.length === 0 && <p className="no-entries">Nothing due today.</p>}
          {todayItems.map((r) => (
            <div
              className="db-list-item db-list-item--clickable"
              key={`${r.id}-${r.date}`}
              role="button"
              tabIndex={0}
              onClick={() => openTask(r.id)}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openTask(r.id); } }}
            >
              <div className="db-list-item-content">
                <div className="db-list-item-title">{r.name}</div>
                <div className="db-list-item-subtitle">{r.time ? r.time : "Today"}</div>
              </div>
              <i className="fa-solid fa-chevron-right db-list-item-chevron" />
            </div>
          ))}
        </div>

        {/* Upcoming — next 30 days after today */}
        {nextFew.length > 0 && (
          <>
            <div className="db-subhead">
              <span>Upcoming</span>
            </div>
            <div className="db-list">
              {nextFew.map((r) => (
                <div
                  className="db-list-item db-list-item--clickable"
                  key={`${r.id}-${r.date}`}
                  role="button"
                  tabIndex={0}
                  onClick={() => openTask(r.id)}
                  onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openTask(r.id); } }}
                >
                  <div className="db-list-item-content">
                    <div className="db-list-item-title">{r.name}</div>
                    <div className="db-list-item-subtitle">{formatDisplayDate(r.date)}</div>
                  </div>
                  <i className="fa-solid fa-chevron-right db-list-item-chevron" />
                </div>
              ))}
            </div>
          </>
        )}

        {todayItems.length === 0 && nextFew.length === 0 && (
          <p className="no-entries" style={{ marginTop: "0.4rem" }}>Nothing coming up — you&apos;re clear 🎉</p>
        )}
        {upcomingAll.length > 4 && (
          <button className="dashboard-expand" onClick={() => setShowWeek(true)}>
            +{upcomingAll.length - 4} more · view the week
          </button>
        )}
      </Item>

      {/* ── Right Column ── */}
      <Item className="db-card col-4">
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
      </Item>

      {/* ── Upcoming Events ── */}
      {upcomingEvents.length > 0 && (
        <Item className="db-card col-6">
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
        </Item>
      )}

      {/* ── Active Projects ── */}
      {data.projects.length > 0 && (
        <Item className={`db-card ${upcomingEvents.length > 0 ? "col-6" : "col-12"}`}>
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
        </Item>
      )}

      {/* ── Recent Journal ── */}
      <Item className="db-card col-6">
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
      </Item>

      {/* ── Free to spend this week (same figure as Budget → Dashboard) ── */}
      <Item className="db-card col-6">
        <h3 className="db-card-title">Free to spend this week</h3>
        {currentWeek ? (
          <>
            <div style={{ fontSize: "2.1rem", fontWeight: 800, marginTop: "0.25rem", color: currentWeek.remaining >= 0 ? "var(--green)" : "var(--red)" }}>
              {formatMoney(currentWeek.remaining)}
            </div>
            <div className="stat-grid" style={{ marginTop: "0.75rem" }}>
              <div className="stat-item"><div className="stat-label">Allowance</div><div style={{ fontWeight: 700, marginTop: "0.2rem" }}>{formatMoney(currentWeek.allowance)}</div></div>
              <div className="stat-item"><div className="stat-label">Spent so far</div><div style={{ fontWeight: 700, marginTop: "0.2rem" }}>{formatMoney(currentWeek.spent)}</div></div>
              <div className="stat-item"><div className="stat-label">Rolled over</div><div style={{ fontWeight: 700, marginTop: "0.2rem" }}>{formatMoney(currentWeek.carryIn)}</div></div>
              <div className="stat-item"><div className="stat-label">Week of</div><div style={{ fontWeight: 700, marginTop: "0.2rem", fontSize: "0.9rem" }}>{formatDisplayDate(currentWeek.start)}</div></div>
            </div>
          </>
        ) : (
          <p className="no-entries">Add an income source in Budget → Bills &amp; Income to see your weekly spending allowance.</p>
        )}
      </Item>

      {/* ── Upcoming bills (same scheduling model as the Budget page) ── */}
      <Item className="db-card col-6">
        <h3 className="db-card-title">Upcoming bills</h3>
        {upcomingBills.length === 0 && <p className="no-entries">No upcoming bills. Add recurring bills in Budget → Bills &amp; Income.</p>}
        <div className="db-list" style={{ marginTop: "0.5rem" }}>
          {upcomingBills.map((b) => (
            <div className="db-list-item" key={`${b.id}-${b.due}`}>
              <div className="db-list-item-content">
                <div className="db-list-item-title">{b.name}</div>
                <div className="db-list-item-subtitle">{formatDisplayDate(b.due)}{b.paid ? " · paid" : b.autoPay ? " · auto-pay" : ""}</div>
              </div>
              <div style={{ fontWeight: 700, color: b.paid ? "var(--text-muted)" : "var(--text-primary)", textDecoration: b.paid ? "line-through" : "none" }}>
                {formatMoney(b.amount)}
              </div>
            </div>
          ))}
        </div>
      </Item>

      {/* ── Frodo Activity ── */}
      {agentActions.length > 0 && (
        <Item className="db-card col-6">
          <h3 className="db-card-title">Frodo&apos;s recent actions</h3>
          <div className="db-list" style={{ marginTop: "0.5rem" }}>
            {agentActions.map((a) => {
              const tool = a.collection ? `${a.tool} → ${a.collection}` : a.tool;
              const isErr = a.status === "error";
              return (
                <div className="db-list-item" key={a.id} style={{ flexDirection: "column", alignItems: "stretch", gap: 4, borderLeft: isErr ? "2px solid var(--danger,var(--red))" : undefined, paddingLeft: isErr ? "0.5rem" : undefined }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div className="db-list-item-title" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{describeAction(a)}</div>
                      <div style={{ fontFamily: "monospace", fontSize: "0.72rem", color: "var(--text-muted)" }}>{tool}</div>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 2, flexShrink: 0 }}>
                      <span style={{ fontSize: "0.7rem", color: "var(--text-muted)", whiteSpace: "nowrap" }} title={new Date(a.created_at).toLocaleString()}>{actionTime(a.created_at)}</span>
                      <span style={{ fontSize: "0.68rem", padding: "1px 6px", borderRadius: "100px", background: isErr ? "rgba(239,68,68,0.15)" : "rgba(74,222,128,0.12)", color: isErr ? "var(--danger,var(--red))" : "var(--accent)" }}>{a.tier}</span>
                    </div>
                  </div>
                  {a.error && (
                    <div title={a.error} style={{ color: "var(--danger,var(--red))", fontSize: "0.72rem", background: "rgba(239,68,68,0.07)", borderRadius: 4, padding: "3px 6px", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden", wordBreak: "break-word" }}>
                      {a.error}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </Item>
      )}

      <AccountabilitySummary />

      <StorageUsage />

      <ConnectionStatus />

      {/* This-week reminders modal, grouped by day */}
      {showWeek && (
        <div className="event-overlay" onClick={(e) => { if (e.target.classList.contains("event-overlay")) setShowWeek(false); }}>
          <div className="day-modal">
            <div className="day-modal-head">
              <div className="day-modal-titles" style={{ textAlign: "left" }}>
                <div className="day-modal-dow">This week</div>
                <div className="day-modal-date">{formatDisplayDate(wr.startStr).split(",")[0]} – {formatDisplayDate(wr.endStr).split(",")[0]}</div>
              </div>
              <button className="icon-x" onClick={() => setShowWeek(false)} aria-label="Close"><i className="fa-solid fa-xmark" /></button>
            </div>
            <div className="day-modal-body">
              {weekByDay.map((d) => (
                <div className="day-section" key={d.ds}>
                  <div className="day-section-head">
                    <span>{weekdayLabel(d.ds)}{d.ds === todayStr ? " · Today" : ""}</span>
                    <span className="day-count">{d.items.length}</span>
                  </div>
                  {d.items.length === 0 && <p className="day-empty">—</p>}
                  {d.items.map((r) => (
                    <div
                      className="day-item day-item--clickable"
                      key={`${r.id}-${r.date}`}
                      role="button"
                      tabIndex={0}
                      onClick={() => { setShowWeek(false); openTask(r.id); }}
                      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setShowWeek(false); openTask(r.id); } }}
                    >
                      <span className="day-item-dot" style={{ background: "var(--accent)" }} />
                      <div className="day-item-body"><div className="day-item-title">{r.name}</div></div>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </Stagger>
  );
}
