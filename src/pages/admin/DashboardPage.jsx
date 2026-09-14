import { useEffect, useState, useCallback } from "react";
import { useNavigate, Link } from "react-router-dom";
import { loadReminders, loadJournal, loadBudgetConfig, loadEvents, loadProjects, loadInitiatives, loadTransactions, getAIBriefing, loadAgentActions } from "../../api/plannerApi";
import { expandReminders, remindersForDay, undatedReminders, formatDisplayDate, formatMoney, getWeekRange, toDateStr, formatTime12 } from "../../utils/plannerUtils";
import { describeAction, actionTime } from "../../utils/agentActions";
import { apiToPage, uiShape, computeBudgetSnapshot, getUpcomingBills } from "../../components/budget/budgetSummary";
import { loadCourses } from "../../api/coursesApi";
import { loadGrades, gradeStats } from "../../api/gradesApi";
import { loadBugs } from "../../api/bugsApi";
import { loadMessages } from "../../api/messagesApi";
import { buildBrief } from "../../lib/brief";
import { ExportKit } from "../../components/ui";
import LineChart from "../../components/ui/LineChart";
import ConnectionStatus from "../../components/ConnectionStatus";
import AccountabilitySummary from "../../components/AccountabilitySummary";
import StorageUsage from "../../components/StorageUsage";
import { Stagger, Item } from "../../components/motion/Stagger";
import "./today.css";

const addDaysStr = (str, n) => { const d = new Date(str + "T00:00:00"); d.setDate(d.getDate() + n); return toDateStr(d); };
const asDate = (ds) => new Date(ds + "T00:00:00");
const weekdayLabel = (ds) => asDate(ds).toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" });
const shortDow = (ds) => asDate(ds).toLocaleDateString(undefined, { weekday: "short" });
const shortDate = (ds) => asDate(ds).toLocaleDateString(undefined, { month: "short", day: "numeric" });
// Money sums in integer cents (QF-4), displayed in dollars.
const cents = (n) => Math.round((Number(n) || 0) * 100);
const compactMoney = (v) => (v >= 1000 ? `$${(v / 1000).toFixed(v >= 10000 ? 0 : 1)}k` : `$${Math.round(v)}`);

/** Enter/Space activate a div[role=button] the same way a click does. */
const onActivate = (fn) => (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); fn(); } };

