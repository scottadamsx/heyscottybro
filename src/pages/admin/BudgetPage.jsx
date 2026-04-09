import { useEffect, useMemo, useState } from "react";
import { loadBudgetConfig, loadTransactions, newTransaction, addIncome, addRecurringBill } from "../../api/plannerApi";
import { formatMoney, toDateStr } from "../../utils/plannerUtils";

const txDefaults = { description: "", amount: "", type: "expense", category: "Other", date: toDateStr(new Date()), notes: "" };

export default function BudgetPage() {
  const [config, setConfig] = useState({ categories: [], income: [], recurringBills: [] });
  const [transactions, setTransactions] = useState([]);
  const [tx, setTx] = useState(txDefaults);
  const [incomeForm, setIncomeForm] = useState({ name: "", amount: "", frequency: "biweekly", nextDate: toDateStr(new Date()) });
  const [billForm, setBillForm] = useState({ name: "", amount: "", category: "Other", frequency: "monthly", startDate: toDateStr(new Date()), autoPay: true, notes: "" });

  const load = async () => {
    const [cfg, txs] = await Promise.all([loadBudgetConfig(), loadTransactions()]);
    setConfig(cfg);
    setTransactions(txs);
    setTx((prev) => ({ ...prev, category: cfg.categories?.[0] || "Other" }));
    setBillForm((prev) => ({ ...prev, category: cfg.categories?.[0] || "Other" }));
  };

  useEffect(() => { load(); }, []);

  const totals = useMemo(() => {
    const income = transactions.filter((t) => t.type === "income").reduce((s, t) => s + Number(t.amount || 0), 0);
    const spent = transactions.filter((t) => t.type === "expense").reduce((s, t) => s + Number(t.amount || 0), 0);
    const planned = transactions.filter((t) => t.type === "future").reduce((s, t) => s + Number(t.amount || 0), 0);
    return { income, spent, planned, remaining: income - spent - planned };
  }, [transactions]);

  const addTx = async (e) => {
    e.preventDefault();
    if (!tx.description.trim() || !tx.date || Number(tx.amount) <= 0) return;
    await newTransaction({ ...tx, amount: Number(tx.amount) });
    setTx({ ...txDefaults, category: config.categories?.[0] || "Other" });
    await load();
  };

  const addInc = async (e) => {
    e.preventDefault();
    if (!incomeForm.name.trim() || Number(incomeForm.amount) <= 0) return;
    await addIncome({ ...incomeForm, amount: Number(incomeForm.amount) });
    setIncomeForm({ name: "", amount: "", frequency: "biweekly", nextDate: toDateStr(new Date()) });
    await load();
  };

  const addBill = async (e) => {
    e.preventDefault();
    if (!billForm.name.trim() || Number(billForm.amount) <= 0) return;
    await addRecurringBill({ ...billForm, amount: Number(billForm.amount) });
    setBillForm({ ...billForm, name: "", amount: "", startDate: toDateStr(new Date()), notes: "" });
    await load();
  };

  return (
    <div className="module-page">
      <div className="module-header">
        <h1>Budget</h1>
      </div>

      {/* Totals */}
      <div className="budget-totals">
        <div className="budget-total-card">
          <div className="budget-total-label">Income</div>
          <div className="budget-total-value income-val">{formatMoney(totals.income)}</div>
        </div>
        <div className="budget-total-card">
          <div className="budget-total-label">Spent</div>
          <div className="budget-total-value expense-val">{formatMoney(totals.spent)}</div>
        </div>
        <div className="budget-total-card">
          <div className="budget-total-label">Planned</div>
          <div className="budget-total-value" style={{ color: "var(--orange)" }}>{formatMoney(totals.planned)}</div>
        </div>
        <div className="budget-total-card">
          <div className="budget-total-label">Remaining</div>
          <div className="budget-total-value remaining-val">{formatMoney(totals.remaining)}</div>
        </div>
      </div>

      {/* Add Transaction */}
      <div className="db-card">
        <h3 className="db-card-title" style={{ marginBottom: "0.875rem" }}>Add Transaction</h3>
        <form className="form-card" onSubmit={addTx} style={{ border: "none", padding: "0", background: "none" }}>
          <div className="form-row">
            <input placeholder="Description" value={tx.description} onChange={(e) => setTx({ ...tx, description: e.target.value })} required />
            <input type="number" placeholder="Amount" min="0.01" step="0.01" value={tx.amount} onChange={(e) => setTx({ ...tx, amount: e.target.value })} required />
          </div>
          <div className="form-row">
            <select value={tx.type} onChange={(e) => setTx({ ...tx, type: e.target.value })}>
              <option value="expense">Expense</option>
              <option value="income">Income</option>
              <option value="future">Planned</option>
            </select>
            <select value={tx.category} onChange={(e) => setTx({ ...tx, category: e.target.value })}>
              {config.categories?.map((c) => <option key={c}>{c}</option>)}
            </select>
            <input type="date" value={tx.date} onChange={(e) => setTx({ ...tx, date: e.target.value })} required />
          </div>
          <button className="btn" type="submit">Add</button>
        </form>
      </div>

      {/* Recent Transactions */}
      <div className="db-card">
        <h3 className="db-card-title" style={{ marginBottom: "0.875rem" }}>Recent Transactions</h3>
        {transactions.length === 0 && <p className="no-entries">No transactions yet.</p>}
        <div className="tx-list">
          {transactions.slice(0, 20).map((t, i) => (
            <div className="tx-item" key={i}>
              <div>
                <div className="tx-item-desc">{t.description}</div>
                <div className="tx-item-meta">{t.category} · {t.date}</div>
              </div>
              <div style={{
                fontWeight: "700",
                color: t.type === "income" ? "var(--green)" : t.type === "future" ? "var(--orange)" : "var(--red)"
              }}>
                {t.type === "income" ? "+" : "-"}{formatMoney(t.amount)}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Recurring Bills */}
      <div className="db-card">
        <h3 className="db-card-title" style={{ marginBottom: "0.875rem" }}>Add Recurring Bill</h3>
        <form className="form-card" onSubmit={addBill} style={{ border: "none", padding: "0", background: "none" }}>
          <div className="form-row">
            <input placeholder="Bill name" value={billForm.name} onChange={(e) => setBillForm({ ...billForm, name: e.target.value })} required />
            <input type="number" placeholder="Amount" min="0.01" step="0.01" value={billForm.amount} onChange={(e) => setBillForm({ ...billForm, amount: e.target.value })} required />
          </div>
          <div className="form-row">
            <select value={billForm.frequency} onChange={(e) => setBillForm({ ...billForm, frequency: e.target.value })}>
              <option value="monthly">Monthly</option>
              <option value="weekly">Weekly</option>
              <option value="biweekly">Biweekly</option>
              <option value="annual">Annual</option>
            </select>
            <input type="date" value={billForm.startDate} onChange={(e) => setBillForm({ ...billForm, startDate: e.target.value })} />
            <button className="btn" type="submit">Add Bill</button>
          </div>
        </form>
        {config.recurringBills?.length > 0 && (
          <div className="tx-list" style={{ marginTop: "0.875rem" }}>
            {config.recurringBills.map((b, i) => (
              <div className="tx-item" key={i}>
                <div>
                  <div className="tx-item-desc">{b.name}</div>
                  <div className="tx-item-meta">{b.frequency}</div>
                </div>
                <div style={{ color: "var(--red)", fontWeight: "700" }}>{formatMoney(b.amount)}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Income Sources */}
      <div className="db-card">
        <h3 className="db-card-title" style={{ marginBottom: "0.875rem" }}>Add Income Source</h3>
        <form className="form-card" onSubmit={addInc} style={{ border: "none", padding: "0", background: "none" }}>
          <div className="form-row">
            <input placeholder="Income name" value={incomeForm.name} onChange={(e) => setIncomeForm({ ...incomeForm, name: e.target.value })} required />
            <input type="number" placeholder="Amount" min="0.01" step="0.01" value={incomeForm.amount} onChange={(e) => setIncomeForm({ ...incomeForm, amount: e.target.value })} required />
          </div>
          <div className="form-row">
            <select value={incomeForm.frequency} onChange={(e) => setIncomeForm({ ...incomeForm, frequency: e.target.value })}>
              <option value="biweekly">Biweekly</option>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
              <option value="semimonthly">Semimonthly</option>
            </select>
            <input type="date" value={incomeForm.nextDate} onChange={(e) => setIncomeForm({ ...incomeForm, nextDate: e.target.value })} />
            <button className="btn" type="submit">Add</button>
          </div>
        </form>
        {config.income?.length > 0 && (
          <div className="tx-list" style={{ marginTop: "0.875rem" }}>
            {config.income.map((inc, i) => (
              <div className="tx-item" key={i}>
                <div>
                  <div className="tx-item-desc">{inc.name}</div>
                  <div className="tx-item-meta">{inc.frequency}</div>
                </div>
                <div style={{ color: "var(--green)", fontWeight: "700" }}>{formatMoney(inc.amount)}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
