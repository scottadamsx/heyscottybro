import { useEffect, useMemo, useState } from "react";
import {
  loadBudgetConfig, loadTransactions, saveBudgetConfig,
  newTransaction, updateTransaction, deleteTransaction,
  linkTransactionToRecurring, linkTransactionToIncome,
  addRecurringBill, updateRecurringBill, deleteRecurringBill,
  addIncomeSource, updateIncomeSource, deleteIncomeSource,
} from "../../api/plannerApi";
import { formatMoney, toDateStr } from "../../utils/plannerUtils";
import { buildProjection, defaultHorizon, onTrackStatus, narrativeFor } from "../../lib/budgetProjection";
import ProjectionChart from "../../components/budget/ProjectionChart";
import MonthBreakdown from "../../components/budget/MonthBreakdown";
import RecurringCard from "../../components/budget/RecurringCard";
import BudgetVsActual from "../../components/budget/BudgetVsActual";
import WeeklyTracker from "../../components/budget/WeeklyTracker";

const HORIZON = defaultHorizon("2026-04", 9);
const newTxDefaults = () => ({ description: "", amount: "", type: "expense", category: "Other", date: toDateStr(new Date()), notes: "", fulfills_recurring_id: null, fulfills_income_id: null });

export default function BudgetPage() {
  const [config, setConfig] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [selectedMonth, setSelectedMonth] = useState(null);
  const [tx, setTx] = useState(newTxDefaults());
  const [billForm, setBillForm] = useState({ name: "", amount: "", category: "Other", startDate: toDateStr(new Date()), endDate: "", notes: "" });
  const [incForm, setIncForm] = useState({ name: "", amount: "", startDate: toDateStr(new Date()), endDate: "", notes: "" });
  const [showNarrative, setShowNarrative] = useState(false);

  // What-if controls (in-memory overrides, not persisted unless user clicks Save)
  const [whatIf, setWhatIf] = useState(null); // { contractTotal, hourlyRate, hoursPerWeek, taxRate, startingBalance }

  const load = async () => {
    const [cfg, txs] = await Promise.all([
      loadBudgetConfig().catch(() => null),
      loadTransactions().catch(() => []),
    ]);
    setConfig(cfg);
    setTransactions(txs);
    if (cfg && !whatIf) {
      const contract = cfg.incomeSources?.find(s => s.id === "inc-contract");
      const salary = cfg.incomeSources?.find(s => s.id === "inc-salary");
      setWhatIf({
        contractTotal: contract ? +(contract.amount * 4 / (1 - cfg.taxRate)).toFixed(2) : 15000,
        hourlyRate: 24,
        hoursPerWeek: 40,
        taxRate: cfg.taxRate ?? 0.18,
        startingBalance: cfg.startingBalance ?? 0,
      });
    }
  };

  useEffect(() => { load(); }, []);

  // Derive the projection — uses what-if overrides if edited.
  const projection = useMemo(() => {
    if (!config) return [];
    // Apply what-if deltas to income sources (non-destructive)
    let sources = config.incomeSources || [];
    if (whatIf) {
      sources = sources.map(s => {
        if (s.id === "inc-contract") {
          const net = (Number(whatIf.contractTotal) / 4) * (1 - Number(whatIf.taxRate));
          return { ...s, amount: +net.toFixed(2) };
        }
        if (s.id === "inc-salary") {
          const gross = Number(whatIf.hourlyRate) * Number(whatIf.hoursPerWeek) * 4.33;
          const net = gross * (1 - Number(whatIf.taxRate));
          return { ...s, amount: +net.toFixed(2) };
        }
        return s;
      });
    }
    return buildProjection({
      transactions,
      incomeSources: sources,
      recurringBills: config.recurringBills || [],
      startingBalance: whatIf?.startingBalance ?? config.startingBalance ?? 0,
      horizonMonths: HORIZON,
      today: new Date(),
    });
  }, [config, transactions, whatIf]);

  const status = useMemo(() => projection.length ? onTrackStatus(projection) : null, [projection]);

  const heroStats = useMemo(() => {
    if (!projection.length) return null;
    const current = projection.find(p => p.isCurrent) || projection[0];
    const todayStr = toDateStr(new Date());
    const pastTxSum = transactions
      .filter(t => t.date <= todayStr)
      .reduce((s, t) => s + Number(t.amount || 0), 0);
    const currentBalance = (whatIf?.startingBalance ?? config?.startingBalance ?? 0) + pastTxSum;
    const thisMonthNet = current.net;
    const projectedEnd = projection[projection.length - 1].closingBalance;
    return { currentBalance, thisMonthNet, projectedEnd, currentMonth: current };
  }, [projection, transactions, config, whatIf]);

  // ── Transaction handlers
  const addTx = async (e) => {
    e.preventDefault();
    if (!tx.description.trim() || !tx.date || Number(tx.amount) <= 0) return;
    await newTransaction({ ...tx, amount: Number(tx.amount) });
    setTx(newTxDefaults());
    await load();
  };

  const handleUpdateTx = async (id, draft) => {
    await updateTransaction(id, { ...draft, amount: Number(draft.amount) });
    await load();
  };

  const handleDeleteTx = async (id) => {
    await deleteTransaction(id);
    await load();
  };

  const handleLogBill = async (bill, date) => {
    await newTransaction({
      description: bill.name,
      amount: Math.abs(Number(bill.amount)),
      type: "expense",
      category: bill.category || "Other",
      date,
      notes: "Auto-logged from scheduled",
      fulfills_recurring_id: bill.id,
    });
    await load();
  };

  const handleQuickLogCategory = (category) => {
    setTx({
      ...newTxDefaults(),
      type: "expense",
      category,
      date: toDateStr(new Date()),
    });
    setTimeout(() => {
      document.getElementById("bud-add-tx")?.scrollIntoView({ behavior: "smooth", block: "center" });
      document.querySelector("#bud-add-tx input")?.focus();
    }, 50);
  };

  const handleLogFromSource = async (source, kind, monthKey) => {
    // Pre-fill the transaction form with the source's data and fulfills link.
    const [y, m] = monthKey.split("-").map(Number);
    const firstOfMonth = `${y}-${String(m).padStart(2, "0")}-01`;
    setTx({
      description: source.name,
      amount: Math.abs(source.amount),
      type: kind === "income" ? "income" : "expense",
      category: source.category || "Other",
      date: firstOfMonth,
      notes: "",
      fulfills_recurring_id: kind === "recurring" ? source.id : null,
      fulfills_income_id: kind === "income" ? source.id : null,
    });
    // Scroll to form
    setTimeout(() => document.getElementById("bud-add-tx")?.scrollIntoView({ behavior: "smooth", block: "center" }), 50);
  };

  // ── Recurring bill handlers
  const addBill = async (e) => {
    e.preventDefault();
    if (!billForm.name.trim() || Number(billForm.amount) <= 0) return;
    await addRecurringBill({
      ...billForm,
      amount: Number(billForm.amount),
      endDate: billForm.endDate || null,
      autoPay: false,
    });
    setBillForm({ name: "", amount: "", category: config?.categories?.[0] || "Other", startDate: toDateStr(new Date()), endDate: "", notes: "" });
    await load();
  };

  const addInc = async (e) => {
    e.preventDefault();
    if (!incForm.name.trim() || Number(incForm.amount) <= 0) return;
    await addIncomeSource({
      ...incForm,
      amount: Number(incForm.amount),
      endDate: incForm.endDate || null,
    });
    setIncForm({ name: "", amount: "", startDate: toDateStr(new Date()), endDate: "", notes: "" });
    await load();
  };

  // ── What-if controls
  const saveBaseline = async () => {
    if (!config || !whatIf) return;
    const updated = {
      ...config,
      taxRate: Number(whatIf.taxRate),
      startingBalance: Number(whatIf.startingBalance),
      incomeSources: config.incomeSources.map(s => {
        if (s.id === "inc-contract") {
          const net = (Number(whatIf.contractTotal) / 4) * (1 - Number(whatIf.taxRate));
          return { ...s, amount: +net.toFixed(2) };
        }
        if (s.id === "inc-salary") {
          const gross = Number(whatIf.hourlyRate) * Number(whatIf.hoursPerWeek) * 4.33;
          const net = gross * (1 - Number(whatIf.taxRate));
          return { ...s, amount: +net.toFixed(2) };
        }
        return s;
      }),
    };
    await saveBudgetConfig(updated);
    await load();
  };

  const resetWhatIf = async () => {
    setWhatIf(null);
    await load();
  };

  const selected = projection.find(p => p.key === selectedMonth);

  if (!config) {
    return <div className="module-page"><div className="module-header"><h1>Budget</h1></div><p>Loading…</p></div>;
  }

  return (
    <div className="module-page bud">
      <div className="module-header">
        <h1>Budget <span className="bud-period-label">· Apr–Dec 2026</span></h1>
      </div>

      {/* ── This Week tracker */}
      <WeeklyTracker
        transactions={transactions}
        recurringBills={config.recurringBills || []}
        categories={config.categories}
        onQuickLog={handleQuickLogCategory}
        onUpdateTx={handleUpdateTx}
        onDeleteTx={handleDeleteTx}
        onLogBill={handleLogBill}
      />

      {/* ── Hero strip */}
      {heroStats && (
        <div className="bud-hero">
          <div className="bud-hero-card">
            <div className="bud-hero-label">Current balance</div>
            <div className="bud-hero-value">{formatMoney(heroStats.currentBalance)}</div>
          </div>
          <div className="bud-hero-card">
            <div className="bud-hero-label">This month net</div>
            <div className="bud-hero-value" style={{ color: heroStats.thisMonthNet >= 0 ? "var(--bud-green)" : "var(--bud-red)" }}>
              {heroStats.thisMonthNet >= 0 ? "+" : "-"}{formatMoney(heroStats.thisMonthNet)}
            </div>
          </div>
          <div className="bud-hero-card">
            <div className="bud-hero-label">Projected end of Dec</div>
            <div className="bud-hero-value" style={{ color: "var(--bud-gold)" }}>{formatMoney(heroStats.projectedEnd)}</div>
          </div>
          {status && <div className="bud-status-line">{status.label}</div>}
        </div>
      )}

      {/* ── Projection chart */}
      <div className="db-card">
        <h3 className="db-card-title">9-month projection</h3>
        <ProjectionChart
          projection={projection}
          selectedKey={selectedMonth}
          onSelect={(k) => setSelectedMonth(selectedMonth === k ? null : k)}
        />
        {selected && (
          <MonthBreakdown
            month={selected}
            categories={config.categories}
            onUpdateTx={handleUpdateTx}
            onDeleteTx={handleDeleteTx}
            onLogFromSource={handleLogFromSource}
          />
        )}
      </div>

      {/* ── What-if controls */}
      <div className="db-card">
        <h3 className="db-card-title">Projection controls <span className="bud-muted" style={{ fontWeight: 400, fontSize: "0.78rem" }}>— experiment without saving</span></h3>
        {whatIf && (
          <div className="bud-whatif">
            <label className="bud-mini-label">
              Contract total (May–Aug, gross)
              <input type="number" step="100" value={whatIf.contractTotal} onChange={e => setWhatIf({ ...whatIf, contractTotal: e.target.value })} />
              <span className="bud-muted">÷4 · net/mo: ${((Number(whatIf.contractTotal) / 4) * (1 - Number(whatIf.taxRate))).toFixed(2)}</span>
            </label>
            <label className="bud-mini-label">
              Phase 2 hourly rate
              <input type="number" step="0.5" value={whatIf.hourlyRate} onChange={e => setWhatIf({ ...whatIf, hourlyRate: e.target.value })} />
            </label>
            <label className="bud-mini-label">
              Phase 2 hrs/week
              <input type="number" step="1" value={whatIf.hoursPerWeek} onChange={e => setWhatIf({ ...whatIf, hoursPerWeek: e.target.value })} />
              <span className="bud-muted">net/mo: ${(Number(whatIf.hourlyRate) * Number(whatIf.hoursPerWeek) * 4.33 * (1 - Number(whatIf.taxRate))).toFixed(2)}</span>
            </label>
            <label className="bud-mini-label">
              Tax rate
              <input type="number" step="0.01" min="0" max="1" value={whatIf.taxRate} onChange={e => setWhatIf({ ...whatIf, taxRate: e.target.value })} />
            </label>
            <label className="bud-mini-label">
              Starting balance
              <input type="number" step="100" value={whatIf.startingBalance} onChange={e => setWhatIf({ ...whatIf, startingBalance: e.target.value })} />
            </label>
            <div className="bud-whatif-actions">
              <button type="button" className="btn" onClick={saveBaseline}><i className="fa-solid fa-save" /> Save as baseline</button>
              <button type="button" className="btn-secondary" onClick={resetWhatIf}>Reset to saved</button>
            </div>
          </div>
        )}
      </div>

      {/* ── Add transaction */}
      <div className="db-card" id="bud-add-tx">
        <h3 className="db-card-title">Log transaction</h3>
        {(tx.fulfills_recurring_id || tx.fulfills_income_id) && (
          <div className="bud-link-banner">
            <i className="fa-solid fa-link" /> Linked to recurring source — logging this will clear it from projections for this month.
            <button type="button" className="btn-mini muted" onClick={() => setTx({ ...tx, fulfills_recurring_id: null, fulfills_income_id: null })}>Unlink</button>
          </div>
        )}
        <form className="form-card" onSubmit={addTx} style={{ border: "none", padding: 0, background: "none" }}>
          <div className="form-row">
            <input placeholder="Description" value={tx.description} onChange={(e) => setTx({ ...tx, description: e.target.value })} required />
            <input type="number" placeholder="Amount" min="0.01" step="0.01" value={tx.amount} onChange={(e) => setTx({ ...tx, amount: e.target.value })} required />
          </div>
          <div className="form-row">
            <select value={tx.type} onChange={(e) => setTx({ ...tx, type: e.target.value })}>
              <option value="expense">Expense</option>
              <option value="income">Income</option>
            </select>
            <select value={tx.category} onChange={(e) => setTx({ ...tx, category: e.target.value })}>
              {config.categories.map((c) => <option key={c}>{c}</option>)}
            </select>
            <input type="date" value={tx.date} onChange={(e) => setTx({ ...tx, date: e.target.value })} required />
          </div>
          <button className="btn" type="submit"><i className="fa-solid fa-plus" /> Add</button>
        </form>
      </div>

      {/* ── Recurring bills */}
      <div className="db-card">
        <h3 className="db-card-title">Recurring bills</h3>
        <div className="bud-card-grid">
          {(config.recurringBills || []).map(b => (
            <RecurringCard key={b.id} item={b} kind="bill" categories={config.categories}
              onUpdate={async (id, u) => { await updateRecurringBill(id, u); await load(); }}
              onDelete={async (id) => { await deleteRecurringBill(id); await load(); }}
            />
          ))}
        </div>
        <form className="form-card bud-add-form" onSubmit={addBill}>
          <div className="form-row">
            <input placeholder="Bill name" value={billForm.name} onChange={(e) => setBillForm({ ...billForm, name: e.target.value })} required />
            <input type="number" placeholder="Amount" min="0.01" step="0.01" value={billForm.amount} onChange={(e) => setBillForm({ ...billForm, amount: e.target.value })} required />
            <select value={billForm.category} onChange={(e) => setBillForm({ ...billForm, category: e.target.value })}>
              {config.categories.map((c) => <option key={c}>{c}</option>)}
            </select>
          </div>
          <div className="form-row">
            <label className="bud-mini-label">Start<input type="date" value={billForm.startDate} onChange={(e) => setBillForm({ ...billForm, startDate: e.target.value })} /></label>
            <label className="bud-mini-label">End (optional)<input type="date" value={billForm.endDate} onChange={(e) => setBillForm({ ...billForm, endDate: e.target.value })} /></label>
            <button className="btn" type="submit">Add bill</button>
          </div>
        </form>
      </div>

      {/* ── Income sources */}
      <div className="db-card">
        <h3 className="db-card-title">Income sources</h3>
        <div className="bud-card-grid">
          {(config.incomeSources || []).map(s => (
            <RecurringCard key={s.id} item={s} kind="income" categories={config.categories}
              onUpdate={async (id, u) => { await updateIncomeSource(id, u); await load(); }}
              onDelete={async (id) => { await deleteIncomeSource(id); await load(); }}
            />
          ))}
        </div>
        <form className="form-card bud-add-form" onSubmit={addInc}>
          <div className="form-row">
            <input placeholder="Income name" value={incForm.name} onChange={(e) => setIncForm({ ...incForm, name: e.target.value })} required />
            <input type="number" placeholder="Net / month" min="0.01" step="0.01" value={incForm.amount} onChange={(e) => setIncForm({ ...incForm, amount: e.target.value })} required />
          </div>
          <div className="form-row">
            <label className="bud-mini-label">Start<input type="date" value={incForm.startDate} onChange={(e) => setIncForm({ ...incForm, startDate: e.target.value })} /></label>
            <label className="bud-mini-label">End (optional)<input type="date" value={incForm.endDate} onChange={(e) => setIncForm({ ...incForm, endDate: e.target.value })} /></label>
            <button className="btn" type="submit">Add income</button>
          </div>
        </form>
      </div>

      {/* ── Budget vs Actual */}
      <div className="db-card">
        <h3 className="db-card-title">Budget vs actual <span className="bud-muted" style={{ fontWeight: 400, fontSize: "0.78rem" }}>— past + current only</span></h3>
        <BudgetVsActual projection={projection} recurringBills={config.recurringBills || []} />
      </div>

      {/* ── Narrative */}
      <div className="db-card">
        <button type="button" className="bud-narrative-toggle" onClick={() => setShowNarrative(v => !v)}>
          <i className={`fa-solid ${showNarrative ? "fa-chevron-down" : "fa-chevron-right"}`} />
          Read the plan
        </button>
        {showNarrative && (
          <div className="bud-narrative">
            {narrativeFor(projection).map((line, i) => (
              <p key={i}>{line}</p>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