export default function DashboardPage() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState({ reminders: [], journal: [], config: { categories: [], recurringBills: [], incomeSources: [] }, events: [], projects: [], initiatives: [], transactions: [] });
  const [agentActions, setAgentActions] = useState([]);
  const [allActions, setAllActions] = useState(false);
  const ACTIONS_SHOWN = 6;
  const [school, setSchool] = useState({ courses: [], grades: [] });
  const [pulse, setPulse] = useState({ openBugs: null, unreadInbox: null });
  const [aiText, setAiText] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState("");
  const [showWeek, setShowWeek] = useState(false);
  const [range, setRange] = useState(7);
  const navigate = useNavigate();
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
      loadAgentActions(50).catch(() => []),
      loadCourses().catch(() => []),
      loadGrades().catch(() => []),
      loadBugs().catch(() => []),
      loadMessages().catch(() => []),
    ]).then(([reminders, journal, config, events, projects, initiatives, transactions, actions, courses, grades, bugs, messages]) => {
      setData({ reminders, journal, config, events, projects, initiatives, transactions });
      setAgentActions(actions);
      setSchool({ courses, grades });
      setPulse({
        openBugs: bugs.filter((b) => ["open", "in_progress"].includes(b.status)).length,
        unreadInbox: messages.filter((m) => !m.read && m.status !== "archived").length,
      });
      setLoading(false);
    });
  }, []);

  const fetchBriefing = useCallback(async () => {
    setAiLoading(true);
    setAiError("");
    try {
      setAiText(await getAIBriefing({ reminders: data.reminders, events: data.events, projects: data.projects, initiatives: data.initiatives }));
    } catch (e) {
      setAiError(e.message || "Couldn't get the AI take.");
    } finally {
      setAiLoading(false);
    }
  }, [data]);

  if (loading) return <div className="module-page"><p className="no-entries">Loading today…</p></div>;

  const today = new Date();
  const todayStr = toDateStr(today);
  const todayLong = today.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" });

  // ── Money: the SAME snapshot the Money page uses, so figures always match ──
  const budgetConfig = apiToPage(data.config || {});
  const budgetTx = (data.transactions || []).map(uiShape);
  const budget = computeBudgetSnapshot(budgetConfig, budgetTx, todayStr);
  const currentWeek = budget.currentWeek;
  const upcomingBills = getUpcomingBills(budgetConfig, budgetTx, todayStr, 6);

  // Spending = expenses that aren't bill payments (the weekly-allowance rule).
  const spendCents = (ds) => budgetTx
    .filter((t) => t.type === "expense" && t.date === ds && !t.is_bill && !t.fulfills_recurring_id)
    .reduce((s, t) => s + cents(t.amount), 0);
  const series = Array.from({ length: range }, (_, i) => {
    const ds = addDaysStr(todayStr, i - (range - 1));
    const every = range <= 7 ? 1 : 5;
    const fromEnd = range - 1 - i;
    return { key: ds, label: fromEnd % every === 0 ? (range <= 7 ? shortDow(ds) : shortDate(ds)) : "", title: weekdayLabel(ds), value: spendCents(ds) / 100 };
  });
  const last7 = Array.from({ length: 7 }, (_, i) => spendCents(addDaysStr(todayStr, -i))).reduce((a, b) => a + b, 0);
  const prev7 = Array.from({ length: 7 }, (_, i) => spendCents(addDaysStr(todayStr, -7 - i))).reduce((a, b) => a + b, 0);
  const spendDelta = prev7 > 0 ? Math.round(((last7 - prev7) / prev7) * 100) : null;
  const rangeTotal = series.reduce((s, p) => s + cents(p.value), 0) / 100;

  // ── Tasks + events ──
  const activeReminders = data.reminders.filter((r) => !r.completed);
  const todayItems = remindersForDay(activeReminders, todayStr);
  const overdue = activeReminders.filter((r) => r.date && r.date < todayStr && (r.recurrence || "none") === "none");
  const upcomingAll = expandReminders(activeReminders, addDaysStr(todayStr, 1), addDaysStr(todayStr, 30)).sort((a, b) => a.date.localeCompare(b.date));
  const anytimeItems = undatedReminders(activeReminders);
  const weekEnd = addDaysStr(todayStr, 6);
  const eventsThisWeek = data.events.filter((e) => (e.end_date || e.date) >= todayStr && e.date <= weekEnd);
  const wr = getWeekRange(today);
  const weekItems = expandReminders(activeReminders, wr.startStr, wr.endStr);
  const weekByDay = Array.from({ length: 7 }, (_, i) => { const ds = addDaysStr(wr.startStr, i); return { ds, items: weekItems.filter((r) => r.date === ds) }; });

  const courseById = Object.fromEntries(school.courses.map((c) => [c.id, c]));
  const projectById = Object.fromEntries(data.projects.map((p) => [p.id, p]));
  const upNext = [
    ...todayItems.map((r) => ({ kind: r.course_id ? "school" : "task", id: `t-${r.id}-${r.date}`, title: r.name, date: todayStr, time: r.time, sub: courseById[r.course_id]?.name || projectById[r.project_id]?.name || "Task", go: () => openTask(r.id) })),
    ...eventsThisWeek.map((e) => ({ kind: "event", id: `e-${e.id}`, title: e.title, date: e.date < todayStr ? todayStr : e.date, time: e.start_time, sub: "Event", go: () => navigate(`/admin/planner?date=${e.date}`) })),
    ...upcomingAll.slice(0, 8).map((r) => ({ kind: r.course_id ? "school" : "task", id: `u-${r.id}-${r.date}`, title: r.name, date: r.date, time: r.time, sub: courseById[r.course_id]?.name || projectById[r.project_id]?.name || "Task", go: () => openTask(r.id) })),
  ].sort((a, b) => a.date.localeCompare(b.date) || String(a.time || "99").localeCompare(String(b.time || "99"))).slice(0, 5);
  const whenLabel = (it) => {
    const day = it.date === todayStr ? "Today" : it.date === addDaysStr(todayStr, 1) ? "Tomorrow" : shortDow(it.date);
    return it.time ? `${day} · ${formatTime12(it.time)}` : day;
  };

  // ── Spaces panel ──
  const nextDeadline = activeReminders.filter((r) => r.course_id && r.date && r.date >= todayStr).sort((a, b) => a.date.localeCompare(b.date))[0];
  const openDeadlines = activeReminders.filter((r) => r.course_id && r.date && r.date >= todayStr && r.date <= addDaysStr(todayStr, 13)).length;
  const journalThisWeek = data.journal.filter((j) => j.date >= wr.startStr && j.date <= wr.endStr).length;
  const lastEntry = data.journal.length ? data.journal[data.journal.length - 1] : null;

  // ── Morning Brief (data-first; exportable) ──
  const courseStats = Object.fromEntries(school.courses.map((c) => [c.id,
    gradeStats(school.grades.filter((g) => g.course_id === c.id || (g.course && g.course === c.code)))]));
  const schoolDeadlines = data.reminders.filter((r) => r.course_id && !r.completed && r.date).sort((a, b) => a.date.localeCompare(b.date));
  const brief = buildBrief({
    reminders: data.reminders, events: data.events, budget, upcomingBills,
    courses: school.courses, courseStats, deadlines: schoolDeadlines,
    agentActions, openBugs: pulse.openBugs, unreadInbox: pulse.unreadInbox,
  });
  const briefExporter = { title: `Morning Brief — ${brief.date}`, filename: "morning-brief", toMarkdown: () => brief.toMarkdown(aiText) };

  const remaining = currentWeek?.remaining ?? null;

  return (
    <Stagger className="today">
      {/* ── Header ── */}
      <Item className="module-header today-head">
        <div>
          <h1>Today</h1>
          <p className="today-date">{todayLong}</p>
        </div>
        <div className="header-actions">
          <button type="button" className="btn btn-sm btn-secondary-sm" onClick={() => setShowWeek(true)}>
            <i className="fa-regular fa-calendar" aria-hidden="true" /> This week
          </button>
          <ExportKit exporter={briefExporter} />
        </div>
      </Item>

      {/* ── Row 1: key numbers · Frodo's take ── */}
      <div className="today-row">
        <Item className="today-kpis" aria-label="Key numbers">
          <Link to="/admin/reminders" className="kpi">
            <span className="kpi-head">
              <span className="kpi-label">Due today</span>
              {overdue.length > 0 && <span className="kpi-flag tone-bad" title={`${overdue.length} overdue`}><i className="fa-solid fa-exclamation" aria-hidden="true" /><span className="visually-hidden">{overdue.length} overdue</span></span>}
            </span>
            <span className="kpi-value">{todayItems.length}</span>
            <span className="kpi-sub">{overdue.length ? `${overdue.length} overdue` : `${anytimeItems.length} anytime`}</span>
          </Link>
          <Link to="/admin/finance" className="kpi">
            <span className="kpi-head"><span className="kpi-label">Free to spend</span></span>
            <span className={`kpi-value${remaining !== null && remaining < 0 ? " is-neg" : ""}`}>{remaining === null ? "—" : `${remaining < 0 ? "−" : ""}${formatMoney(remaining)}`}</span>
            <span className="kpi-sub">{currentWeek ? `of ${formatMoney(currentWeek.allowance)} this week` : "Add income to see it"}</span>
          </Link>
          <Link to="/admin/finance?tab=transactions" className="kpi">
            <span className="kpi-head">
              <span className="kpi-label">Spent · 7 days</span>
              {spendDelta !== null && spendDelta !== 0 && (
                <span className={`kpi-flag ${spendDelta > 0 ? "tone-bad" : "tone-good"}`}>
                  <i className={`fa-solid ${spendDelta > 0 ? "fa-arrow-up" : "fa-arrow-down"}`} aria-hidden="true" />
                  <span className="visually-hidden">{spendDelta > 0 ? "Up" : "Down"} {Math.abs(spendDelta)}% on the previous 7 days</span>
                </span>
              )}
            </span>
            <span className="kpi-value">{formatMoney(last7 / 100)}</span>
            <span className="kpi-sub">{spendDelta === null ? "No spending the week before" : `${Math.abs(spendDelta)}% ${spendDelta > 0 ? "more" : "less"} than last week`}</span>
          </Link>
        </Item>

        <Item className="take panel-peach" aria-live="polite">
          <div className="take-body">
            <span className="take-avatar" aria-hidden="true"><i className="fa-solid fa-wand-magic-sparkles" /></span>
            <h2 className="take-title"><span className="take-accent">Frodo&apos;s</span> take</h2>
            {aiError ? <p className="take-text is-error" role="alert">{aiError}</p>
              : aiText ? <p className="take-text is-answer">{aiText}</p>
              : <p className="take-text">Two lines on today, read from everything below.</p>}
          </div>
          <div className="take-art" aria-hidden="true"><i /><i /><i /><i /></div>
          <button type="button" className="take-go" onClick={fetchBriefing} disabled={aiLoading} aria-label={aiText ? "Refresh Frodo's take" : "Get Frodo's take on today"}>
            {aiLoading ? <i className="fa-solid fa-spinner fa-spin" aria-hidden="true" /> : aiText ? "Again" : "Ask"}
          </button>
        </Item>
      </div>

      {/* ── Row 2: spending activity · up next ── */}
      <div className="today-row">
        <Item className="today-section activity">
          <div className="section-head">
            <h2 className="section-title">Spending</h2>
            <span className="section-meta">{formatMoney(rangeTotal)} in {range} days · excludes bills</span>
            <div className="segmented" role="radiogroup" aria-label="Range">
              {[7, 30].map((n) => (
                <button key={n} type="button" role="radio" aria-checked={range === n} className={`segmented-opt${range === n ? " active" : ""}`} onClick={() => setRange(n)}>{n} days</button>
              ))}
            </div>
          </div>
          {rangeTotal > 0 ? (
            <LineChart
              data={series}
              height={176}
              ariaLabel={`Spending by day, last ${range} days, ${formatMoney(rangeTotal)} total`}
              format={(v, axis) => (axis ? compactMoney(v) : formatMoney(v))}
            />
          ) : (
            <div className="empty-state activity-empty">
              <i className="fa-solid fa-chart-line empty-state-icon" aria-hidden="true" />
              <div className="empty-state-title">No spending in the last {range} days</div>
              <div className="empty-state-desc">Log a purchase in Money and it shows up here.</div>
              <Link to="/admin/finance" className="btn btn-sm empty-state-action">Open Money</Link>
            </div>
          )}
        </Item>

        <Item className="today-section upnext">
          <div className="section-head">
            <h2 className="section-title">Up next</h2>
          </div>
          {upNext.length === 0 ? (
            <p className="no-entries">Nothing coming up this week. You&apos;re clear.</p>
          ) : (
            <ul className="un-list">
              {upNext.map((it) => (
                <li key={it.id}>
                  <div className="un-row" role="button" tabIndex={0} onClick={it.go} onKeyDown={onActivate(it.go)}>
                    <span className={`un-icon kind-${it.kind}`} aria-hidden="true">
                      <i className={`fa-solid ${it.kind === "event" ? "fa-calendar-day" : it.kind === "school" ? "fa-graduation-cap" : "fa-check"}`} />
                    </span>
                    <span className="un-main">
                      <span className="un-title">{it.title}</span>
                      <span className="un-sub">{it.sub}</span>
                    </span>
                    <span className={`un-when${it.date === todayStr ? " is-today" : ""}`}>{whenLabel(it)}</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
          <Link to="/admin/reminders" className="link-more">View all <i className="fa-solid fa-chevron-right" aria-hidden="true" /></Link>
        </Item>
      </div>

      {/* ── Row 3: spaces this week (reference "Channels") ── */}
      <Item className="spaces panel-mint">
        <div className="spaces-intro">
          <h2 className="section-title">This week</h2>
          <p>Your spaces at a glance for the week of <strong>{shortDate(wr.startStr)}</strong>.</p>
        </div>
        <div className="spaces-cards">
          <Link to="/admin/finance" className="space-card">
            <span className="space-icon tone-coral" aria-hidden="true"><i className="fa-solid fa-wallet" /></span>
            <span className="space-name">Money</span>
            <span className="space-sub">{upcomingBills.length ? `${upcomingBills.length} bills coming` : "No bills due"}</span>
            <span className={`space-value${remaining !== null && remaining < 0 ? " is-neg" : ""}`}>{remaining === null ? "—" : compactMoney(Math.abs(remaining))}</span>
          </Link>
          <Link to="/admin/planner" className="space-card">
            <span className="space-icon tone-sky" aria-hidden="true"><i className="fa-solid fa-calendar-check" /></span>
            <span className="space-name">Plan</span>
            <span className="space-sub">events in 7 days</span>
            <span className="space-value">{eventsThisWeek.length}</span>
          </Link>
          <Link to="/admin/school" className="space-card">
            <span className="space-icon tone-amber" aria-hidden="true"><i className="fa-solid fa-graduation-cap" /></span>
            <span className="space-name">School</span>
            <span className="space-sub">{nextDeadline ? `next ${shortDate(nextDeadline.date)}` : "no deadlines"}</span>
            <span className="space-value">{openDeadlines}</span>
          </Link>
          <Link to="/admin/life?tab=journal" className="space-card">
            <span className="space-icon tone-teal" aria-hidden="true"><i className="fa-solid fa-book" /></span>
            <span className="space-name">Journal</span>
            <span className="space-sub">{lastEntry ? `last ${shortDate(lastEntry.date)}` : "no entries yet"}</span>
            <span className="space-value">{journalThisWeek}</span>
          </Link>
          <Link to="/admin/planner" className="space-cta">
            <span>Full plan</span>
            <span className="space-cta-go" aria-hidden="true"><i className="fa-solid fa-chevron-right" /></span>
          </Link>
        </div>
      </Item>

      {/* ── Row 4: the brief, in full ── */}
      <Item className="db-card">
        <div className="db-card-header">
          <h3 className="db-card-title">Morning brief</h3>
        </div>
        <div className="brief-grid">
          {brief.sections.map((sec) => (
            <div key={sec.key} className="brief-section">
              <div className="brief-section-title"><i className={`fa-solid ${sec.icon}`} aria-hidden="true" /> {sec.title}</div>
              {sec.items.length === 0
                ? <p className="brief-empty">{sec.empty}</p>
                : sec.items.slice(0, 6).map((it, i) => (
                  it.to
                    ? <button key={i} type="button" className={`brief-item tone-${it.tone || "default"}`} onClick={() => navigate(it.to)}>{it.text}</button>
                    : <div key={i} className={`brief-item tone-${it.tone || "default"}`}>{it.text}</div>
                ))}
              {sec.items.length > 6 && <p className="brief-empty">+{sec.items.length - 6} more</p>}
            </div>
          ))}
        </div>
      </Item>

      {/* ── Row 5: details ── */}
      <div className="db-grid">
        <Item className="db-card col-6">
          <div className="db-card-header">
            <h3 className="db-card-title">Upcoming bills</h3>
            <Link to="/admin/finance?tab=bills" className="link-more">Bills <i className="fa-solid fa-chevron-right" aria-hidden="true" /></Link>
          </div>
          {upcomingBills.length === 0
            ? <p className="no-entries">No upcoming bills. Add recurring bills in <Link to="/admin/finance?tab=bills">Money › Bills &amp; Income</Link>.</p>
            : (
              <div className="db-list">
                {upcomingBills.map((b) => (
                  <div className="db-list-item" key={`${b.id}-${b.due}`}>
                    <div className="db-list-item-content">
                      <div className="db-list-item-title">{b.name}</div>
                      <div className="db-list-item-subtitle">{formatDisplayDate(b.due)}{b.paid ? " · paid" : b.autoPay ? " · auto-pay" : ""}</div>
                    </div>
                    <span className={`bill-amt${b.paid ? " is-paid" : ""}`}>{formatMoney(b.amount)}</span>
                  </div>
                ))}
              </div>
            )}
        </Item>

        {agentActions.length > 0 && (
          <Item className="db-card col-6">
            <div className="db-card-header">
              <h3 className="db-card-title">Agent activity</h3>
              <Link to="/admin/mission" className="link-more">Mission Control <i className="fa-solid fa-chevron-right" aria-hidden="true" /></Link>
            </div>
            <div className="db-list">
              {(allActions ? agentActions : agentActions.slice(0, ACTIONS_SHOWN)).map((a) => {
                const isErr = a.status === "error";
                return (
                  <div className={`db-list-item act-row${isErr ? " is-error" : ""}`} key={a.id}>
                    <div className="db-list-item-content">
                      <div className="db-list-item-title act-title">{describeAction(a)}</div>
                      <div className="db-list-item-subtitle">
                        <span className="act-agent">{a.agent_id}</span> · <span title={new Date(a.created_at).toLocaleString()}>{actionTime(a.created_at)}</span>
                        {isErr && <> · <span className="act-err">failed</span></>}
                      </div>
                      {a.error && <div className="act-error" title={a.error}>{a.error}</div>}
                    </div>
                  </div>
                );
              })}
            </div>
            {agentActions.length > ACTIONS_SHOWN && (
              <button type="button" className="btn-mini act-more" onClick={() => setAllActions((v) => !v)}>
                {allActions ? "Show fewer" : `Show all ${agentActions.length}`}
              </button>
            )}
          </Item>
        )}

        <AccountabilitySummary />
        <StorageUsage />
        <ConnectionStatus />
      </div>

      {/* This-week reminders, grouped by day */}
      {showWeek && (
        <div className="event-overlay" onClick={(e) => { if (e.target.classList.contains("event-overlay")) setShowWeek(false); }}>
          <div className="day-modal" role="dialog" aria-modal="true" aria-label="This week">
            <div className="day-modal-head">
              <div className="day-modal-titles">
                <div className="day-modal-dow">This week</div>
                <div className="day-modal-date">{shortDate(wr.startStr)} – {shortDate(wr.endStr)}</div>
              </div>
              <button className="icon-x" onClick={() => setShowWeek(false)} aria-label="Close"><i className="fa-solid fa-xmark" aria-hidden="true" /></button>
            </div>
            <div className="day-modal-body">
              {weekByDay.map((d) => (
                <div className="day-section" key={d.ds}>
                  <div className="day-section-head">
                    <span>{weekdayLabel(d.ds)}{d.ds === todayStr ? " · Today" : ""}</span>
                    <span className="day-count">{d.items.length}</span>
                  </div>
                  {d.items.length === 0 && <p className="day-empty">Nothing due</p>}
                  {d.items.map((r) => {
                    const go = () => { setShowWeek(false); openTask(r.id); };
                    return (
                      <div className="day-item day-item--clickable" key={`${r.id}-${r.date}`} role="button" tabIndex={0} onClick={go} onKeyDown={onActivate(go)}>
                        <span className="day-item-dot week-dot" />
                        <div className="day-item-body"><div className="day-item-title">{r.name}</div></div>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </Stagger>
  );
}
