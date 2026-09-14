import { useMemo, useState } from "react";
import { getIncomePayPeriod, formatMoney, formatPeriodLabel, getIncomeDatesInRange, toDateStr } from "../../utils/budgetCalc";
import "./budget.css";

export default function BudgetReconcile({ config, transactions, setTransactions }) {
  const today = toDateStr();
  const periodOptions = useMemo(() => {
    const opts = [];
    for (let i = 0; i >= -5; i--) {
      const p = getIncomePayPeriod(config, today, i);
      const key = `${p.start}|${p.end}`;
      // Offsets before the first payday resolve to the same period; list it once.
      if (opts.some(o => o.key === key)) continue;
      opts.push({ start: p.start, end: p.end, label: formatPeriodLabel(p.start, p.end) + (i === 0 ? " (Current)" : ""), key });
    }
    return opts;
  }, [today, config]);

  const [periodKey, setPeriodKey] = useState(periodOptions[0]?.key || "");
  const [selectAll, setSelectAll] = useState(false);
  const [checked, setChecked] = useState(new Set());

  const period = useMemo(() => {
    const p = periodOptions.find(o => o.key === periodKey) || periodOptions[0];
    return p ? { start: p.start, end: p.end } : { start: today, end: today };
  }, [periodKey, periodOptions, today]);

  const periodTx = useMemo(() => transactions.filter(t => t.date >= period.start && t.date <= period.end), [transactions, period]);
  const unreconciled = periodTx.filter(t => !t.reconciled);
  const reconciled = periodTx.filter(t => t.reconciled);

  const income = periodTx.filter(t => t.type === "income").reduce((s, t) => s + t.amount, 0);
  let incFromSources = 0;
  (config.income || []).forEach(inc => {
    incFromSources += getIncomeDatesInRange(inc, period.start, period.end).length * inc.amount;
  });
  const totalIncome = income + incFromSources;
  const totalExpenses = periodTx.filter(t => t.type === "expense").reduce((s, t) => s + t.amount, 0);
  const reconciledTotal = reconciled.filter(t => t.type === "expense").reduce((s, t) => s + t.amount, 0);
  const unreconciledTotal = unreconciled.filter(t => t.type === "expense").reduce((s, t) => s + t.amount, 0);
  const expected = totalIncome - totalExpenses;

  const reconcileOne = id => setTransactions(p => p.map(t => t.id === id ? { ...t, reconciled: true } : t));
  const unreconcileOne = id => setTransactions(p => p.map(t => t.id === id ? { ...t, reconciled: false } : t));
  const reconcileSelected = () => {
    setTransactions(p => p.map(t => checked.has(t.id) ? { ...t, reconciled: true } : t));
    setChecked(new Set()); setSelectAll(false);
  };

  const toggleCheck = id => setChecked(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const toggleAll = val => { setSelectAll(val); setChecked(val ? new Set(unreconciled.map(t => t.id)) : new Set()); };

  const amt = (t) => (
    <td className={`is-amt money-tx-amt t-${t.type}`}>{t.type === "income" ? "+" : "−"}{formatMoney(t.amount)}</td>
  );

  return (
    <div className="money money-tab">
      <div className="section-head">
        <h2 className="section-title">Reconcile</h2>
        <select value={periodKey} aria-label="Pay period" className="rec-period" onChange={e => { setPeriodKey(e.target.value); setChecked(new Set()); setSelectAll(false); }}>
          {periodOptions.map(o => <option key={o.key} value={o.key}>{o.label}</option>)}
        </select>
      </div>

      {/* Summary */}
      <div className="money-stats" aria-label="Period summary">
        <div className="money-stat">
          <span className="kpi-head"><span className="kpi-label">Expected balance</span></span>
          <span className={`money-stat-value${expected < 0 ? " tone-bad" : " tone-good"}`}>{formatMoney(expected)}</span>
        </div>
        <div className="money-stat">
          <span className="kpi-head"><span className="kpi-label">Reconciled expenses</span></span>
          <span className="money-stat-value">{formatMoney(reconciledTotal)}</span>
        </div>
        <div className="money-stat">
          <span className="kpi-head"><span className="kpi-label">Unreconciled expenses</span></span>
          <span className={`money-stat-value${unreconciledTotal > 0 ? " tone-warn" : ""}`}>{formatMoney(unreconciledTotal)}</span>
        </div>
      </div>

      {/* Unreconciled */}
      <div className="db-card">
        <div className="db-card-header">
          <h3 className="db-card-title">Unreconciled</h3>
          <span className="db-count" aria-label={`${unreconciled.length} unreconciled`}>{unreconciled.length}</span>
        </div>
        {unreconciled.length === 0
          ? <p className="money-card-note">All clear — everything reconciled.</p>
          : <>
            <div className="rec-bar">
              <label className="checkbox-inline">
                <input type="checkbox" checked={selectAll} onChange={e => toggleAll(e.target.checked)} /> Select all
              </label>
              {checked.size > 0 && <button type="button" className="btn-sm btn-complete" onClick={reconcileSelected}>Reconcile {checked.size} selected</button>}
            </div>
            <div className="bud-table-wrap">
              <table className="bud-table money-table is-stack rec-table">
                <thead><tr>
                  <th className="is-check"><span className="visually-hidden">Select</span></th>
                  {["Date", "Description", "Category", "Amount"].map(h => (
                    <th key={h} className={h === "Amount" ? "bud-right" : undefined}>{h}</th>
                  ))}
                  <th><span className="visually-hidden">Actions</span></th>
                </tr></thead>
                <tbody>
                  {unreconciled.map(t => (
                    <tr key={t.id}>
                      <td className="is-check"><input type="checkbox" checked={checked.has(t.id)} onChange={() => toggleCheck(t.id)} aria-label={`Select ${t.description}`} /></td>
                      <td className="is-date">{t.date}</td>
                      <td className="is-desc">{t.description}</td>
                      <td className="is-cat">{t.category}</td>
                      {amt(t)}
                      <td className="is-actions"><button type="button" className="btn-mini" onClick={() => reconcileOne(t.id)}>Reconcile</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        }
      </div>

      {/* Reconciled */}
      {reconciled.length > 0 && (
        <div className="db-card">
          <div className="db-card-header">
            <h3 className="db-card-title">Reconciled</h3>
            <span className="db-count" aria-label={`${reconciled.length} reconciled`}>{reconciled.length}</span>
          </div>
          <div className="bud-table-wrap">
            <table className="bud-table money-table is-stack rec-table no-check">
              <thead><tr>
                {["Date", "Description", "Category", "Amount"].map(h => (
                  <th key={h} className={h === "Amount" ? "bud-right" : undefined}>{h}</th>
                ))}
                <th><span className="visually-hidden">Actions</span></th>
              </tr></thead>
              <tbody>
                {reconciled.map(t => (
                  <tr key={t.id} className="is-done">
                    <td className="is-date">{t.date}</td>
                    <td className="is-desc">{t.description}</td>
                    <td className="is-cat">{t.category}</td>
                    {amt(t)}
                    <td className="is-actions"><button type="button" className="btn-mini" onClick={() => unreconcileOne(t.id)}>Un-reconcile</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
