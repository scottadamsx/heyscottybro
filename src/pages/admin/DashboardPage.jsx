import { useEffect, useState, useCallback } from "react";
import { loadReminders, loadJournal, loadBudgetConfig, loadEvents, loadProjects, loadInitiatives, loadTransactions, getAIBriefing } from "../../api/plannerApi";
import { expandReminders, formatDisplayDate, formatMoney, getWeekRange, toDateStr } from "../../utils/plannerUtils";
import ConnectionStatus from "../../components/ConnectionStatus";
import AccountabilitySummary from "../../components/AccountabilitySummary";

const addDaysStr = (str, n) => { const d = new Date(str + "T00:00:00"); d.setDate(d.getDate() + n); return toDateStr(d); };
const weekdayLabel = (ds) => new Date(ds + "T00:00:00").toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" });

const WEEKS_PER_MONTH = 4.33;
const ym = (s) => (s || "").slice(0, 7);
const isFunBill = (b) => /fun/i.test(b.name || "") || b.category === "Entertainment" || b.category === "Fun";
const billActiveIn = (b, mk) => ym(b.startDate) <= mk && (!b.endDate || ym(b.endDate) >= mk);

function nextDueDate(bill, today) {
  const dueDay = bill.dueDay ? Number(bill.dueDay) : null;
  if (!dueDay) return null; // continuous bill, no fixed due date
  const todayStr = toDateStr(today);
  for (let m = 0; m < 14; m++) {
    const d = new Date(today.getFullYear(), today.getMonth() + m, 1);
    const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
    const day = Math.min(dueDay, last);
    const candidate = toDateStr(new Date(d.getFullYear(), d.getMonth(), day));
    if (candidate >= todayStr && billActiveIn(bill, candidate.slice(0, 7))) return candidate;
  }
  return null;
}

