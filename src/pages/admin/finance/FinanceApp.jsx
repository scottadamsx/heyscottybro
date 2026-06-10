import { useEffect, useState, useCallback } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  loadAllFinance, generateBillInstances,
  addIncome, setIncomeReceived, deleteIncome,
  addRecurringBill, deleteRecurringBill, addOneOffBill, payBill, unpayBill, deleteBillInstance,
  addExpense, deleteExpense,
  addSavingsGoal, allocateToGoal, deleteSavingsGoal,
  addDebt, recordDebtPayment, deleteDebt,
} from "../../../api/financeApi";
import { computeDashboard, recentTransactions, billState } from "../../../lib/finance/balances";
import { toCents, formatCents, formatSignedCents } from "../../../lib/finance/money";

// Local calendar day/month — toISOString() would give the UTC day, which is
// yesterday during AU mornings.
const todayStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const monthStr = () => todayStr().slice(0, 7) + "-01";

const TABS = [
  { id: "dashboard", label: "dashboard" },
  { id: "income", label: "income" },
  { id: "bills", label: "bills" },
  { id: "expenses", label: "expenses" },
  { id: "savings", label: "savings" },
  { id: "debt", label: "debt" },
];

/* ── tiny form helpers ── */
function useForm(init) {
  const [v, setV] = useState(init);
  const upd = (k) => (e) => {
    const val = e?.target?.type === "checkbox" ? e.target.checked : e?.target?.value;
    setV((s) => ({ ...s, [k]: val }));
  };
  return [v, upd, () => setV(init), setV];
}
const Field = ({ label, children }) => (
  <label className="fin-field"><span>{label}</span>{children}</label>
);
const Progress = ({ value, max, color }) => {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return <div className="fin-progress"><span style={{ width: pct + "%", background: color || "var(--green)" }} /></div>;
};

export default function FinanceApp() {
  const [data, setData] = useState(null);
  const [tab, setTab] = useState("dashboard");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const refresh = useCallback(async () => { setData(await loadAllFinance()); }, []);

  useEffect(() => {
    (async () => {
      try { await generateBillInstances(monthStr()).catch(() => {}); await refresh(); }
      catch (e) { setErr(e.message || "Failed to load finance."); }
      finally { setLoading(false); }
    })();
  }, [refresh]);

  // Returns true on success so callers can decide whether to reset their form.
  const run = async (fn) => {
    setBusy(true); setErr("");
    try { await fn(); await refresh(); return true; }
    catch (e) { setErr(e.message || "Action failed."); return false; }
    finally { setBusy(false); }
  };

  if (loading) return <div className="fin-app"><p className="no-entries">$ loading finance…</p></div>;
  if (err && !data) return <div className="fin-app"><p className="error-message">{err}</p></div>;

  const dash = computeDashboard(data);
  const pos = dash.availableToSpend >= 0;
  const ctx = { data, dash, run, busy };

  return (
    <div className="fin-app">
      {/* sticky header: the number + tabs */}
      <header className="fin-top">
        <div className="fin-top-row">
          <div className="fin-top-label">// available to spend</div>
          <div className={`fin-top-value ${pos ? "pos" : "neg"}`}>{formatSignedCents(dash.availableToSpend)}</div>
        </div>
        <nav className="fin-tabs">
          {TABS.map((t) => (
            <button key={t.id} className={`fin-tab ${tab === t.id ? "active" : ""}`} onClick={() => setTab(t.id)}>
              {t.label}
            </button>
          ))}
        </nav>
      </header>

      {err && <p className="error-message fin-err">{err}</p>}

      {/* view area — only this scrolls */}
      <div className="fin-view">
        <AnimatePresence mode="wait">
          <motion.div key={tab}
            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}>
            {tab === "dashboard" && <DashboardView {...ctx} go={setTab} />}
            {tab === "income" && <IncomeView {...ctx} />}
            {tab === "bills" && <BillsView {...ctx} />}
            {tab === "expenses" && <ExpensesView {...ctx} />}
            {tab === "savings" && <SavingsView {...ctx} />}
            {tab === "debt" && <DebtView {...ctx} />}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}

