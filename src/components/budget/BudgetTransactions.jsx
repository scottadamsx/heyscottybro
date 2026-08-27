import { useMemo, useState } from "react";
import { formatMoney, toDateStr, genId } from "../../utils/budgetCalc";
import { useConfirm } from "../../hooks/useConfirm";
import { getLedgerRows } from "../../utils/budgetAnalytics";
import "./budget.css";

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

  return (
    <div>
      {/* Header row */}
      <div className="bud-hstack" style={{ marginBottom: 14, alignItems: "center" }}>
        <button className="btn bud-flex1" onClick={openNew}><i className="fa-solid fa-plus" /> Log transaction</button>
        <div className="bud-seg">
          <button onClick={() => setViewMode("transactions")} className={`bud-seg-btn${viewMode === "transactions" ? " bud-seg-btn-on" : ""}`}>
            Transactions
          </button>
          <button onClick={() => setViewMode("ledger")} className={`bud-seg-btn${viewMode === "ledger" ? " bud-seg-btn-on" : ""}`}>
            Ledger
          </button>
        </div>
      </div>

      {showForm && (
        <div style={{ background: "var(--bg-card)", border: "1px solid var(--border-subtle)", borderRadius: "0.75rem", padding: "1.25rem", marginBottom: 16 }}>
          <div className="bud-row" style={{ marginBottom: 12 }}>
            <h3 style={{ margin: 0, fontSize: "0.95rem" }}>{editId ? "Edit Transaction" : "Log Transaction"}</h3>
            <button onClick={() => setShowForm(false)} className="bud-x" style={{ fontSize: 18 }}>×</button>
          </div>
          <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
            {["expense", "income", "savings"].map(t => {
              // Savings is money set aside (a transfer), so it reads as accent/neutral — not expense-red.
              const tone = t === "income" ? "var(--green)" : t === "savings" ? "var(--accent)" : "var(--red)";
              const tint = t === "income" ? "var(--success-bg)" : t === "savings" ? "var(--accent-bg)" : "var(--danger-bg)";
              const on = form.type === t;
              return (
                <button key={t} onClick={() => setForm(f => ({ ...f, type: t, ...(t === "savings" ? { category: "Savings" } : {}) }))}
                  className="bud-typebtn"
                  style={{ fontWeight: on ? 600 : 400,
                    background: on ? tint : "var(--bg-raised)",
                    color: on ? tone : "var(--text-muted)",
                    border: `1px solid ${on ? tone : "var(--border-subtle)"}` }}>
                  {t.charAt(0).toUpperCase() + t.slice(1)}
                </button>
              );
            })}
          </div>
          <input placeholder="Description" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} className="bud-inp" />
          <div className="bud-hstack" style={{ marginBottom: 8 }}>
            <input type="number" placeholder="Amount" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} style={{ flex: 1 }} />
            <input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} style={{ flex: 1 }} />
          </div>
          <label className="bud-caps-label">Category (Groceries, Gas…)</label>
          <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} className="bud-inp">
            {categories.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          {form.type === "expense" && recurringBills.length > 0 && (
            <>
              <label className="bud-caps-label">Pays a bill? (Phone, Rent…)</label>
              <select value={form.fulfills_recurring_id} onChange={e => pickBill(e.target.value)} className="bud-inp">
                <option value="">— Not a bill —</option>
                {recurringBills.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </>
          )}
          <input placeholder="Notes (optional)" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} className="bud-inp" />
          <div className="bud-hstack">
            <button className="btn bud-flex1" onClick={save} style={{ background: "var(--accent)", color: "var(--text-on-accent)", border: "none" }}>Save</button>
            <button className="btn bud-flex1" onClick={() => setShowForm(false)}>Cancel</button>
          </div>
        </div>
      )}

      {/* ── LEDGER VIEW ── */}
      {viewMode === "ledger" && (
        <>
          {/* Summary strip */}
          <div className="bud-grid-3">
            {[
              { label: "Total in", val: ledgerTotals.totalIn, color: "var(--green)" },
              { label: "Total out", val: ledgerTotals.totalOut, color: "var(--red)" },
              { label: "Current balance", val: ledgerTotals.finalBal, color: ledgerTotals.finalBal >= 0 ? "var(--green)" : "var(--red)" },
            ].map(({ label, val, color }) => (
              <div key={label} className="bud-panel" style={{ padding: "0.75rem" }}>
                <div className="bud-tile-label">{label}</div>
                <div className="bud-mono" style={{ fontSize: 16, color }}>{formatMoney(val)}</div>
              </div>
            ))}
          </div>
          <p className="bud-sh bud-sh-tight">Running ledger — {ledgerRows.length} entries</p>
          {ledgerRows.length === 0
            ? <p className="bud-muted-13">No transactions yet.</p>
            : (
              <div style={{ overflowX: "auto" }}>
                <table className="bud-table bud-table-ledger">
                  <thead>
                    <tr>
                      {["Date", "Description", "Category", "Debit", "Credit", "Balance"].map(h => (
                        <th key={h} className={["Debit", "Credit", "Balance"].includes(h) ? "bud-right" : undefined}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {/* Opening balance row */}
                    <tr style={{ background: "var(--bg-raised)" }}>
                      <td style={{ padding: "6px 8px", color: "var(--text-muted)", fontSize: 11, whiteSpace: "nowrap" }}>Opening</td>
                      <td style={{ padding: "6px 8px", color: "var(--text-muted)", fontStyle: "italic", fontSize: 11 }}>Starting balance</td>
                      <td /><td /><td />
                      <td className="bud-right bud-mono" style={{ padding: "6px 8px", fontSize: 12 }}>{formatMoney(startingBalance)}</td>
                    </tr>
                    {ledgerRows.map(t => {
                      const isIncome = t.type === "income";
                      const balNeg = t.runningBalance < 0;
                      return (
                        <tr key={t.id} style={{ background: balNeg ? "var(--danger-bg)" : "transparent" }}>
                          <td style={{ color: "var(--text-muted)", whiteSpace: "nowrap", fontSize: 11 }}>{t.date}</td>
                          <td className="bud-ellipsis" style={{ maxWidth: 200 }}>
                            {t.description}
                            {t.notes && <span className="bud-muted-10" style={{ marginLeft: 5 }}>· {t.notes}</span>}
                          </td>
                          <td>
                            <span className="bud-pill bud-pill-10">{t.category}</span>
                          </td>
                          <td className="bud-right bud-mono" style={{ color: "var(--red)" }}>
                            {!isIncome ? formatMoney(t.amount) : ""}
                          </td>
                          <td className="bud-right bud-mono" style={{ color: "var(--green)" }}>
                            {isIncome ? formatMoney(t.amount) : ""}
                          </td>
                          <td className="bud-right bud-mono" style={{ fontSize: 13, fontWeight: 600, color: balNeg ? "var(--red)" : t.runningBalance < startingBalance * 0.2 ? "var(--orange)" : "var(--text-primary)", whiteSpace: "nowrap" }}>
                            {formatMoney(t.runningBalance)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )
          }
        </>
      )}

      {/* ── TRANSACTIONS VIEW ── */}
      {viewMode === "transactions" && (
        <>
          <div className="bud-grid-2">
            <select value={filterType} onChange={e => setFilterType(e.target.value)} style={{ fontSize: 13 }}>
              <option value="all">All types</option>
              <option value="expense">Expenses</option>
              <option value="income">Income</option>
              <option value="savings">Savings</option>
            </select>
            <select value={filterCat} onChange={e => setFilterCat(e.target.value)} style={{ fontSize: 13 }}>
              <option value="all">All categories</option>
              {categories.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <input type="date" value={filterFrom} onChange={e => setFilterFrom(e.target.value)} placeholder="From" style={{ fontSize: 13 }} />
            <input type="date" value={filterTo} onChange={e => setFilterTo(e.target.value)} placeholder="To" style={{ fontSize: 13 }} />
          </div>

          <p className="bud-sh bud-sh-tight">Transactions ({filtered.length})</p>

          {filtered.length === 0
            ? <p className="bud-muted-13">No transactions match your filters.</p>
            : (
              <div style={{ overflowX: "auto" }}>
                <table className="bud-table bud-table-tx">
                  <thead>
                    <tr>
                      {[["date", "Date"], ["description", "Description"], ["category", "Category"], ["amount", "Amount"], ["type", "Type"], ["", ""]].map(([col, label]) => (
                        <th key={label} onClick={col ? () => sortBy(col) : undefined}
                          className={col === "amount" ? "bud-right" : undefined}
                          style={{ cursor: col ? "pointer" : "default" }}>
                          {label}{sortCol === col ? (sortAsc ? " ↑" : " ↓") : ""}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map(t => (
                      <tr key={t.id}>
                        <td style={{ color: "var(--text-muted)", whiteSpace: "nowrap" }}>{t.date}</td>
                        <td className="bud-ellipsis" style={{ maxWidth: 180 }}>
                          {t.description}
                          {t.notes && <span className="bud-muted-11" style={{ marginLeft: 6 }}>· {t.notes}</span>}
                        </td>
                        <td><span className="bud-pill">{t.category}</span></td>
                        <td className="bud-right bud-mono" style={{ color: t.type === "income" ? "var(--green)" : t.type === "future" ? "var(--accent)" : t.type === "savings" ? "#14b8a6" : /* theme-fixed: user colour (savings category) */ "var(--red)", whiteSpace: "nowrap" }}>
                          {t.type === "income" ? "+" : "-"}{formatMoney(t.amount)}
                        </td>
                        <td style={{ color: "var(--text-muted)", whiteSpace: "nowrap" }}>
                          {(t.is_bill || t.fulfills_recurring_id) && <span style={{ fontSize: 10, color: "var(--orange)", background: "var(--warn-bg)", borderRadius: 4, padding: "1px 5px", marginRight: 5 }}>{billName(t.fulfills_recurring_id) || "Bill"}</span>}
                          {t.reconciled ? <span style={{ fontSize: 11, color: "var(--green)" }}>Reconciled</span> : t.type === "future" ? "Planned" : t.type === "income" ? "Income" : t.type === "savings" ? "Savings" : "Expense"}
                        </td>
                        <td style={{ whiteSpace: "nowrap" }}>
                          <div className="bud-actions">
                            <button className="btn-sm bud-btn-xs" onClick={() => openEdit(t)}>Edit</button>
                            {t.type === "expense" && (
                              <button className="btn-sm bud-btn-xs" onClick={() => toggleBill(t.id)} style={t.is_bill ? { color: "var(--orange)", borderColor: "var(--orange)" } : undefined} title={t.is_bill ? "Unmark as bill" : "Mark as bill"}>
                                {t.is_bill ? "Unbill" : "Bill"}
                              </button>
                            )}
                            {t.type === "future" && <button className="btn-sm btn-complete bud-btn-xs" onClick={() => convertFuture(t.id)}>Purchased</button>}
                            <button className="btn-sm btn-delete bud-btn-xs" onClick={() => deleteTx(t.id)}>Del</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          }
        </>
      )}
      {dialog}
    </div>
  );
}
