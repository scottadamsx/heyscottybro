import { useState } from "react";
import { formatMoney } from "../../utils/plannerUtils";

export default function MonthBreakdown({ month, categories, onUpdateTx, onDeleteTx, onLogFromSource }) {
  const [editingId, setEditingId] = useState(null);
  const [draft, setDraft] = useState(null);

  const startEdit = (tx) => {
    setEditingId(tx.id);
    setDraft({ description: tx.description, amount: Math.abs(tx.amount), type: tx.type, category: tx.category, date: tx.date });
  };

  const commit = async () => {
    await onUpdateTx(editingId, draft);
    setEditingId(null);
    setDraft(null);
  };

  const cancel = () => { setEditingId(null); setDraft(null); };

  const onKey = (e) => {
    if (e.key === "Enter") commit();
    if (e.key === "Escape") cancel();
  };

  const actualsSum = month.events.reduce((s, t) => s + Number(t.amount || 0), 0);

  return (
    <div className="bud-breakdown">
      <div className="bud-breakdown-grid">
        <div className="bud-breakdown-col">
          <div className="bud-breakdown-head">
            <h4>Actuals</h4>
            <span className="bud-breakdown-sum" style={{ color: actualsSum >= 0 ? "var(--bud-green)" : "var(--bud-red)" }}>
              {actualsSum >= 0 ? "+" : "-"}{formatMoney(actualsSum)}
            </span>
          </div>
          {month.events.length === 0 && <p className="bud-muted">No transactions this month.</p>}
          {month.events.map(tx => {
            const signed = Number(tx.amount || 0);
            const linked = tx.fulfills_recurring_id || tx.fulfills_income_id;
            if (editingId === tx.id) {
              return (
                <div className="bud-tx-edit" key={tx.id} onKeyDown={onKey}>
                  <input autoFocus value={draft.description} onChange={e => setDraft({ ...draft, description: e.target.value })} />
                  <input type="number" step="0.01" value={draft.amount} onChange={e => setDraft({ ...draft, amount: e.target.value })} />
                  <select value={draft.type} onChange={e => setDraft({ ...draft, type: e.target.value })}>
                    <option value="expense">Expense</option>
                    <option value="income">Income</option>
                  </select>
                  <select value={draft.category} onChange={e => setDraft({ ...draft, category: e.target.value })}>
                    {categories.map(c => <option key={c}>{c}</option>)}
                  </select>
                  <input type="date" value={draft.date} onChange={e => setDraft({ ...draft, date: e.target.value })} />
                  <button type="button" className="btn-mini" onClick={commit} aria-label="Save"><i className="fa-solid fa-check" /></button>
                  <button type="button" className="btn-mini muted" onClick={cancel} aria-label="Cancel"><i className="fa-solid fa-xmark" /></button>
                </div>
              );
            }
            return (
              <div className={`bud-tx-row ${signed >= 0 ? "income" : "expense"}`} key={tx.id}>
                <div className="bud-tx-main">
                  <div className="bud-tx-desc">
                    {tx.description}
                    {linked && <span className="bud-tx-link" title="Linked to a recurring source"><i className="fa-solid fa-link" /></span>}
                  </div>
                  <div className="bud-tx-meta">{tx.category} · {tx.date}</div>
                </div>
                <div className="bud-tx-amount">{signed >= 0 ? "+" : "-"}{formatMoney(signed)}</div>
                <div className="bud-tx-actions">
                  <button type="button" className="btn-mini" onClick={() => startEdit(tx)} aria-label="Edit"><i className="fa-solid fa-pen" /></button>
                  <button type="button" className="btn-mini danger" onClick={() => { if (confirm(`Delete "${tx.description}"?`)) onDeleteTx(tx.id); }} aria-label="Delete"><i className="fa-solid fa-trash" /></button>
                </div>
              </div>
            );
          })}
        </div>

        <div className="bud-breakdown-col">
          <div className="bud-breakdown-head">
            <h4>{month.isPast ? "Expected (past)" : "Unfulfilled this month"}</h4>
            <span className="bud-breakdown-sum bud-muted">
              {month.isPast ? "—" : formatMoney((month.projectedIncome || 0) + Math.abs(month.projectedExpenses || 0))}
            </span>
          </div>
          {month.isPast && <p className="bud-muted">Past months show actuals only.</p>}
          {!month.isPast && month.unfulfilledIncome.length === 0 && month.unfulfilledBills.length === 0 && (
            <p className="bud-muted">Everything fulfilled — nice.</p>
          )}
          {!month.isPast && month.unfulfilledIncome.map(s => (
            <div className="bud-src-row income" key={s.id}>
              <div className="bud-tx-main">
                <div className="bud-tx-desc">{s.name}</div>
                <div className="bud-tx-meta">Income · monthly</div>
              </div>
              <div className="bud-tx-amount">+{formatMoney(s.amount)}</div>
              <button type="button" className="btn-mini accent" onClick={() => onLogFromSource(s, "income", month.key)}>
                <i className="fa-solid fa-plus" /> Log
              </button>
            </div>
          ))}
          {!month.isPast && month.unfulfilledBills.map(b => (
            <div className="bud-src-row expense" key={b.id}>
              <div className="bud-tx-main">
                <div className="bud-tx-desc">{b.name}</div>
                <div className="bud-tx-meta">{b.category} · monthly</div>
              </div>
              <div className="bud-tx-amount">-{formatMoney(b.amount)}</div>
              <button type="button" className="btn-mini accent" onClick={() => onLogFromSource(b, "recurring", month.key)}>
                <i className="fa-solid fa-plus" /> Log
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
