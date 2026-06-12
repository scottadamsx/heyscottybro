import { useMemo, useState } from "react";
import { formatMoney, toDateStr, genId } from "../../utils/budgetCalc";
import { getLedgerRows } from "../../utils/budgetAnalytics";

const EMPTY_FORM = { description: "", amount: "", type: "expense", category: "", date: toDateStr(), notes: "" };

export default function BudgetTransactions({ config, transactions, setTransactions, startingBalance = 0, defaultView = "transactions" }) {
  const categories = config.categories || [];
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
  const openEdit = t => { setEditId(t.id); setForm({ description: t.description, amount: String(t.amount), type: t.type, category: t.category, date: t.date, notes: t.notes || "" }); setShowForm(true); };

  const save = () => {
    const amt = parseFloat(form.amount);
    if (!form.description.trim() || isNaN(amt) || amt <= 0 || !form.date) return;
    const tx = { id: editId || genId(), description: form.description.trim(), amount: amt, type: form.type, category: form.category || categories[0] || "Other", date: form.date, notes: form.notes.trim(), reconciled: false };
    if (editId) setTransactions(p => p.map(t => t.id === editId ? { ...t, ...tx } : t));
    else setTransactions(p => [tx, ...p]);
    setShowForm(false); setEditId(null);
  };

  const deleteTx = id => { if (!window.confirm("Delete this transaction?")) return; setTransactions(p => p.filter(t => t.id !== id)); };
  const convertFuture = id => setTransactions(p => p.map(t => t.id === id ? { ...t, type: "expense", date: toDateStr() } : t));

  const sh = { fontSize: 11, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--text-muted)", margin: "14px 0 8px", fontWeight: 500 };
  const inp = { width: "100%", marginBottom: 8 };
  const mono = { fontFamily: "var(--font-mono,monospace)", fontWeight: 500 };

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
      <div style={{ display: "flex", gap: 8, marginBottom: 14, alignItems: "center" }}>
        <button className="btn" onClick={openNew} style={{ flex: 1 }}><i className="fa-solid fa-plus" /> Log transaction</button>
        <div style={{ display: "flex", background: "var(--bg-elevated,#1a1a1a)", border: "0.5px solid var(--border)", borderRadius: "0.375rem", padding: 3, gap: 3 }}>
          <button onClick={() => setViewMode("transactions")} style={{ padding: "5px 12px", borderRadius: "0.25rem", border: "none", fontSize: 12, cursor: "pointer", background: viewMode === "transactions" ? "var(--bg-raised,#222)" : "transparent", color: viewMode === "transactions" ? "var(--text-primary)" : "var(--text-muted)", fontWeight: viewMode === "transactions" ? 600 : 400 }}>
            Transactions
          </button>
          <button onClick={() => setViewMode("ledger")} style={{ padding: "5px 12px", borderRadius: "0.25rem", border: "none", fontSize: 12, cursor: "pointer", background: viewMode === "ledger" ? "var(--bg-raised,#222)" : "transparent", color: viewMode === "ledger" ? "var(--text-primary)" : "var(--text-muted)", fontWeight: viewMode === "ledger" ? 600 : 400 }}>
            Ledger
          </button>
        </div>
      </div>

      {showForm && (
        <div style={{ background: "var(--bg-elevated,#1a1a1a)", border: "1px solid var(--border)", borderRadius: "0.75rem", padding: "1.25rem", marginBottom: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <h3 style={{ margin: 0, fontSize: "0.95rem" }}>{editId ? "Edit Transaction" : "Log Transaction"}</h3>
            <button onClick={() => setShowForm(false)} style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", fontSize: 18 }}>×</button>
          </div>
          <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
            {["expense", "income", "future"].map(t => (
              <button key={t} onClick={() => setForm(f => ({ ...f, type: t }))}
                style={{ flex: 1, padding: "7px 0", borderRadius: "0.375rem", fontSize: 12, fontWeight: form.type === t ? 600 : 400,
                  background: form.type === t ? (t === "income" ? "rgba(34,197,94,0.15)" : t === "future" ? "rgba(99,102,241,0.15)" : "rgba(239,68,68,0.15)") : "var(--bg-raised,#1e1e1e)",
                  color: form.type === t ? (t === "income" ? "#22c55e" : t === "future" ? "#6366f1" : "#ef4444") : "var(--text-muted)",
                  border: `1px solid ${form.type === t ? (t === "income" ? "#22c55e" : t === "future" ? "#6366f1" : "#ef4444") : "var(--border)"}`, cursor: "pointer" }}>
                {t === "future" ? "Planned" : t.charAt(0).toUpperCase() + t.slice(1)}
              </button>
            ))}
          </div>
          <input placeholder="Description" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} style={inp} />
          <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
            <input type="number" placeholder="Amount" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} style={{ flex: 1 }} />
            <input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} style={{ flex: 1 }} />
          </div>
          <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} style={inp}>
            {categories.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <input placeholder="Notes (optional)" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} style={inp} />
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn" onClick={save} style={{ flex: 1, background: "var(--accent,#6366f1)", color: "#fff", border: "none" }}>Save</button>
            <button className="btn" onClick={() => setShowForm(false)} style={{ flex: 1 }}>Cancel</button>
          </div>
        </div>
      )}

      {/* ── LEDGER VIEW ── */}
      {viewMode === "ledger" && (
        <>
          {/* Summary strip */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 12 }}>
            {[
              { label: "Total in", val: ledgerTotals.totalIn, color: "#22c55e" },
              { label: "Total out", val: ledgerTotals.totalOut, color: "#ef4444" },
              { label: "Current balance", val: ledgerTotals.finalBal, color: ledgerTotals.finalBal >= 0 ? "#22c55e" : "#ef4444" },
            ].map(({ label, val, color }) => (
              <div key={label} style={{ background: "var(--bg-elevated,#1a1a1a)", border: "0.5px solid var(--border)", borderRadius: "0.5rem", padding: "0.75rem" }}>
                <div style={{ fontSize: 10, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 4 }}>{label}</div>
                <div style={{ ...mono, fontSize: 16, color }}>{formatMoney(val)}</div>
              </div>
            ))}
          </div>
          <p style={sh}>Running ledger — {ledgerRows.length} entries</p>
          {ledgerRows.length === 0
            ? <p style={{ color: "var(--text-muted)", fontSize: 13 }}>No transactions yet.</p>
            : (
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                  <thead>
                    <tr style={{ borderBottom: "1px solid var(--border)" }}>
                      {["Date", "Description", "Category", "Debit", "Credit", "Balance"].map(h => (
                        <th key={h} style={{ padding: "6px 8px", textAlign: ["Debit", "Credit", "Balance"].includes(h) ? "right" : "left", color: "var(--text-muted)", fontWeight: 500, fontSize: 10, textTransform: "uppercase", letterSpacing: "0.05em", whiteSpace: "nowrap" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {/* Opening balance row */}
                    <tr style={{ borderBottom: "0.5px solid var(--border)", background: "rgba(255,255,255,0.02)" }}>
                      <td style={{ padding: "6px 8px", color: "var(--text-muted)", fontSize: 11, whiteSpace: "nowrap" }}>Opening</td>
                      <td style={{ padding: "6px 8px", color: "var(--text-muted)", fontStyle: "italic", fontSize: 11 }}>Starting balance</td>
                      <td /><td /><td />
                      <td style={{ padding: "6px 8px", textAlign: "right", ...mono, fontSize: 12 }}>{formatMoney(startingBalance)}</td>
                    </tr>
                    {ledgerRows.map(t => {
                      const isIncome = t.type === "income";
                      const balNeg = t.runningBalance < 0;
                      return (
                        <tr key={t.id} style={{ borderBottom: "0.5px solid var(--border)", background: balNeg ? "rgba(239,68,68,0.04)" : "transparent" }}>
                          <td style={{ padding: "7px 8px", color: "var(--text-muted)", whiteSpace: "nowrap", fontSize: 11 }}>{t.date}</td>
                          <td style={{ padding: "7px 8px", maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {t.description}
                            {t.notes && <span style={{ fontSize: 10, color: "var(--text-muted)", marginLeft: 5 }}>· {t.notes}</span>}
                          </td>
                          <td style={{ padding: "7px 8px" }}>
                            <span style={{ fontSize: 10, background: "var(--bg-raised)", borderRadius: 4, padding: "2px 6px" }}>{t.category}</span>
                          </td>
                          <td style={{ padding: "7px 8px", textAlign: "right", ...mono, color: "#ef4444" }}>
                            {!isIncome ? formatMoney(t.amount) : ""}
                          </td>
                          <td style={{ padding: "7px 8px", textAlign: "right", ...mono, color: "#22c55e" }}>
                            {isIncome ? formatMoney(t.amount) : ""}
                          </td>
                          <td style={{ padding: "7px 8px", textAlign: "right", ...mono, fontSize: 13, fontWeight: 600, color: balNeg ? "#ef4444" : t.runningBalance < startingBalance * 0.2 ? "#f59e0b" : "var(--text-primary)", whiteSpace: "nowrap" }}>
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
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 12 }}>
            <select value={filterType} onChange={e => setFilterType(e.target.value)} style={{ fontSize: 13 }}>
              <option value="all">All types</option>
              <option value="expense">Expenses</option>
              <option value="income">Income</option>
              <option value="future">Planned</option>
            </select>
            <select value={filterCat} onChange={e => setFilterCat(e.target.value)} style={{ fontSize: 13 }}>
              <option value="all">All categories</option>
              {categories.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <input type="date" value={filterFrom} onChange={e => setFilterFrom(e.target.value)} placeholder="From" style={{ fontSize: 13 }} />
            <input type="date" value={filterTo} onChange={e => setFilterTo(e.target.value)} placeholder="To" style={{ fontSize: 13 }} />
          </div>

          <p style={sh}>Transactions ({filtered.length})</p>

          {filtered.length === 0
            ? <p style={{ color: "var(--text-muted)", fontSize: 13 }}>No transactions match your filters.</p>
            : (
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                  <thead>
                    <tr style={{ borderBottom: "1px solid var(--border)" }}>
                      {[["date", "Date"], ["description", "Description"], ["category", "Category"], ["amount", "Amount"], ["type", "Type"], ["", ""]].map(([col, label]) => (
                        <th key={label} onClick={col ? () => sortBy(col) : undefined}
                          style={{ padding: "6px 8px", textAlign: col === "amount" ? "right" : "left", color: "var(--text-muted)", fontWeight: 500, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.05em", cursor: col ? "pointer" : "default", whiteSpace: "nowrap" }}>
                          {label}{sortCol === col ? (sortAsc ? " ↑" : " ↓") : ""}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map(t => (
                      <tr key={t.id} style={{ borderBottom: "0.5px solid var(--border)" }}>
                        <td style={{ padding: "7px 8px", color: "var(--text-muted)", whiteSpace: "nowrap" }}>{t.date}</td>
                        <td style={{ padding: "7px 8px", maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {t.description}
                          {t.notes && <span style={{ fontSize: 11, color: "var(--text-muted)", marginLeft: 6 }}>· {t.notes}</span>}
                        </td>
                        <td style={{ padding: "7px 8px" }}><span style={{ fontSize: 11, background: "var(--bg-raised)", borderRadius: 4, padding: "2px 6px" }}>{t.category}</span></td>
                        <td style={{ padding: "7px 8px", textAlign: "right", ...mono, color: t.type === "income" ? "#22c55e" : t.type === "future" ? "#6366f1" : "#ef4444", whiteSpace: "nowrap" }}>
                          {t.type === "income" ? "+" : "-"}{formatMoney(t.amount)}
                        </td>
                        <td style={{ padding: "7px 8px", color: "var(--text-muted)", whiteSpace: "nowrap" }}>
                          {t.reconciled ? <span style={{ fontSize: 11, color: "#22c55e" }}>✓ Reconciled</span> : t.type === "future" ? "Planned" : t.type === "income" ? "Income" : "Expense"}
                        </td>
                        <td style={{ padding: "7px 8px", whiteSpace: "nowrap" }}>
                          <div style={{ display: "flex", gap: 4 }}>
                            <button className="btn-sm" onClick={() => openEdit(t)} style={{ fontSize: 11, padding: "3px 8px" }}>Edit</button>
                            {t.type === "future" && <button className="btn-sm btn-complete" onClick={() => convertFuture(t.id)} style={{ fontSize: 11, padding: "3px 8px" }}>Purchased</button>}
                            <button className="btn-sm btn-delete" onClick={() => deleteTx(t.id)} style={{ fontSize: 11, padding: "3px 8px" }}>Del</button>
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
    </div>
  );
}