export default function DashboardPage() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState({ reminders: [], journal: [], config: { categories: [], recurringBills: [], incomeSources: [] }, events: [], projects: [], initiatives: [], transactions: [] });
  const [aiText, setAiText] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState("");
  const [aiLoaded, setAiLoaded] = useState(false);
  const [showWeek, setShowWeek] = useState(false);

  useEffect(() => {
    Promise.all([
      loadReminders().catch(() => []),
      loadJournal().catch(() => []),
      loadBudgetConfig().catch(() => ({ categories: [], recurringBills: [], incomeSources: [] })),
      loadEvents().catch(() => []),
      loadProjects().catch(() => []),
      loadInitiatives().catch(() => []),
      loadTransactions().catch(() => []),
    ]).then(([reminders, journal, config, events, projects, initiatives, transactions]) => {
      setData({ reminders, journal, config, events, projects, initiatives, transactions });
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

  // ── Budget: upcoming bills + free-to-spend this week ──
  const bills = data.config?.recurringBills || [];
  const incomeSources = data.config?.incomeSources || [];
  const txns = data.transactions || [];

  const upcomingBills = bills
    .map((b) => ({ bill: b, due: nextDueDate(b, today) }))
    .filter((x) => x.due)
    .sort((a, b) => a.due.localeCompare(b.due))
    .slice(0, 6)
    .map((x) => ({ ...x, paid: txns.some((t) => t.fulfills_recurring_id === x.bill.id && ym(t.date) === ym(x.due)) }));

  const range = getWeekRange(today);
  const weekTxs = txns.filter((t) => t.date >= range.startStr && t.date <= range.endStr);
  const spentThisWeek = weekTxs.filter((t) => Number(t.amount) < 0).reduce((s, t) => s + Math.abs(Number(t.amount)), 0);
  const mk = range.startStr.slice(0, 7);
  const weeklyIncome = incomeSources
    .filter((s) => s.startDate && ym(s.startDate) <= mk && (!s.endDate || ym(s.endDate) >= mk))
    .reduce((s, src) => s + Number(src.amount || 0), 0) / WEEKS_PER_MONTH;
  let billsDueThisWeek = 0;
  for (const b of bills) {
    if (isFunBill(b)) continue;
    const dd = b.dueDay ? Number(b.dueDay) : null;
    if (!dd) continue;
    const cur = new Date(range.start);
    while (cur <= range.end) {
      if (cur.getDate() === dd) {
        const ds = toDateStr(cur);
        if (billActiveIn(b, ds.slice(0, 7)) && !txns.some((t) => t.fulfills_recurring_id === b.id && ym(t.date) === ds.slice(0, 7))) {
          billsDueThisWeek += Math.abs(Number(b.amount || 0));
        }
      }
      cur.setDate(cur.getDate() + 1);
    }
  }
  const freeThisWeek = weeklyIncome - billsDueThisWeek - spentThisWeek;

  // ── Reminders: next few + this-week grouped by day ──
  const activeReminders = data.reminders.filter((r) => !r.completed);
  const upcomingAll = expandReminders(activeReminders, todayStr, addDaysStr(todayStr, 30))
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

      {/* ── Tasks & Reminders (compact + expand) ── */}
      <div className="db-card col-8">
        <div className="db-card-header">
          <h3 className="db-card-title">Tasks &amp; Reminders</h3>
          <button className="btn btn-sm btn-secondary-sm" onClick={() => setShowWeek(true)}>
            <i className="fa-solid fa-up-right-and-down-left-from-center" /> This week
          </button>
        </div>
        <div className="db-list" style={{ marginTop: "0.4rem" }}>
          {nextFew.length === 0 && <p className="no-entries">Nothing coming up — you&apos;re clear 🎉</p>}
          {nextFew.map((r) => (
            <div className="db-list-item" key={`${r.id}-${r.date}`}>
              <div className="db-list-item-content">
                <div className="db-list-item-title">{r.name}</div>
                <div className="db-list-item-subtitle">{r.date === todayStr ? "Today" : formatDisplayDate(r.date)}</div>
              </div>
            </div>
          ))}
        </div>
        {upcomingAll.length > 4 && (
          <button className="dashboard-expand" onClick={() => setShowWeek(true)}>
            +{upcomingAll.length - 4} more · view the week
          </button>
        )}
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

      {/* ── Free to spend this week ── */}
      <div className="db-card col-6">
        <h3 className="db-card-title">Free to spend this week</h3>
        <div style={{ fontSize: "2.1rem", fontWeight: 800, marginTop: "0.25rem", color: freeThisWeek >= 0 ? "var(--green)" : "var(--red)" }}>
          {formatMoney(freeThisWeek)}
        </div>
        <div className="stat-grid" style={{ marginTop: "0.75rem" }}>
          <div className="stat-item"><div className="stat-label">Weekly income</div><div style={{ fontWeight: 700, marginTop: "0.2rem" }}>{formatMoney(weeklyIncome)}</div></div>
          <div className="stat-item"><div className="stat-label">Bills due</div><div style={{ fontWeight: 700, marginTop: "0.2rem" }}>{formatMoney(billsDueThisWeek)}</div></div>
          <div className="stat-item"><div className="stat-label">Spent so far</div><div style={{ fontWeight: 700, marginTop: "0.2rem" }}>{formatMoney(spentThisWeek)}</div></div>
          <div className="stat-item"><div className="stat-label">Week of</div><div style={{ fontWeight: 700, marginTop: "0.2rem", fontSize: "0.9rem" }}>{formatDisplayDate(range.startStr)}</div></div>
        </div>
      </div>

      {/* ── Upcoming bills ── */}
      <div className="db-card col-6">
        <h3 className="db-card-title">Upcoming bills</h3>
        {upcomingBills.length === 0 && <p className="no-entries">No scheduled bills with a due date. Add a due day to a bill in Budget.</p>}
        <div className="db-list" style={{ marginTop: "0.5rem" }}>
          {upcomingBills.map(({ bill, due, paid }) => (
            <div className="db-list-item" key={bill.id}>
              <div className="db-list-item-content">
                <div className="db-list-item-title">{bill.name}</div>
                <div className="db-list-item-subtitle">{formatDisplayDate(due)}{paid ? " · paid this month" : ""}</div>
              </div>
              <div style={{ fontWeight: 700, color: paid ? "var(--text-muted)" : "var(--text-primary)", textDecoration: paid ? "line-through" : "none" }}>
                {formatMoney(Math.abs(Number(bill.amount || 0)))}
              </div>
            </div>
          ))}
        </div>
      </div>

      <AccountabilitySummary />

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
                    <div className="day-item" key={`${r.id}-${r.date}`}>
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
    </div>
  );
}
