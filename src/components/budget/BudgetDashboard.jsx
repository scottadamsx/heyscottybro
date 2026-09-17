import { useMemo, useState } from "react";
import { getPeriodBills, getQuantifiableBudgets, savingsPlan, getBillDatesInRange, getIncomeDatesInRange, formatMoney, formatMoneyAbs, formatPeriodLabel, parseDate, toDateStr, genId } from "../../utils/budgetCalc";
import { computeBudgetSnapshot } from "./budgetSummary";
import "./budget.css";
import DatePicker from "../DatePicker";
import { FormModal, Field } from "../ui";

function MoneyChart({ config, transactions, period }) {
  const W = 600, H = 160, padY = 8;
  const { start, end } = period;

  const days = [];
  let cur = parseDate(start);
  const endDt = parseDate(end);
  while (cur <= endDt) { days.push(toDateStr(cur)); cur.setDate(cur.getDate() + 1); }
  if (days.length === 0) return null;

  let cumIn = 0, cumOut = 0;
  const inData = [], outData = [];
  days.forEach(dStr => {
    let dayIn = 0;
    (config.income || []).forEach(inc => { if (getIncomeDatesInRange(inc, dStr, dStr).length > 0) dayIn += inc.amount; });
    dayIn += transactions.filter(t => t.date === dStr && t.type === "income").reduce((s, t) => s + t.amount, 0);
    cumIn += dayIn; inData.push(cumIn);
    let dayOut = 0;
    (config.recurringBills || []).forEach(bill => { if (getBillDatesInRange(bill, dStr, dStr).length > 0) dayOut += bill.amount; });
    dayOut += transactions.filter(t => t.date === dStr && (t.type === "expense" || t.type === "future")).reduce((s, t) => s + t.amount, 0);
    cumOut += dayOut; outData.push(cumOut);
  });

  const maxVal = Math.max(...inData, ...outData, 1);
  const x = i => (i / Math.max(1, days.length - 1)) * W;
  const y = v => padY + (1 - v / maxVal) * (H - padY * 2);

  const inPts = inData.map((v, i) => `${x(i)},${y(v)}`).join(" ");
  const outPts = outData.map((v, i) => `${x(i)},${y(v)}`).join(" ");
  const inArea = `M ${x(0)},${y(inData[0])} ${inData.map((v, i) => `L ${x(i)},${y(v)}`).join(" ")} L ${x(days.length-1)},${H-padY} L ${x(0)},${H-padY} Z`;
  const outArea = `M ${x(0)},${y(outData[0])} ${outData.map((v, i) => `L ${x(i)},${y(v)}`).join(" ")} L ${x(days.length-1)},${H-padY} L ${x(0)},${H-padY} Z`;

  const ticks = [maxVal, maxVal * 0.5, 0];

  return (
    <>
      <div className="money-legend" aria-hidden="true"><span><i className="in" />Money in</span><span><i className="out" />Money out</span></div>
      <div className="money-chart-wrap">
      <div className="money-chart-y" aria-hidden="true">
        {ticks.map((t, i) => <span key={i} style={{ top: `${(y(t) / H) * 100}%` }}>${Math.round(t).toLocaleString()}</span>)}
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="money-chart" preserveAspectRatio="none" role="img" aria-label={`Money in vs out this period: ${formatMoney(inData[inData.length - 1])} in, ${formatMoney(outData[outData.length - 1])} out`}>
        <defs>
          <linearGradient id="gin" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="var(--teal)" stopOpacity="0.22" /><stop offset="100%" stopColor="var(--teal)" stopOpacity="0" /></linearGradient>
          <linearGradient id="gout" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="var(--coral)" stopOpacity="0.18" /><stop offset="100%" stopColor="var(--coral)" stopOpacity="0" /></linearGradient>
        </defs>
        {ticks.map((t, i) => (
          <line key={i} x1={0} x2={W} y1={y(t)} y2={y(t)} className="bud-stroke-grid" strokeWidth="1" vectorEffect="non-scaling-stroke" />
        ))}
        <path d={inArea} fill="url(#gin)" />
        <path d={outArea} fill="url(#gout)" />
        <polyline points={inPts} fill="none" className="bud-stroke-in" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
        <polyline points={outPts} fill="none" className="bud-stroke-out" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
      </svg>
      </div>
    </>
  );
}

