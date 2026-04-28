import { useMemo, useState } from "react";
import { formatMoney, getWeekRange, toDateStr } from "../../utils/plannerUtils";

const WEEKS_PER_MONTH = 4.33;

function ym(s) { return (s || "").slice(0, 7); }
function isFunCategory(cat) { return cat === "Entertainment" || cat === "Fun"; }
function isFunBill(b) { return /fun/i.test(b.name || "") || isFunCategory(b.category); }
function dueDayOf(b) { return b.dueDay ? Number(b.dueDay) : null; }

function isSourceActive(source, monthKey) {
  if (!source.startDate || ym(source.startDate) > monthKey) return false;
  if (source.endDate && ym(source.endDate) < monthKey) return false;
  return true;
}

export default function WeeklyTracker({
  transactions,
  recurringBills,
  incomeSources,
  events,
  categories,
  onQuickLog,
  onUpdateTx,
  onDeleteTx,
  onLogBill,
}) {
  const [weekOffset, setWeekOffset] = useState(0);
  const [expanded, setExpanded] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [draft, setDraft] = useState(null);

  const week = useMemo(() => {
    const anchor = new Date();
    anchor.setDate(anchor.getDate() + weekOffset * 7);
    const range = getWeekRange(anchor);

    const weekTxs = transactions
      .filter(t => t.date >= range.startStr && t.date <= range.endStr)
      .sort((a, b) => (a.date || "").localeCompare(b.date || ""));
    const spent = weekTxs.filter(t => Number(t.amount) < 0).reduce((s, t) => s + Math.abs(Number(t.amount)), 0);
    const income = weekTxs.filter(t => Number(t.amount) > 0).reduce((s, t) => s + Number(t.amount), 0);

    // Fun pot
    const funBills = recurringBills.filter(isFunBill);
    const funMonthly = funBills.reduce((s, b) => s + Math.abs(Number(b.amount || 0)), 0);
    const funWeekly = funMonthly / WEEKS_PER_MONTH;
    const funSpent = weekTxs
      .filter(t => isFunCategory(t.category) && Number(t.amount) < 0)
      .reduce((s, t) => s + Math.abs(Number(t.amount)), 0);

    // Scheduled bills this week (explicit dueDay only, exclude fun)
    const scheduled = [];
    for (const b of recurringBills) {
      if (isFunBill(b)) continue;
      const dueDay = dueDayOf(b);
      if (!dueDay) continue;
      const cursor = new Date(range.start);
      while (cursor <= range.end) {
        if (cursor.getDate() === dueDay) {
          const dateStr = toDateStr(cursor);
          const monthKey = ym(dateStr);
          if (ym(b.startDate) <= monthKey && (!b.endDate || ym(b.endDate) >= monthKey)) {
            const fulfilled = transactions.some(t => t.fulfills_recurring_id === b.id && ym(t.date) === monthKey);
            scheduled.push({ bill: b, date: dateStr, fulfilled });
          }
        }
        cursor.setDate(cursor.getDate() + 1);
      }
    }
    const scheduledUnpaidTotal = scheduled
      .filter(s => !s.fulfilled)
      .reduce((sum, s) => sum + Math.abs(Number(s.bill.amount)), 0);

    // Event commitments this week (events with cost > 0)
    const allEvents = events || [];
    const commitments = allEvents
      .filter(e => e.date >= range.startStr && e.date <= range.endStr && Number(e.cost || 0) > 0)
      .sort((a, b) => a.date.localeCompare(b.date));
    const commitmentTotal = commitments.reduce((s, e) => s + Number(e.cost), 0);

    // Weekly income from income sources
    const monthKey = range.startStr.slice(0, 7);
    const weeklyIncome = (incomeSources || [])
      .filter(s => isSourceActive(s, monthKey))
      .reduce((s, src) => s + Number(src.amount || 0), 0) / WEEKS_PER_MONTH;

    // Free to spend = weekly income - bills due this week - commitments - already spent
    const freeToSpend = weeklyIncome - scheduledUnpaidTotal - commitmentTotal - spent;

    // Category spending bars (exclude fun — shown separately)
    const catBudgets = {};
    for (const b of recurringBills) {
      if (isFunBill(b)) continue;
      const cat = b.category || "Other";
      const mk = range.startStr.slice(0, 7);
      if (!isSourceActive({ startDate: b.startDate, endDate: b.endDate }, mk)) continue;
      catBudgets[cat] = (catBudgets[cat] || 0) + Math.abs(Number(b.amount || 0)) / WEEKS_PER_MONTH;
    }
    const catSpent = {};
    for (const t of weekTxs) {
      if (Number(t.amount) >= 0) continue;
      if (isFunCategory(t.category)) continue;
      const cat = t.category || "Other";
      catSpent[cat] = (catSpent[cat] || 0) + Math.abs(Number(t.amount));
    }
    // Build bars for categories that have budget or spending
    const allCats = new Set([...Object.keys(catBudgets), ...Object.keys(catSpent)]);
    const catBars = [...allCats]
      .map(cat => ({ cat, budget: catBudgets[cat] || 0, spent: catSpent[cat] || 0 }))
      .filter(x => x.budget > 0 || x.spent > 0)
      .sort((a, b) => b.spent - a.spent);

    // Later this month
    const viewingCurrentWeek = weekOffset === 0;
    const laterThisMonth = [];
    if (viewingCurrentWeek) {
      const today = new Date();
      const mk = toDateStr(today).slice(0, 7);
      for (const b of recurringBills) {
        if (isFunBill(b)) continue;
        const dueDay = dueDayOf(b);
        if (!dueDay) continue;
        if (ym(b.startDate) > mk) continue;
        if (b.endDate && ym(b.endDate) < mk) continue;
        const already = transactions.some(t => t.fulfills_recurring_id === b.id && ym(t.date) === mk);
        if (already) continue;
        const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
        const dueDate = new Date(today.getFullYear(), today.getMonth(), Math.min(dueDay, lastDay));
        if (dueDate >= range.start && dueDate <= range.end) continue;
        laterThisMonth.push({ bill: b, dueDate: toDateStr(dueDate) });
      }
      laterThisMonth.sort((a, b) => a.dueDate.localeCompare(b.dueDate));
    }
    const laterTotal = laterThisMonth.reduce((s, x) => s + Math.abs(Number(x.bill.amount)), 0);

    return {
      ...range,
      weekTxs, spent, income,
      funMonthly, funWeekly, funSpent, funLeft: funWeekly - funSpent,
      scheduled, scheduledUnpaidTotal,
      commitments, commitmentTotal,
      weeklyIncome, freeToSpend,
      catBars,
      laterThisMonth, laterTotal,
    };
  }, [transactions, recurringBills, incomeSources, events, weekOffset]);

  const dateRange = `${week.start.toLocaleDateString(undefined, { month: "short", day: "numeric" })} – ${week.end.toLocaleDateString(undefined, { month: "short", day: "numeric" })}`;
  const label = weekOffset === 0 ? "This Week"
    : weekOffset === -1 ? "Last Week"
    : weekOffset === 1 ? "Next Week"
    : dateRange;

  const funOver = week.funLeft < 0;
  const freeOver = week.freeToSpend < 0;

  // Inline edit
  const startEdit = (tx) => {
    setEditingId(tx.id);
    setDraft({ description: tx.description, amount: Math.abs(Number(tx.amount)), type: tx.type, category: tx.category, date: tx.date });
  };
  const commit = async () => {
    await onUpdateTx(editingId, { ...draft, amount: Number(draft.amount) });
    setEditingId(null); setDraft(null);
  };
  const cancel = () => { setEditingId(null); setDraft(null); };
  const onKey = (e) => { if (e.key === "Enter") commit(); if (e.key === "Escape") cancel(); };

  return (
    <div className={`bud-week ${expanded ? "expanded" : ""}`}>
      <div className="bud-week-nav">
        <button type="button" className="btn-mini" onClick={() => setWeekOffset(w => w - 1)} aria-label="Previous week">
          <i className="fa-solid fa-chevron-left" />
        </button>
        <button type="button" className="bud-week-title" onClick={() => setExpanded(v => !v)}>
          <span className="bud-week-label-top">{label}</span>
          <span className="bud-week-dates">{dateRange}</span>
          <i className={`fa-solid ${expanded ? "fa-chevron-up" : "fa-chevron-down"} bud-week-chev`} />
        </button>
        <button type="button" className="btn-mini" onClick={() => setWeekOffset(w => w + 1)} aria-label="Next week">
          <i className="fa-solid fa-chevron-right" />
        </button>
      </div>

      {/* ── Hero stats row ── */}
      <div className="bud-week-hero">
        {/* Free to spend */}
        <div className="bud-week-free-card">
          <div className="bud-week-caption">Free to spend</div>
          <div className="bud-week-free-val" style={{ color: freeOver ? "var(--bud-red)" : "var(--bud-green)" }}>
            {freeOver ? "-" : ""}{formatMoney(Math.abs(week.freeToSpend))}
          </div>
          <div className="bud-week-fun-sub">
            <strong>{formatMoney(week.spent)}</strong> spent · <strong>{formatMoney(week.scheduledUnpaidTotal + week.commitmentTotal)}</strong> committed
          </div>
          {weekOffset === 0 && (
            <button type="button" className="btn accent bud-week-fun-btn" onClick={() => onQuickLog("Entertainment")}>
              <i className="fa-solid fa-plus" /> Log expense
            </button>
          )}
        </div>

        <div className="bud-week-stats">
          {/* Fun pot */}
          <div className="bud-week-stat">
            <div className="bud-week-caption">Fun money left</div>
            <div className="bud-week-stat-val" style={{ color: funOver ? "var(--bud-red)" : "var(--bud-green)" }}>
              {funOver ? "-" : ""}{formatMoney(Math.abs(week.funLeft))}
            </div>
            <div className="bud-week-fun-track" style={{ marginTop: "0.3rem" }}>
              <div className="bud-week-fun-fill" style={{
                width: `${Math.min(week.funWeekly > 0 ? (week.funSpent / week.funWeekly) * 100 : 0, 100)}%`,
                background: funOver ? "var(--bud-red)" : week.funSpent / week.funWeekly > 0.75 ? "var(--bud-gold)" : "var(--bud-green)",
              }} />
            </div>
          </div>

          {/* Scheduled unpaid */}
          <div className="bud-week-stat">
            <div className="bud-week-caption">Bills due</div>
            <div className="bud-week-stat-val" style={{ color: week.scheduledUnpaidTotal > 0 ? "var(--bud-gold)" : "var(--text-muted)" }}>
              {formatMoney(week.scheduledUnpaidTotal)}
            </div>
            <div className="bud-week-stat-sub">{week.scheduled.filter(s => !s.fulfilled).length} unpaid</div>
          </div>

          {/* Commitments */}
          {week.commitments.length > 0 && (
            <div className="bud-week-stat">
              <div className="bud-week-caption">Commitments</div>
              <div className="bud-week-stat-val" style={{ color: "var(--orange)" }}>
                {formatMoney(week.commitmentTotal)}
              </div>
              <div className="bud-week-stat-sub">{week.commitments.length} event{week.commitments.length !== 1 ? "s" : ""}</div>
            </div>
          )}

          {week.income > 0 && (
            <div className="bud-week-stat">
              <div className="bud-week-caption">Income logged</div>
              <div className="bud-week-stat-val" style={{ color: "var(--bud-green)" }}>+{formatMoney(week.income)}</div>
            </div>
          )}
        </div>
      </div>

      {/* ── Category spending bars ── */}
      {week.catBars.length > 0 && (
        <div className="bud-cat-bars">
          {week.catBars.map(({ cat, budget, spent }) => {
            const pct = budget > 0 ? Math.min((spent / budget) * 100, 100) : 0;
            const over = budget > 0 && spent > budget;
            const barColor = over ? "var(--bud-red)" : pct > 75 ? "var(--bud-gold)" : "var(--accent)";
            return (
              <div className="bud-cat-bar-row" key={cat}>
                <div className="bud-cat-bar-label">
                  <span>{cat}</span>
                  <span className="bud-cat-bar-nums">
                    {formatMoney(spent)}{budget > 0 ? ` / ${formatMoney(budget)}` : " this week"}
                  </span>
                </div>
                <div className="bud-cat-bar-track">
                  <div className="bud-cat-bar-fill" style={{ width: budget > 0 ? `${pct}%` : "100%", background: barColor, opacity: budget > 0 ? 1 : 0.35 }} />
                </div>
              </div>
            );
          })}
        </div>
      )}

      <button type="button" className="bud-week-expand-hint" onClick={() => setExpanded(v => !v)}>
        {expanded ? "Hide details" : "Show logged + scheduled"} <i className={`fa-solid ${expanded ? "fa-chevron-up" : "fa-chevron-down"}`} />
      </button>

      {expanded && (
        <div className="bud-week-detail">
          {/* Logged */}
          <div className="bud-week-col">
            <h4 className="bud-week-col-head">Logged ({week.weekTxs.length})</h4>
            {week.weekTxs.length === 0 && <p className="bud-muted">Nothing logged for this week.</p>}
            {week.weekTxs.map(tx => {
              if (editingId === tx.id) {
                return (
                  <div className="bud-tx-edit" key={tx.id} onKeyDown={onKey}>
                    <input autoFocus value={draft.description} onChange={e => setDraft({ ...draft, description: e.target.value })} placeholder="Description" />
                    <input type="number" step="0.01" value={draft.amount} onChange={e => setDraft({ ...draft, amount: e.target.value })} />
                    <select value={draft.type} onChange={e => setDraft({ ...draft, type: e.target.value })}>
                      <option value="expense">Expense</option>
                      <option value="income">Income</option>
                    </select>
                    <select value={draft.category} onChange={e => setDraft({ ...draft, category: e.target.value })}>
                      {categories.map(c => <option key={c}>{c}</option>)}
                    </select>
                    <input type="date" value={draft.date} onChange={e => setDraft({ ...draft, date: e.target.value })} />
                    <button type="button" className="btn-mini accent" onClick={commit}><i className="fa-solid fa-check" /></button>
                    <button type="button" className="btn-mini muted" onClick={cancel}><i className="fa-solid fa-xmark" /></button>
                  </div>
                );
              }
              const signed = Number(tx.amount);
              const dayLabel = tx.date ? new Date(tx.date + "T00:00").toLocaleDateString(undefined, { weekday: "short", day: "numeric" }) : "";
              return (
                <div className={`bud-tx-row ${signed < 0 ? "expense" : "income"}`} key={tx.id}>
                  <div className="bud-tx-main">
                    <div className="bud-tx-desc">{tx.description}</div>
                    <div className="bud-tx-meta">{dayLabel} · {tx.category}{isFunCategory(tx.category) ? " (Fun)" : ""}</div>
                  </div>
                  <div className="bud-tx-amount">{signed < 0 ? "-" : "+"}{formatMoney(signed)}</div>
                  <div className="bud-tx-actions">
                    <button type="button" className="btn-mini" onClick={() => startEdit(tx)}><i className="fa-solid fa-pen" /></button>
                    <button type="button" className="btn-mini danger" onClick={() => { if (confirm(`Delete "${tx.description}"?`)) onDeleteTx(tx.id); }}><i className="fa-solid fa-trash" /></button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Scheduled bills */}
          <div className="bud-week-col">
            <h4 className="bud-week-col-head">Scheduled ({week.scheduled.length})</h4>
            {week.scheduled.length === 0 && (
              <p className="bud-muted">No dated bills this week.<br /><span style={{ fontSize: "0.72rem" }}>Set a "Due day" on a bill to see it here.</span></p>
            )}
            {week.scheduled.map((s, i) => {
              const dueLabel = new Date(s.date + "T00:00").toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
              return (
                <div className={`bud-src-row ${s.fulfilled ? "paid" : "expense"}`} key={`${s.bill.id}-${s.date}-${i}`}>
                  <div className="bud-tx-main">
                    <div className="bud-tx-desc">
                      {s.bill.name}
                      {s.fulfilled && <span className="bud-paid-badge"><i className="fa-solid fa-check" /> paid</span>}
                    </div>
                    <div className="bud-tx-meta">Due {dueLabel} · {s.bill.category || "Other"}</div>
                  </div>
                  <div className="bud-tx-amount">-{formatMoney(s.bill.amount)}</div>
                  {!s.fulfilled && (
                    <button type="button" className="btn-mini accent" onClick={() => onLogBill(s.bill, s.date)}>
                      <i className="fa-solid fa-check" /> Paid
                    </button>
                  )}
                </div>
              );
            })}
          </div>

          {/* Event commitments */}
          {week.commitments.length > 0 && (
            <div className="bud-week-col">
              <h4 className="bud-week-col-head">Commitments ({week.commitments.length})</h4>
              {week.commitments.map(e => {
                const dayLabel = new Date(e.date + "T00:00").toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
                return (
                  <div className="bud-src-row commitment" key={e.id}>
                    <div className="bud-tx-main">
                      <div className="bud-tx-desc">{e.title}</div>
                      <div className="bud-tx-meta">{dayLabel}{e.description ? ` · ${e.description}` : ""}</div>
                    </div>
                    <div className="bud-tx-amount" style={{ color: "var(--orange)" }}>~{formatMoney(e.cost)}</div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Later this month */}
          {weekOffset === 0 && week.laterThisMonth.length > 0 && (
            <div className="bud-week-later">
              <div className="bud-week-later-head">
                <h4 className="bud-week-col-head" style={{ margin: 0 }}>Coming up later this month ({week.laterThisMonth.length})</h4>
                <span className="bud-muted" style={{ fontSize: "0.78rem" }}>Total {formatMoney(week.laterTotal)} · pay early to log now</span>
              </div>
              <div className="bud-week-later-list">
                {week.laterThisMonth.map(s => {
                  const dueLabel = new Date(s.dueDate + "T00:00").toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
                  return (
                    <div className="bud-src-row expense" key={`later-${s.bill.id}`}>
                      <div className="bud-tx-main">
                        <div className="bud-tx-desc">{s.bill.name}</div>
                        <div className="bud-tx-meta">Due {dueLabel} · {s.bill.category || "Other"}</div>
                      </div>
                      <div className="bud-tx-amount">-{formatMoney(s.bill.amount)}</div>
                      <button type="button" className="btn-mini accent" onClick={() => onLogBill(s.bill, toDateStr(new Date()))} title="Pay early">
                        <i className="fa-solid fa-forward" /> Pay early
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
