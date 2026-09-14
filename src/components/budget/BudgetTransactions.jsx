import { useMemo, useState } from "react";
import { formatMoney, toDateStr, genId } from "../../utils/budgetCalc";
import { useConfirm } from "../../hooks/useConfirm";
import { getLedgerRows } from "../../utils/budgetAnalytics";
import "./budget.css";
import DatePicker from "../DatePicker";

const EMPTY_FORM = { description: "", amount: "", type: "expense", category: "", date: toDateStr(), notes: "", fulfills_recurring_id: "", is_bill: false };

export default function BudgetTransactions({ config, transactions, setTransactions, startingBalance = 0, defaultView = "transactions" }) {
  const categories = config.categories || [];
  const recurringBills = config.recurringBills || [];
  const billName = id => recurringBills.find(b => b.id === id)?.name || null;
  const { confirm, dialog } = useConfirm();
  const [viewMode, setViewMode] = useState(defaultView); // "transactions" | "ledger"
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ ...EMPTY_FORM, date: toDateStr() });
  const [editId, setEditId] = useState(null);
  const [filterType, setFilterType] = useState("all");
  const [filterCat, setFilterCat] = useState("all");
  const [filterFrom, setFilterFrom] = useState("");
  const [filterTo, setFilterTo] = useState("");
  const [sortCol, setSortCol] = useState("date");
  const [sortAsc, setSortAsc] = useState(false);

  const filtered = useMemo(() => {
    let r = [...transactions];
    if (filterType !== "all") r = r.filter(t => t.type === filterType);
    if (filterCat !== "all") r = r.filter(t => t.category === filterCat);
    if (filterFrom) r = r.filter(t => t.date >= filterFrom);
    if (filterTo) r = r.filter(t => t.date <= filterTo);
    r.sort((a, b) => {
      let va = a[sortCol], vb = b[sortCol];
      if (sortCol === "amount") { va = Number(va); vb = Number(vb); }
      return sortAsc ? (va < vb ? -1 : va > vb ? 1 : 0) : (va < vb ? 1 : va > vb ? -1 : 0);
    });
    return r;
  }, [transactions, filterType, filterCat, filterFrom, filterTo, sortCol, sortAsc]);

  const ledgerRows = useMemo(() => getLedgerRows(transactions, startingBalance), [transactions, startingBalance]);

  const sortBy = col => { if (sortCol === col) setSortAsc(a => !a); else { setSortCol(col); setSortAsc(true); } };

  const openNew = () => { setEditId(null); setForm({ ...EMPTY_FORM, date: toDateStr(), category: categories[0] || "" }); setShowForm(true); };
  const openEdit = t => { setEditId(t.id); setForm({ description: t.description, amount: String(t.amount), type: t.type, category: t.category, date: t.date, notes: t.notes || "", fulfills_recurring_id: t.fulfills_recurring_id || "", is_bill: t.is_bill || false }); setShowForm(true); };

  // Tagging a transaction to a bill links it (so the dashboard marks that bill
  // paid) and inherits the bill's category.
  const pickBill = id => setForm(f => {
    const bill = recurringBills.find(b => b.id === id);
    return { ...f, fulfills_recurring_id: id, is_bill: !!id, type: id ? "expense" : f.type, category: bill?.category || f.category };
  });

  const save = () => {
    const amt = parseFloat(form.amount);
    if (!form.description.trim() || isNaN(amt) || amt <= 0 || !form.date) return;
    const billId = form.fulfills_recurring_id || null;
    const tx = { id: editId || genId(), description: form.description.trim(), amount: amt, type: form.type, category: form.category || categories[0] || "Other", date: form.date, notes: form.notes.trim(), reconciled: false, fulfills_recurring_id: billId, is_bill: billId ? true : form.is_bill };
    if (editId) setTransactions(p => p.map(t => t.id === editId ? { ...t, ...tx } : t));
    else setTransactions(p => [tx, ...p]);
    setShowForm(false); setEditId(null);
  };

  const deleteTx = async id => { if (!await confirm("Delete this transaction?", { title: "Delete transaction", confirmLabel: "Delete" })) return; setTransactions(p => p.filter(t => t.id !== id)); };
  const convertFuture = id => setTransactions(p => p.map(t => t.id === id ? { ...t, type: "expense", date: toDateStr() } : t));
  const toggleBill = id => setTransactions(p => p.map(t => t.id === id ? { ...t, is_bill: !t.is_bill } : t));

  // ── Ledger summary totals ──
  const ledgerTotals = useMemo(() => {
    const totalIn = transactions.filter(t => t.type === "income").reduce((s, t) => s + t.amount, 0);
    const totalOut = transactions.filter(t => t.type !== "income").reduce((s, t) => s + t.amount, 0);
    const finalBal = ledgerRows.length ? ledgerRows[ledgerRows.length - 1].runningBalance : startingBalance;
    return { totalIn, totalOut, finalBal };
  }, [transactions, ledgerRows, startingBalance]);

  const setField = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));
  const SORT_COLS = [["date", "Date"], ["description", "Description"], ["category", "Category"], ["amount", "Amount"], ["type", "Type"]];
  const balTone = (bal) => (bal < 0 ? " is-neg" : bal < startingBalance * 0.2 ? " is-low" : "");

  return (
    <div className="money money-tab">
      {/* Header row */}
      <div className="money-toolbar">
        <button type="button" className="btn" onClick={openNew}><i className="fa-solid fa-plus" aria-hidden="true" /> Log transaction</button>
        <div className="segmented" role="group" aria-label="View">
          <button type="button" aria-pressed={viewMode === "transactions"} onClick={() => setViewMode("transactions")} className={`segmented-opt${viewMode === "transactions" ? " active" : ""}`}>
            Transactions
          </button>
          <button type="button" aria-pressed={viewMode === "ledger"} onClick={() => setViewMode("ledger")} className={`segmented-opt${viewMode === "ledger" ? " active" : ""}`}>
            Ledger
          </button>
        </div>
      </div>

      {showForm && (
        <div className="db-card tx-form">
          <div className="db-card-header">
            <h3 className="db-card-title">{editId ? "Edit transaction" : "Log transaction"}</h3>
            <button type="button" onClick={() => setShowForm(false)} className="icon-x" aria-label="Close"><i className="fa-solid fa-xmark" aria-hidden="true" /></button>
          </div>
          <div className="segmented tx-type" role="radiogroup" aria-label="Type">
            {["expense", "income", "savings"].map(t => (
              // Savings is money set aside (a transfer) and pre-fills the Savings category.
              <button key={t} type="button" role="radio" aria-checked={form.type === t}
                onClick={() => setForm(f => ({ ...f, type: t, ...(t === "savings" ? { category: "Savings" } : {}) }))}
                className={`segmented-opt${form.type === t ? " active" : ""}`}>
                {t.charAt(0).toUpperCase() + t.slice(1)}
              </button>
            ))}
          </div>
          <div className="tx-form-grid">
            <input className="is-wide" placeholder="Description" aria-label="Description" value={form.description} onChange={setField("description")} />
            <input type="number" placeholder="Amount" aria-label="Amount" value={form.amount} onChange={setField("amount")} />
            <DatePicker value={form.date} onChange={(v) => setForm(f => ({ ...f, date: v }))} />
            <label className="money-field is-wide">
              <span className="field-label">Category (Groceries, Gas…)</span>
              <select value={form.category} onChange={setField("category")}>
                {categories.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </label>
            {form.type === "expense" && recurringBills.length > 0 && (
              <label className="money-field is-wide">
                <span className="field-label">Pays a bill? (Phone, Rent…)</span>
                <select value={form.fulfills_recurring_id} onChange={e => pickBill(e.target.value)}>
                  <option value="">— Not a bill —</option>
                  {recurringBills.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
              </label>
            )}
            <input className="is-wide" placeholder="Notes (optional)" aria-label="Notes" value={form.notes} onChange={setField("notes")} />
          </div>
          <div className="form-actions">
            <button type="button" className="btn" onClick={save}>Save</button>
            <button type="button" className="btn btn-secondary" onClick={() => setShowForm(false)}>Cancel</button>
          </div>
        </div>
      )}

      {/* ── LEDGER VIEW ── */}
      {viewMode === "ledger" && (
        <>
          {/* Summary strip */}
          <div className="money-stats">
            {[
              { label: "Total in", val: ledgerTotals.totalIn, tone: "good" },
              { label: "Total out", val: ledgerTotals.totalOut },
              { label: "Current balance", val: ledgerTotals.finalBal, tone: ledgerTotals.finalBal < 0 ? "bad" : "" },
            ].map(({ label, val, tone }) => (
              <div key={label} className="money-stat">
                <span className="kpi-head"><span className="kpi-label">{label}</span></span>
                <span className={`money-stat-value${tone ? ` tone-${tone}` : ""}`}>{formatMoney(val)}</span>
              </div>
            ))}
          </div>
          <div className="db-card">
            <div className="db-card-header">
              <h3 className="db-card-title">Running ledger</h3>
              <span className="money-bills-count">{ledgerRows.length} entries</span>
            </div>
            {ledgerRows.length === 0
              ? <p className="money-card-note">No transactions yet.</p>
              : (
                <div className="bud-table-wrap">
                  <table className="bud-table money-table ledger-table">
                    <thead>
                      <tr>
                        {["Date", "Description", "Category", "Debit", "Credit", "Balance"].map(h => (
                          <th key={h} className={["Debit", "Credit", "Balance"].includes(h) ? "bud-right" : h === "Category" ? "is-cat" : undefined}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {/* Opening balance row */}
                      <tr className="is-opening">
                        <td className="is-date">Opening</td>
                        <td className="is-sub">Starting balance</td>
                        <td className="is-cat" /><td /><td />
                        <td className="is-amt">{formatMoney(startingBalance)}</td>
                      </tr>
                      {ledgerRows.map(t => {
                        const isIncome = t.type === "income";
                        return (
                          <tr key={t.id}>
                            <td className="is-date">{t.date}</td>
                            <td className="is-desc">
                              {t.description}
                              {t.notes && <span className="is-note">· {t.notes}</span>}
                            </td>
                            <td className="is-cat">{t.category}</td>
                            <td className="is-amt is-plain">{!isIncome ? formatMoney(t.amount) : ""}</td>
                            <td className="is-amt is-plain is-in">{isIncome ? formatMoney(t.amount) : ""}</td>
                            <td className={`is-amt${balTone(t.runningBalance)}`}>{formatMoney(t.runningBalance)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )
            }
          </div>
        </>
      )}

      {/* ── TRANSACTIONS VIEW ── */}
      {viewMode === "transactions" && (
        <div className="db-card">
          <div className="db-card-header">
            <h3 className="db-card-title">Transactions</h3>
            <span className="db-count" aria-label={`${filtered.length} transactions`}>{filtered.length}</span>
          </div>
          <div className="tx-filters">
            <select value={filterType} onChange={e => setFilterType(e.target.value)} aria-label="Type">
              <option value="all">All types</option>
              <option value="expense">Expenses</option>
              <option value="income">Income</option>
              <option value="savings">Savings</option>
            </select>
            <select value={filterCat} onChange={e => setFilterCat(e.target.value)} aria-label="Category">
              <option value="all">All categories</option>
              {categories.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <DatePicker value={filterFrom} onChange={(v) => setFilterFrom(v)} placeholder="From" />
            <DatePicker value={filterTo} onChange={(v) => setFilterTo(v)} placeholder="To" />
          </div>

          {filtered.length === 0
            ? <p className="money-card-note">No transactions match your filters.</p>
            : (
              <div className="bud-table-wrap">
                <table className="bud-table money-table is-stack tx-table">
                  <thead>
                    <tr>
                      {SORT_COLS.map(([col, label]) => (
                        <th key={col} className={col === "amount" ? "bud-right" : undefined}
                          aria-sort={sortCol === col ? (sortAsc ? "ascending" : "descending") : undefined}>
                          <button type="button" className={`money-sort${sortCol === col ? " is-active" : ""}`} onClick={() => sortBy(col)}>
                            {label}
                            {sortCol === col && <i className={`fa-solid fa-arrow-${sortAsc ? "up" : "down"}`} aria-hidden="true" />}
                          </button>
                        </th>
                      ))}
                      <th><span className="visually-hidden">Actions</span></th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map(t => (
                      <tr key={t.id}>
                        <td className="is-date">{t.date}</td>
                        <td className="is-desc">
                          {t.description}
                          {t.notes && <span className="is-note">· {t.notes}</span>}
                        </td>
                        <td className="is-cat">{t.category}</td>
                        <td className={`is-amt money-tx-amt t-${t.type}`}>
                          {t.type === "income" ? "+" : "−"}{formatMoney(t.amount)}
                        </td>
                        <td className="is-type">
                          {(t.is_bill || t.fulfills_recurring_id) && <span className="bud-billtag">{billName(t.fulfills_recurring_id) || "Bill"}</span>}
                          {t.reconciled ? <span className="tx-reconciled">Reconciled</span> : t.type === "future" ? "Planned" : t.type === "income" ? "Income" : t.type === "savings" ? "Savings" : "Expense"}
                        </td>
                        <td className="is-actions">
                          <div className="bud-actions">
                            <button type="button" className="btn-mini" onClick={() => openEdit(t)}>Edit</button>
                            {t.type === "expense" && (
                              <button type="button" className="btn-mini" onClick={() => toggleBill(t.id)} aria-pressed={!!t.is_bill} title={t.is_bill ? "Unmark as bill" : "Mark as bill"}>
                                {t.is_bill ? "Unbill" : "Bill"}
                              </button>
                            )}
                            {t.type === "future" && <button type="button" className="btn-mini accent" onClick={() => convertFuture(t.id)}>Purchased</button>}
                            <button type="button" className="btn-mini danger" onClick={() => deleteTx(t.id)} aria-label={`Delete ${t.description}`}>Delete</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          }
        </div>
      )}
      {dialog}
    </div>
  );
}