/* ════════════ DASHBOARD ════════════ */
function DashboardView({ data, dash, run, busy }) {
  const upcoming = data.billInstances.filter((b) => !b.paid).sort((a, b) => a.due_date.localeCompare(b.due_date)).slice(0, 6);
  const recent = recentTransactions(data, 7);
  const kpis = [
    { k: "current cash", v: dash.currentCash },
    { k: "bills remaining", v: dash.billsRemaining },
    { k: "savings reserved", v: dash.reservedSavings },
    { k: "future income", v: dash.futureIncome },
  ];
  return (
    <div className="fin-grid">
      <div className="fin-kpi-grid col-12">
        {kpis.map((kp) => (
          <div className="db-card fin-kpi" key={kp.k}>
            <div className="fin-kpi-label">{kp.k}</div>
            <div className="fin-kpi-value">{formatCents(kp.v)}</div>
          </div>
        ))}
      </div>
      <div className="db-card col-7">
        <h3 className="db-card-title">upcoming bills</h3>
        <div className="db-list">
          {upcoming.length === 0 && <p className="no-entries">All clear.</p>}
          {upcoming.map((b) => {
            const st = billState(b, dash.today);
            return (
              <div className="db-list-item" key={b.id}>
                <div className="db-list-item-content">
                  <div className="db-list-item-title">{b.name}</div>
                  <div className="db-list-item-subtitle">due {b.due_date}
                    {st === "overdue" && <span className="bill-badge overdue"> · overdue</span>}
                    {st === "due_soon" && <span className="bill-badge due-soon"> · due soon</span>}
                  </div>
                </div>
                <div className="fin-bill-right">
                  <span className="fin-amt">{formatCents(b.amount)}</span>
                  <button className="btn btn-sm fin-pay" disabled={busy} onClick={() => run(() => payBill(b.id))}>pay</button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
      <div className="db-card col-5">
        <h3 className="db-card-title">recent transactions</h3>
        <div className="db-list">
          {recent.length === 0 && <p className="no-entries">No activity.</p>}
          {recent.map((t) => (
            <div className="db-list-item" key={t.id}>
              <div className="db-list-item-content">
                <div className="db-list-item-title">{t.label}</div>
                <div className="db-list-item-subtitle">{t.date} · {t.kind}</div>
              </div>
              <span className={`fin-amt ${t.amount >= 0 ? "pos" : "neg"}`}>{formatSignedCents(t.amount)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ════════════ INCOME ════════════ */
function IncomeView({ data, run, busy }) {
  const [f, upd, reset] = useForm({ amount: "", pay_date: todayStr(), source: "", notes: "", received: false });
  const submit = (e) => { e.preventDefault(); if (!(Number(f.amount) > 0)) return;
    run(() => addIncome({ amount: toCents(f.amount), payDate: f.pay_date, source: f.source, notes: f.notes, received: f.received })).then((ok) => ok && reset()); };
  const list = [...data.income].sort((a, b) => b.pay_date.localeCompare(a.pay_date));
  return (
    <div className="fin-grid">
      <form className="db-card col-5 fin-form" onSubmit={submit}>
        <h3 className="db-card-title">add income</h3>
        <Field label="amount ($)"><input type="number" step="0.01" min="0" value={f.amount} onChange={upd("amount")} required /></Field>
        <Field label="pay date"><input type="date" value={f.pay_date} onChange={upd("pay_date")} /></Field>
        <Field label="source"><input value={f.source} onChange={upd("source")} placeholder="Paycheque" /></Field>
        <Field label="notes"><input value={f.notes} onChange={upd("notes")} /></Field>
        <label className="fin-check"><input type="checkbox" checked={f.received} onChange={upd("received")} /> already received</label>
        <button className="btn" disabled={busy}>+ add income</button>
      </form>
      <div className="db-card col-7">
        <h3 className="db-card-title">income ({list.length})</h3>
        <div className="db-list">
          {list.map((i) => (
            <div className="db-list-item" key={i.id}>
              <div className="db-list-item-content">
                <div className="db-list-item-title">{i.source || "Income"}</div>
                <div className="db-list-item-subtitle">{i.pay_date} · reserve {formatCents(i.savings_reserved)}</div>
              </div>
              <div className="fin-bill-right">
                <span className="fin-amt pos">{formatCents(i.amount)}</span>
                <button className={`btn btn-sm ${i.received ? "fin-pay" : "btn-secondary-sm"}`} disabled={busy}
                  onClick={() => run(() => setIncomeReceived(i.id, !i.received))}>
                  {i.received ? "received" : "pending"}
                </button>
                <button className="fin-x" disabled={busy} onClick={() => run(() => deleteIncome(i.id))} aria-label="delete">×</button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ════════════ BILLS ════════════ */
function BillsView({ data, dash, run, busy }) {
  const cats = data.categories.filter((c) => c.kind === "expense");
  const [f, upd, reset] = useForm({ name: "", amount: "", due_day: "1", category_id: "", autopay: false });
  const submit = (e) => { e.preventDefault(); if (!f.name || !(Number(f.amount) > 0)) return;
    run(() => addRecurringBill({ name: f.name, amount: toCents(f.amount), due_day: Number(f.due_day), category_id: f.category_id || null, autopay: f.autopay, active: true, start_date: todayStr() })).then((ok) => ok && reset()); };
  const instances = [...data.billInstances].sort((a, b) => a.due_date.localeCompare(b.due_date));
  return (
    <div className="fin-grid">
      <form className="db-card col-5 fin-form" onSubmit={submit}>
        <h3 className="db-card-title">add recurring bill</h3>
        <Field label="name"><input value={f.name} onChange={upd("name")} required /></Field>
        <Field label="amount ($)"><input type="number" step="0.01" min="0" value={f.amount} onChange={upd("amount")} required /></Field>
        <Field label="due day (1–31)"><input type="number" min="1" max="31" value={f.due_day} onChange={upd("due_day")} /></Field>
        <Field label="category">
          <select value={f.category_id} onChange={upd("category_id")}>
            <option value="">—</option>
            {cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </Field>
        <label className="fin-check"><input type="checkbox" checked={f.autopay} onChange={upd("autopay")} /> autopay</label>
        <button className="btn" disabled={busy}>+ add bill</button>
        <button type="button" className="btn btn-secondary-sm" disabled={busy} onClick={() => run(() => generateBillInstances(monthStr()))}>generate this month</button>
      </form>
      <div className="db-card col-7">
        <h3 className="db-card-title">bill instances ({instances.length})</h3>
        <div className="db-list">
          {instances.map((b) => {
            const st = billState(b, dash.today);
            return (
              <div className="db-list-item" key={b.id}>
                <div className="db-list-item-content">
                  <div className="db-list-item-title">{b.name}{b.paid && <span className="bill-badge"> · paid</span>}
                    {st === "overdue" && <span className="bill-badge overdue"> · overdue</span>}
                    {st === "due_soon" && <span className="bill-badge due-soon"> · due soon</span>}
                  </div>
                  <div className="db-list-item-subtitle">due {b.due_date}</div>
                </div>
                <div className="fin-bill-right">
                  <span className="fin-amt">{formatCents(b.amount)}</span>
                  <button className={`btn btn-sm ${b.paid ? "btn-secondary-sm" : "fin-pay"}`} disabled={busy}
                    onClick={() => run(() => (b.paid ? unpayBill(b.id) : payBill(b.id)))}>{b.paid ? "unpay" : "pay"}</button>
                  <button className="fin-x" disabled={busy} onClick={() => run(() => deleteBillInstance(b.id))} aria-label="delete">×</button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ════════════ EXPENSES ════════════ */
function ExpensesView({ data, run, busy }) {
  const cats = data.categories.filter((c) => c.kind === "expense");
  const [q, setQ] = useState("");
  const [catFilter, setCatFilter] = useState("");
  const [f, upd, reset] = useForm({ amount: "", date: todayStr(), category_id: "", description: "" });
  const submit = (e) => { e.preventDefault(); if (!(Number(f.amount) > 0)) return;
    run(() => addExpense({ amount: toCents(f.amount), date: f.date, categoryId: f.category_id || null, description: f.description })).then((ok) => ok && reset()); };
  const catName = (id) => cats.find((c) => c.id === id)?.name || "—";
  const list = data.expenses
    .filter((e) => !q || (e.description || "").toLowerCase().includes(q.toLowerCase()))
    .filter((e) => !catFilter || e.category_id === catFilter)
    .sort((a, b) => b.date.localeCompare(a.date));
  return (
    <div className="fin-grid">
      <form className="db-card col-5 fin-form" onSubmit={submit}>
        <h3 className="db-card-title">log expense</h3>
        <Field label="amount ($)"><input type="number" step="0.01" min="0" value={f.amount} onChange={upd("amount")} required /></Field>
        <Field label="date"><input type="date" value={f.date} onChange={upd("date")} /></Field>
        <Field label="category">
          <select value={f.category_id} onChange={upd("category_id")}>
            <option value="">—</option>{cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </Field>
        <Field label="description"><input value={f.description} onChange={upd("description")} /></Field>
        <button className="btn" disabled={busy}>+ log expense</button>
      </form>
      <div className="db-card col-7">
        <div className="db-card-header">
          <h3 className="db-card-title">expenses ({list.length})</h3>
        </div>
        <div className="fin-filters">
          <input placeholder="search…" value={q} onChange={(e) => setQ(e.target.value)} />
          <select value={catFilter} onChange={(e) => setCatFilter(e.target.value)}>
            <option value="">all categories</option>{cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div className="db-list">
          {list.length === 0 && <p className="no-entries">No expenses.</p>}
          {list.map((e) => (
            <div className="db-list-item" key={e.id}>
              <div className="db-list-item-content">
                <div className="db-list-item-title">{e.description || "Expense"}</div>
                <div className="db-list-item-subtitle">{e.date} · {catName(e.category_id)}</div>
              </div>
              <div className="fin-bill-right">
                <span className="fin-amt neg">−{formatCents(e.amount)}</span>
                <button className="fin-x" disabled={busy} onClick={() => run(() => deleteExpense(e.id))} aria-label="delete">×</button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ════════════ SAVINGS ════════════ */
function SavingsView({ data, dash, run, busy }) {
  const [f, upd, reset] = useForm({ name: "", target_amount: "", target_date: "" });
  const submit = (e) => { e.preventDefault(); if (!f.name || !(Number(f.target_amount) > 0)) return;
    run(() => addSavingsGoal({ name: f.name, target_amount: toCents(f.target_amount), target_date: f.target_date || null, color: "#4ade80" })).then((ok) => ok && reset()); };
  return (
    <div className="fin-grid">
      <div className="db-card col-12 fin-pool">
        <span className="fin-kpi-label">reserve pool available</span>
        <span className="fin-kpi-value">{formatCents(dash.reservePool)}</span>
      </div>
      <form className="db-card col-5 fin-form" onSubmit={submit}>
        <h3 className="db-card-title">new goal</h3>
        <Field label="name"><input value={f.name} onChange={upd("name")} required /></Field>
        <Field label="target ($)"><input type="number" step="0.01" min="0" value={f.target_amount} onChange={upd("target_amount")} required /></Field>
        <Field label="target date"><input type="date" value={f.target_date} onChange={upd("target_date")} /></Field>
        <button className="btn" disabled={busy}>+ add goal</button>
      </form>
      <div className="db-card col-7">
        <h3 className="db-card-title">goals ({data.savingsGoals.length})</h3>
        <div className="db-list">
          {data.savingsGoals.length === 0 && <p className="no-entries">No goals yet.</p>}
          {data.savingsGoals.map((g) => (
            <div className="fin-goal" key={g.id}>
              <div className="fin-goal-head">
                <span className="db-list-item-title">{g.name}</span>
                <span className="fin-amt">{formatCents(g.current_amount)} / {formatCents(g.target_amount)}</span>
              </div>
              <Progress value={g.current_amount} max={g.target_amount} color={g.color} />
              <div className="fin-goal-actions">
                <AllocateBox goalId={g.id} run={run} busy={busy} />
                <button className="fin-x" disabled={busy} onClick={() => run(() => deleteSavingsGoal(g.id))} aria-label="delete">×</button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
function AllocateBox({ goalId, run, busy }) {
  const [amt, setAmt] = useState("");
  return (
    <div className="fin-inline">
      <input type="number" step="0.01" min="0" placeholder="$" value={amt} onChange={(e) => setAmt(e.target.value)} />
      <button className="btn btn-sm fin-pay" disabled={busy || !(Number(amt) > 0)}
        onClick={() => run(() => allocateToGoal(goalId, toCents(amt), "pool")).then((ok) => ok && setAmt(""))}>allocate</button>
    </div>
  );
}

/* ════════════ DEBT ════════════ */
function DebtView({ data, run, busy }) {
  const [f, upd, reset] = useForm({ name: "", kind: "loan", original_balance: "", apr: "", minimum_payment: "", due_day: "" });
  const submit = (e) => { e.preventDefault(); if (!f.name || !(Number(f.original_balance) > 0)) return;
    run(() => addDebt({ name: f.name, kind: f.kind, original_balance: toCents(f.original_balance), current_balance: toCents(f.original_balance),
      apr: Number(f.apr) || 0, minimum_payment: toCents(f.minimum_payment || 0), due_day: f.due_day ? Number(f.due_day) : null })).then((ok) => ok && reset()); };
  return (
    <div className="fin-grid">
      <form className="db-card col-5 fin-form" onSubmit={submit}>
        <h3 className="db-card-title">add debt</h3>
        <Field label="name"><input value={f.name} onChange={upd("name")} required /></Field>
        <Field label="type">
          <select value={f.kind} onChange={upd("kind")}><option value="loan">loan</option><option value="credit_card">credit card</option></select>
        </Field>
        <Field label="balance ($)"><input type="number" step="0.01" min="0" value={f.original_balance} onChange={upd("original_balance")} required /></Field>
        <Field label="APR (%)"><input type="number" step="0.01" min="0" value={f.apr} onChange={upd("apr")} /></Field>
        <Field label="min payment ($)"><input type="number" step="0.01" min="0" value={f.minimum_payment} onChange={upd("minimum_payment")} /></Field>
        <button className="btn" disabled={busy}>+ add debt</button>
      </form>
      <div className="db-card col-7">
        <h3 className="db-card-title">debts ({data.debts.length})</h3>
        <div className="db-list">
          {data.debts.length === 0 && <p className="no-entries">Debt-free. 🎉</p>}
          {data.debts.map((d) => (
            <div className="fin-goal" key={d.id}>
              <div className="fin-goal-head">
                <span className="db-list-item-title">{d.name} <span className="bill-badge">· {d.kind.replace("_", " ")}</span></span>
                <span className="fin-amt neg">{formatCents(d.current_balance)} left</span>
              </div>
              <Progress value={d.original_balance - d.current_balance} max={d.original_balance} color="#ff7a66" />
              <div className="fin-goal-actions">
                <PayBox debtId={d.id} run={run} busy={busy} />
                <button className="fin-x" disabled={busy} onClick={() => run(() => deleteDebt(d.id))} aria-label="delete">×</button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
function PayBox({ debtId, run, busy }) {
  const [amt, setAmt] = useState("");
  return (
    <div className="fin-inline">
      <input type="number" step="0.01" min="0" placeholder="$ payment" value={amt} onChange={(e) => setAmt(e.target.value)} />
      <button className="btn btn-sm fin-pay" disabled={busy || !(Number(amt) > 0)}
        onClick={() => run(() => recordDebtPayment(debtId, { amount: toCents(amt), principal: toCents(amt) })).then((ok) => ok && setAmt(""))}>pay</button>
    </div>
  );
}