export default function BudgetDashboard({ config, transactions, periodOffset, setPeriodOffset, onPayBill, onUnpayBill, onSetCategoryBudget, onSaveGoals }) {
  const today = toDateStr();

  // Pay-period dashboard: the period runs payday → day before next payday,
  // derived from the income sources in Bills & Income. periodOffset moves whole
  // pay periods. Everything below is scoped to this period so the analytics
  // reflect "this paycheque": the bills due in it + every categorized expense.
  // ONE shared snapshot — the home Dashboard widget derives its budget numbers
  // from this exact same function, so the two screens can never disagree.
  const snap = useMemo(() => computeBudgetSnapshot(config, transactions, today, periodOffset), [config, transactions, today, periodOffset]);
  const { period, incomeTotal, spent, billsTotal, remaining, periodTx, weekly, currentWeek, savingsThisPeriod, billsPaid, billsObligation, saved, spentNonBill } = snap;

  // Savings goals — how much to set aside this paycheque for each goal (the
  // detailed per-goal rows; the period total comes from the snapshot above).
  const goals = useMemo(() => savingsPlan(config, today), [config, today]);

  const { bills } = useMemo(() => getPeriodBills(transactions, config, period), [transactions, config, period]);
  const fixedBills = useMemo(() => bills.filter(b => !b.variable), [bills]);
  const variableBills = useMemo(() => bills.filter(b => b.variable), [bills]);
  const paidCount = fixedBills.filter(b => b.paid).length;

  // billsPaid / billsObligation / saved / spentNonBill now come from the shared
  // snapshot (computeBudgetSnapshot) so the home Dashboard widget shows the same
  // breakdown — see destructure above. weekly/currentWeek also come from snap.
  const catTotals = useMemo(() => {
    const m = {};
    periodTx.filter(t => t.type === "expense").forEach(t => { m[t.category] = (m[t.category] || 0) + t.amount; });
    return Object.entries(m).sort((a, b) => b[1] - a[1]);
  }, [periodTx]);
  const maxCat = catTotals.length > 0 ? catTotals[0][1] : 1;
  const totalSpent = spent || 1;

  // ── Quantifiable category budgets (Groceries, Gas… set via "Add budget") ──
  const periodLabel = formatPeriodLabel(period.start, period.end);
  const quantBudgets = useMemo(() => getQuantifiableBudgets(transactions, config, period), [transactions, config, period]);
  const budgetedCats = quantBudgets.map(q => q.category);
  const unbudgetedCats = (config.categories || []).filter(c => !budgetedCats.includes(c));
  // Category budget modal: { mode: "add" | "edit", cat, val } or null.
  const [budgetForm, setBudgetForm] = useState(null);
  const openAddBudget = () => setBudgetForm({ mode: "add", cat: "", val: "" });
  const startEdit = (cat) => setBudgetForm({ mode: "edit", cat, val: String((config.categoryBudgets || {})[cat] || "") });
  const closeBudget = () => setBudgetForm(null);
  // Edit: an empty / zero amount clears the budget, exactly as the inline editor did.
  const saveBudget = () => {
    const amt = parseFloat(budgetForm.val);
    if (budgetForm.mode === "edit") { onSetCategoryBudget?.(budgetForm.cat, amt); return; }
    if (!budgetForm.cat) throw new Error("Pick a category.");
    if (!(amt > 0)) throw new Error("Enter a monthly amount greater than zero.");
    onSetCategoryBudget?.(budgetForm.cat, amt);
  };
  const removeBudget = () => { onSetCategoryBudget?.(budgetForm.cat, 0); closeBudget(); };

  // Savings-goal modal state
  const [goalForm, setGoalForm] = useState({ name: "", target: "", targetDate: "", saved: "" });
  const [goalEditId, setGoalEditId] = useState(null);
  const [goalOpen, setGoalOpen] = useState(false);
  const resetGoal = () => { setGoalForm({ name: "", target: "", targetDate: "", saved: "" }); setGoalEditId(null); setGoalOpen(false); };
  const saveGoal = () => {
    const target = parseFloat(goalForm.target);
    if (!goalForm.name.trim()) throw new Error("Say what the goal is for.");
    if (isNaN(target) || target <= 0) throw new Error("Enter a target amount greater than zero.");
    if (!goalForm.targetDate) throw new Error("Pick the date you need it by.");
    const g = { id: goalEditId || genId(), name: goalForm.name.trim(), target, targetDate: goalForm.targetDate, saved: parseFloat(goalForm.saved) || 0 };
    const list = config.savingsGoals || [];
    onSaveGoals?.(goalEditId ? list.map(x => x.id === goalEditId ? g : x) : [...list, g]);
  };
  const openNewGoal = () => { setGoalEditId(null); setGoalForm({ name: "", target: "", targetDate: "", saved: "" }); setGoalOpen(true); };
  const editGoal = (g) => { setGoalEditId(g.id); setGoalForm({ name: g.name, target: String(g.target), targetDate: g.targetDate || "", saved: String(g.saved || "") }); setGoalOpen(true); };
  const deleteGoal = (id) => onSaveGoals?.((config.savingsGoals || []).filter(g => g.id !== id));

  // Scope Recent to the selected period so the list always agrees with the
  // period's Spent total (otherwise an all-time list looks inconsistent with a
  // this-period number).
  const recent = useMemo(() => [...periodTx].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 10), [periodTx]);

  // Click-to-drill: which row's transactions are expanded.
  const [openRow, setOpenRow] = useState(null);
  const toggleRow = (key) => setOpenRow(k => (k === key ? null : key));
  const catTx = (cat) => periodTx.filter(t => t.type === "expense" && t.category === cat).sort((a, b) => b.date.localeCompare(a.date));
  // Variable bills track ONLY transactions explicitly tagged to them, so the drill matches.
  const billTx = (billId) => periodTx.filter(t => t.type === "expense" && t.fulfills_recurring_id === billId).sort((a, b) => b.date.localeCompare(a.date));

  // Headline-stat drill-down: clicking a summary card opens a modal listing the
  // exact transactions behind that figure. Sets mirror how budgetSummary derives
  // each number, so the modal always reconciles with the card.
  const [statDrill, setStatDrill] = useState(null); // card label, or null
  const fixedBillTxIds = useMemo(() => new Set(fixedBills.map(b => b.matchedTxId).filter(Boolean)), [fixedBills]);
  const statTx = useMemo(() => ({
    Income: periodTx.filter(t => t.type === "income"),
    "Bills paid": periodTx.filter(t => fixedBillTxIds.has(t.id)),
    Spent: periodTx.filter(t => t.type === "expense" && !fixedBillTxIds.has(t.id) && t.category !== "Savings"),
    Saved: periodTx.filter(t => t.type === "savings" || (t.type === "expense" && t.category === "Savings")),
  }), [periodTx, fixedBillTxIds]);

  // Small transaction list shown when a category / bill row is expanded.
  const TxDrill = ({ txs, empty = "No transactions this pay period." }) => (
    <div className="bud-drill">
      {txs.length === 0
        ? <div className="bud-muted-12">{empty}</div>
        : txs.map(t => (
          <div key={t.id} className="bud-drill-row">
            <span className="bud-ellipsis bud-drill-desc">{t.description || t.category}</span>
            <span className="bud-drill-meta">{t.date} · <span className="bud-mono">{formatMoney(t.amount)}</span></span>
          </div>
        ))}
    </div>
  );

  // Tones, not raw colours: the class carries the colour (and the number, the meaning).
  const summaryCards = [
    { label: "Income", value: incomeTotal, tone: "good" },
    { label: "Bills paid", value: billsPaid, sub: `of ${formatMoney(billsObligation)}` },
    { label: "Spent", value: spentNonBill, sub: "excluding bills" },
    { label: "Saved", value: saved },
  ];
  const remainingTone = remaining < 0 ? "bad" : remaining < 100 ? "warn" : "good";
  const meterFill = (pct, over) => (over ? "var(--red)" : pct > 80 ? "var(--amber)" : "var(--teal)");
  const weekTone = currentWeek ? (currentWeek.remaining < 0 ? "bad" : currentWeek.remaining < currentWeek.allowance * 0.25 ? "warn" : "good") : "good";
  const weekPct = currentWeek && currentWeek.allowance > 0 ? Math.min(Math.max(currentWeek.spent / currentWeek.allowance * 100, 0), 100) : 0;
  const drillTone = { Income: "good" };
  const onKey = (fn) => (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); fn(); } };

  return (
    <>
    <div className="money">
      {/* Pay-period navigator */}
      <div className="money-period">
        <div>
          <h2 className="money-period-title">
            {periodLabel}
            {periodOffset === 0 ? " · Current" : periodOffset === 1 ? " · Next" : periodOffset === -1 ? " · Previous" : ""}
          </h2>
          <p className="money-period-sub">
            {period.fallback ? "No paydays set, so this is the calendar month. Add an income source in Bills & Income for pay-period analytics." : "Pay period: payday to the day before the next payday"}
          </p>
        </div>
        <div className="money-period-nav">
          <button type="button" onClick={() => setPeriodOffset(o => o - 1)} className="bud-navbtn" aria-label="Previous pay period"><i className="fa-solid fa-chevron-left" aria-hidden="true" /></button>
          {periodOffset !== 0 && <button type="button" className="btn-sm btn-secondary-sm" onClick={() => setPeriodOffset(0)}>Current</button>}
          <button type="button" onClick={() => setPeriodOffset(o => o + 1)} className="bud-navbtn" aria-label="Next pay period"><i className="fa-solid fa-chevron-right" aria-hidden="true" /></button>
        </div>
      </div>

      {/* Key numbers — each opens the transactions behind it */}
      <div className="kpis">
        {summaryCards.map(c => (
          <button key={c.label} type="button" className="kpi" onClick={() => setStatDrill(c.label)}
            title={`View the ${(statTx[c.label] || []).length} transaction(s) behind ${c.label}`}>
            <span className="kpi-head"><span className="kpi-label">{c.label}</span><i className="fa-solid fa-chevron-right bud-chev" aria-hidden="true" /></span>
            <span className={`kpi-value money-kpi-value${c.tone ? ` tone-${c.tone}` : ""}`}>{formatMoney(c.value)}</span>
            {c.sub && <span className="money-kpi-sub">{c.sub}</span>}
          </button>
        ))}
      </div>

      {/* Feature panels: this period · this week */}
      <div className="money-panels">
        <div className="money-panel panel-peach">
          <span className="money-panel-label">Remaining this period</span>
          <span className={`money-panel-value tone-${remainingTone}`}>{remaining < 0 ? "−" : ""}{formatMoneyAbs(remaining)}</span>
          <span className="money-panel-sub">{formatMoney(incomeTotal)} in · {formatMoney(billsTotal)} bills · {formatMoney(spent)} spent</span>
        </div>
        {currentWeek ? (
          <div className="money-panel panel-mint">
            <span className="money-panel-label">Left to spend this week</span>
            <span className={`money-panel-value tone-${weekTone}`}>{currentWeek.remaining < 0 ? "−" : ""}{formatMoneyAbs(currentWeek.remaining)}</span>
            <span className="money-panel-sub">
              {formatMoney(currentWeek.spent)} spent of {formatMoney(currentWeek.allowance)}
              {currentWeek.carryIn ? ` · ${currentWeek.carryIn >= 0 ? "+" : "−"}${formatMoneyAbs(currentWeek.carryIn)} rolled over` : ""}
            </span>
            <div className="bud-bar" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(weekPct)} aria-label="Weekly allowance used">
              <div className="bud-bar-fill" style={{ width: `${weekPct}%`, background: meterFill(weekPct, currentWeek.remaining < 0) }} />
            </div>
          </div>
        ) : (
          <div className="money-panel panel-mint">
            <span className="money-panel-label">Left to spend this week</span>
            <span className="money-panel-sub">Set up income in Bills &amp; Income to get a weekly allowance.</span>
          </div>
        )}
      </div>

      {/* Money flow */}
      <div className="db-card">
        <div className="db-card-header"><h3 className="db-card-title">Money flow</h3><span className="bud-muted-12">cumulative this period</span></div>
        <MoneyChart config={config} transactions={transactions} period={period} />
      </div>

      <div className="money-grid">
        {/* Weekly allowance */}
        <div className="db-card">
          <div className="db-card-header"><h3 className="db-card-title">Weekly allowance</h3></div>
          <p className="money-card-note">
            {formatMoney(weekly.weeklyBase)} a week · {formatMoney(weekly.spendable)} spendable this period
            ({formatMoney(weekly.incomeForPlanning)} scheduled − {formatMoney(weekly.billsObligation)} bills − {formatMoney(weekly.savings)} savings)
          </p>
          {weekly.weeks.map(w => {
            const over = w.remaining < 0;
            const pct = w.allowance > 0 ? Math.min(Math.max(w.spent / w.allowance * 100, 0), 100) : (w.spent > 0 ? 100 : 0);
            const dr = `${parseDate(w.start).getDate()}–${parseDate(w.end).getDate()}`;
            return (
              <div key={w.index} className={`money-meter${w.isPast ? " is-past" : ""}${w.isCurrent ? " is-current" : ""}`}>
                <div className="money-meter-head">
                  <span className="money-meter-name">Week {w.index} <span className="bud-muted-12">{dr}</span></span>
                  <span className={`money-meter-nums${over ? " is-over" : ""}`}>{over ? "−" : ""}{formatMoneyAbs(w.remaining)} left</span>
                </div>
                <div className="bud-bar"><div className="bud-bar-fill" style={{ width: `${pct}%`, background: meterFill(pct, over) }} /></div>
                <div className="money-meter-foot">
                  <span>{formatMoney(w.spent)} spent of {formatMoney(w.allowance)}{w.carryIn ? ` · ${w.carryIn >= 0 ? "+" : "−"}${formatMoneyAbs(w.carryIn)} rolled over` : ""}</span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Bills this pay period — fixed (paid/unpaid) + variable (progress) */}
        <div className="db-card">
          <div className="money-bills-head">
            <h3 className="db-card-title">Bills this period</h3>
            {fixedBills.length > 0 && <span className={`money-bills-count${paidCount === fixedBills.length ? " is-done" : ""}`}>{paidCount} of {fixedBills.length} paid</span>}
          </div>
          {bills.length === 0 && <p className="money-card-note">No bills fall in this pay period.</p>}
          {fixedBills.length > 0 && (
            <div className="bud-bar" role="progressbar" aria-valuemin={0} aria-valuemax={fixedBills.length} aria-valuenow={paidCount} aria-label="Bills paid">
              <div className="bud-bar-fill" style={{ width: `${paidCount / fixedBills.length * 100}%`, background: "var(--teal)" }} />
            </div>
          )}
          {fixedBills.map((b, i) => {
            const key = `bill:${b.billId}-${b.date}-${i}`;
            const isOpen = openRow === key;
            const payTx = b.matchedTxId ? transactions.find(t => t.id === b.matchedTxId) : null;
            return (
              <div key={key} className={`money-bill${b.paid ? " is-paid" : ""}${i === 0 ? " is-first" : ""}`}>
                <div className="money-bill-row" role="button" tabIndex={0} aria-expanded={isOpen} onClick={() => toggleRow(key)} onKeyDown={onKey(() => toggleRow(key))}>
                  <i className={`fa-solid fa-chevron-${isOpen ? "down" : "right"} bud-chev`} aria-hidden="true" />
                  <div className="money-bill-main">
                    <div className="money-bill-name bud-ellipsis">{b.name}</div>
                    <div className="money-bill-sub">Due {b.date}{b.category ? ` · ${b.category}` : ""}</div>
                  </div>
                  <span className="money-bill-amt">{formatMoney(b.amount)}</span>
                  {b.paid
                    ? <button type="button" className="money-status" onClick={(e) => { e.stopPropagation(); onUnpayBill?.(b.matchedTxId); }} title="Mark as unpaid">Paid</button>
                    : b.autoPay
                      ? <span className="money-status">Auto-pay</span>
                      : <button type="button" className="btn btn-sm" onClick={(e) => { e.stopPropagation(); onPayBill(b); }}>Pay now</button>}
                </div>
                {isOpen && (
                  <div className="bud-drill money-bill-sub">
                    {b.paid
                      ? <span className="money-drill-ok"><i className="fa-solid fa-check" aria-hidden="true" /> Paid {payTx ? `${payTx.date} · ${formatMoney(payTx.amount)}${payTx.description ? ` · ${payTx.description}` : ""}` : "this period"}</span>
                      : <span>Not paid yet. Due {b.date}.</span>}
                  </div>
                )}
              </div>
            );
          })}
          {variableBills.map((b) => {
            const pct = b.budget > 0 ? Math.min(b.spent / b.budget * 100, 100) : 0;
            const over = b.spent > b.budget;
            const key = `varbill:${b.billId}`;
            const isOpen = openRow === key;
            return (
              <div key={key} className="money-bill">
                <div className="money-meter">
                  <div className="money-meter-head">
                    <button type="button" className="money-meter-name is-link" aria-expanded={isOpen} onClick={() => toggleRow(key)}>
                      <i className={`fa-solid fa-chevron-${isOpen ? "down" : "right"} bud-chev`} aria-hidden="true" />{b.name} <span className="bud-tag">{b.category}</span>
                    </button>
                    <span className={`money-meter-nums${over ? " is-over" : ""}`}>{formatMoney(b.spent)} / {formatMoney(b.budget)} ({Math.round(b.budget > 0 ? b.spent / b.budget * 100 : 0)}%)</span>
                  </div>
                  <div className="bud-bar"><div className="bud-bar-fill" style={{ width: `${pct}%`, background: meterFill(pct, over) }} /></div>
                  {over && <div className="bud-over-note">{formatMoney(b.spent - b.budget)} over</div>}
                </div>
                {isOpen && <TxDrill txs={billTx(b.billId)} empty="No transactions tagged to this bill yet. Tag them with “Pays a bill?” when logging." />}
              </div>
            );
          })}
        </div>

        {/* Category budgets (Groceries, Gas, Fun… + variable bills) */}
        <div className="db-card">
          <div className="db-card-header"><h3 className="db-card-title">Category budgets</h3><span className="bud-muted-12">this pay period</span></div>
          {quantBudgets.length === 0 && (
            <p className="money-card-note">Track variable spending (Groceries, Gas, Fun…) here. Add a budget below, or tick “variable” on a bill in Bills &amp; Income.</p>
          )}
          {quantBudgets.map(({ category: cat, budget, spent: spentCat, fromBill, editable }) => {
            const pct = budget > 0 ? Math.min(spentCat / budget * 100, 100) : 0;
            const over = spentCat > budget;
            const key = `cat:${cat}`;
            const isOpen = openRow === key;
            const nums = `${formatMoney(spentCat)} / ${formatMoney(budget)} (${Math.round(budget > 0 ? spentCat / budget * 100 : 0)}%)`;
            return (
              <div key={cat} className="money-meter">
                <div className="money-meter-head">
                  <button type="button" className="money-meter-name is-link" aria-expanded={isOpen} onClick={() => toggleRow(key)}>
                    <i className={`fa-solid fa-chevron-${isOpen ? "down" : "right"} bud-chev`} aria-hidden="true" />{cat}
                    {fromBill && <span className="bud-tag">bill</span>}
                  </button>
                  {editable ? (
                    <button type="button" onClick={() => startEdit(cat)} aria-label={`Edit ${cat} budget: ${nums}`} className={`bud-x money-meter-nums${over ? " is-over" : ""}`}>
                      {nums} <i className="fa-solid fa-pen bud-chev" aria-hidden="true" />
                    </button>
                  ) : (
                    <span className={`money-meter-nums${over ? " is-over" : ""}`}>{nums}</span>
                  )}
                </div>
                <div className="bud-bar"><div className="bud-bar-fill" style={{ width: `${pct}%`, background: meterFill(pct, over) }} /></div>
                {over && <div className="bud-over-note">{formatMoney(spentCat - budget)} over budget</div>}
                {isOpen && <TxDrill txs={catTx(cat)} />}
              </div>
            );
          })}
          {unbudgetedCats.length > 0 && (
            <button type="button" className="btn-sm btn-secondary-sm money-add" onClick={openAddBudget}>
              <i className="fa-solid fa-plus" aria-hidden="true" /> Add category budget
            </button>
          )}
        </div>

        {/* Savings goals — spread a future purchase across paychecks */}
        <div className="db-card">
          <div className="db-card-header">
            <h3 className="db-card-title">Savings goals</h3>
            {savingsThisPeriod > 0 && <span className="money-goal-note">Set aside {formatMoney(savingsThisPeriod)} this paycheque</span>}
          </div>
          {goals.length === 0 && (
            <p className="money-card-note">Saving for something? Add a goal with a target and a date, and you&apos;ll see how much to set aside each paycheque.</p>
          )}
          {goals.map(g => {
            const pct = g.target > 0 ? Math.min(g.saved / g.target * 100, 100) : 0;
            return (
              <div key={g.id} className="money-meter">
                <div className="money-meter-head">
                  <span className="money-meter-name">{g.name}{g.done && <span className="money-status">Funded</span>}</span>
                  <span className="money-meter-nums">{formatMoney(g.saved)} / {formatMoney(g.target)}</span>
                </div>
                <div className="bud-bar"><div className="bud-bar-fill" style={{ width: `${pct}%`, background: g.done ? "var(--teal)" : "var(--sky)" }} /></div>
                <div className="money-meter-foot">
                  <span className={`money-goal-note${g.done ? " is-done" : ""}`}>
                    {g.done
                      ? "Goal reached"
                      : g.periodsLeft > 0
                        ? <><b>{formatMoney(g.perPeriod)}</b> a paycheque · {g.periodsLeft} left · by {g.targetDate}</>
                        : <>Set aside {formatMoney(g.remaining)}. Target date {g.targetDate || "not set"} {g.targetDate && g.targetDate < today ? "(past)" : "(no paydays before it)"}</>}
                  </span>
                  <span className="bud-actions">
                    <button type="button" className="btn-mini" onClick={() => editGoal(g)} aria-label={`Edit ${g.name}`}>Edit</button>
                    <button type="button" className="btn-mini danger" onClick={() => deleteGoal(g.id)} aria-label={`Delete ${g.name}`}>Delete</button>
                  </span>
                </div>
              </div>
            );
          })}
          <button type="button" className="btn-sm btn-secondary-sm money-add" onClick={openNewGoal}>
            <i className="fa-solid fa-plus" aria-hidden="true" /> Add savings goal
          </button>
        </div>

        {/* Category breakdown */}
        {catTotals.length > 0 && (
          <div className="db-card">
            <div className="db-card-header"><h3 className="db-card-title">By category</h3><span className="bud-muted-12">this period</span></div>
            {catTotals.map(([cat, amt], i) => (
              <div key={cat} className="money-cat">
                <div className="money-meter-head">
                  <span className="money-meter-name">{cat}</span>
                  <span className="money-meter-nums">{formatMoney(amt)} · {Math.round(amt / totalSpent * 100)}%</span>
                </div>
                <div className="bud-bar"><div className="bud-bar-fill" style={{ width: `${(amt / maxCat * 100).toFixed(1)}%`, background: `var(--chart-${(i % 5) + 1})` }} /></div>
              </div>
            ))}
          </div>
        )}

        {/* Recent transactions */}
        <div className="db-card">
          <div className="db-card-header"><h3 className="db-card-title">Recent</h3><span className="bud-muted-12">this period</span></div>
          {recent.length === 0
            ? <p className="money-card-note">No transactions this period.</p>
            : recent.map(t => (
              <div key={t.id} className="money-tx">
                <div className="money-tx-main">
                  <div className="money-tx-name">{t.description}</div>
                  <div className="money-tx-sub">{t.category} · {t.date}</div>
                </div>
                <span className={`money-tx-amt t-${t.type}`}>{t.type === "income" ? "+" : "−"}{formatMoneyAbs(t.amount)}</span>
              </div>
            ))}
        </div>
      </div>

      {/* Stat drill-down — the transactions behind a clicked number */}
      {statDrill && (() => {
        const txs = [...(statTx[statDrill] || [])].sort((a, b) => b.date.localeCompare(a.date));
        const total = txs.reduce((s, t) => s + t.amount, 0);
        return (
          <div className="uik-modal-backdrop" onClick={() => setStatDrill(null)}>
            <div className="uik-modal money-dialog" role="dialog" aria-modal="true" aria-label={`${statDrill} transactions`} onClick={e => e.stopPropagation()}>
              <div className="uik-modal-head">
                <div>
                  <div className="bud-caps-label">{statDrill} · {periodLabel}</div>
                  <div className={`money-dialog-total money-kpi-value${drillTone[statDrill] ? ` tone-${drillTone[statDrill]}` : ""}`}>
                    {formatMoney(total)} <span className="money-dialog-count">· {txs.length} transaction{txs.length === 1 ? "" : "s"}</span>
                  </div>
                </div>
                <button type="button" onClick={() => setStatDrill(null)} aria-label="Close" className="uik-modal-x"><i className="fa-solid fa-xmark" aria-hidden="true" /></button>
              </div>
              <div className="uik-modal-body">
                {txs.length === 0
                  ? <p className="money-card-note">No transactions make up this figure for this pay period.</p>
                  : txs.map(t => (
                    <div key={t.id} className="money-tx">
                      <div className="money-tx-main">
                        <div className="money-tx-name">{t.description || t.category || "—"}</div>
                        <div className="money-tx-sub">{t.date}{t.category ? ` · ${t.category}` : ""}{(t.is_bill || t.fulfills_recurring_id) ? " · bill" : ""}</div>
                      </div>
                      <span className="money-tx-amt">{formatMoney(t.amount)}</span>
                    </div>
                  ))}
              </div>
            </div>
          </div>
        );
      })()}
    </div>

    {/* Form modals sit outside .money (a size container). */}
    {budgetForm && (
      <FormModal
        title={budgetForm.mode === "edit" ? `${budgetForm.cat} budget` : "Add category budget"}
        submitLabel={budgetForm.mode === "edit" ? "Save budget" : "Add budget"}
        onClose={closeBudget}
        onSubmit={saveBudget}
        width={420}
        extraActions={budgetForm.mode === "edit" && (
          <button type="button" className="btn btn-secondary money-danger-text" onClick={removeBudget}>Remove budget</button>
        )}
      >
        {budgetForm.mode === "add" && (
          <Field label="Category">
            <select data-autofocus value={budgetForm.cat} onChange={e => setBudgetForm(f => ({ ...f, cat: e.target.value }))}>
              <option value="">Choose a category…</option>
              {unbudgetedCats.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </Field>
        )}
        <Field label="Monthly budget" hint={budgetForm.mode === "edit" ? "Leave empty or 0 to remove this budget." : undefined}>
          <input data-autofocus={budgetForm.mode === "edit" ? true : undefined} type="number" inputMode="decimal" step="0.01" placeholder="$ / month" value={budgetForm.val} onChange={e => setBudgetForm(f => ({ ...f, val: e.target.value }))} />
        </Field>
      </FormModal>
    )}

    {goalOpen && (
      <FormModal
        title={goalEditId ? "Edit savings goal" : "Add savings goal"}
        submitLabel={goalEditId ? "Save changes" : "Add goal"}
        onClose={resetGoal}
        onSubmit={saveGoal}
      >
        <Field label="What for?">
          <input data-autofocus placeholder="e.g. New laptop" value={goalForm.name} onChange={e => setGoalForm(f => ({ ...f, name: e.target.value }))} />
        </Field>
        <div className="money-form-row">
          <Field label="Target">
            <input type="number" inputMode="decimal" step="0.01" placeholder="0.00" value={goalForm.target} onChange={e => setGoalForm(f => ({ ...f, target: e.target.value }))} />
          </Field>
          <Field label="Saved so far">
            <input type="number" inputMode="decimal" step="0.01" placeholder="0.00" value={goalForm.saved} onChange={e => setGoalForm(f => ({ ...f, saved: e.target.value }))} />
          </Field>
        </div>
        <div className="uik-field">
          <span className="field-label">Need it by</span>
          <DatePicker value={goalForm.targetDate} onChange={(v) => setGoalForm(f => ({ ...f, targetDate: v }))} />
        </div>
      </FormModal>
    )}
    </>
  );
}
