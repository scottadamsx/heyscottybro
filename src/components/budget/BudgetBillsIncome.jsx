import { useState } from "react";
import { formatMoney, toDateStr, genId, getPayPeriod, formatPeriodLabel } from "../../utils/budgetCalc";

const FREQ_OPTS = ["weekly","biweekly","monthly","yearly"];
const EMPTY_BILL = { name: "", amount: "", category: "Housing", frequency: "monthly", startDate: toDateStr(), autoPay: false, notes: "" };
const EMPTY_INC = { name: "", amount: "", frequency: "biweekly", nextDate: toDateStr() };

export default function BudgetBillsIncome({ config, setConfig, transactions, setTransactions }) {
  const categories = config.categories || [];
  const [billForm, setBillForm] = useState({ ...EMPTY_BILL });
  const [billEditId, setBillEditId] = useState(null);
  const [showBillForm, setShowBillForm] = useState(false);
  const [incForm, setIncForm] = useState({ ...EMPTY_INC });
  const [incEditId, setIncEditId] = useState(null);
  const [showIncForm, setShowIncForm] = useState(false);
  const [showSchedEdit, setShowSchedEdit] = useState(false);
  const [schedForm, setSchedForm] = useState({ type: config.paySchedule?.type || "biweekly", anchorDate: config.paySchedule?.anchorDate || toDateStr(), customDays: config.paySchedule?.customDays || 14 });
  const [newCat, setNewCat] = useState("");
  const [flash, setFlash] = useState("");

  const flashFor = key => { setFlash(key); setTimeout(() => setFlash(""), 1800); };

  // ── Bills ──
  const openNewBill = () => { setBillEditId(null); setBillForm({ ...EMPTY_BILL, startDate: toDateStr(), category: categories[0] || "Other" }); setShowBillForm(true); };
  const openEditBill = b => { setBillEditId(b.id); setBillForm({ name: b.name, amount: String(b.amount), category: b.category, frequency: b.frequency, startDate: b.startDate || toDateStr(), autoPay: b.autoPay, notes: b.notes || "" }); setShowBillForm(true); };
  const saveBill = () => {
    const amt = parseFloat(billForm.amount);
    if (!billForm.name.trim() || isNaN(amt) || amt <= 0) return;
    const nb = { id: billEditId || genId(), name: billForm.name.trim(), amount: amt, category: billForm.category, frequency: billForm.frequency, startDate: billForm.startDate, autoPay: billForm.autoPay, notes: billForm.notes };
    if (billEditId) setConfig(c => ({ ...c, recurringBills: c.recurringBills.map(b => b.id === billEditId ? nb : b) }));
    else setConfig(c => ({ ...c, recurringBills: [...(c.recurringBills || []), nb] }));
    setShowBillForm(false); setBillEditId(null); flashFor("bill");
  };
  const deleteBill = id => { if (!window.confirm("Delete this bill?")) return; setConfig(c => ({ ...c, recurringBills: c.recurringBills.filter(b => b.id !== id) })); };

  // ── Income ──
  const openNewInc = () => { setIncEditId(null); setIncForm({ ...EMPTY_INC, nextDate: toDateStr() }); setShowIncForm(true); };
  const openEditInc = inc => { setIncEditId(inc.id); setIncForm({ name: inc.name, amount: String(inc.amount), frequency: inc.frequency, nextDate: inc.nextDate }); setShowIncForm(true); };
  const saveInc = () => {
    const amt = parseFloat(incForm.amount);
    if (!incForm.name.trim() || isNaN(amt) || amt <= 0 || !incForm.nextDate) return;
    const ni = { id: incEditId || genId(), name: incForm.name.trim(), amount: amt, frequency: incForm.frequency, nextDate: incForm.nextDate };
    if (incEditId) setConfig(c => ({ ...c, income: c.income.map(i => i.id === incEditId ? ni : i) }));
    else setConfig(c => ({ ...c, income: [...(c.income || []), ni] }));
    setShowIncForm(false); setIncEditId(null); flashFor("inc");
  };
  const deleteInc = id => { if (!window.confirm("Delete this income source?")) return; setConfig(c => ({ ...c, income: c.income.filter(i => i.id !== id) })); };

  // ── One-time income ──
  const logOneTimeIncome = (desc, amount, date) => {
    const tx = { id: genId(), description: desc, amount, type: "income", category: "Other", date, notes: "", reconciled: false };
    setTransactions(p => [tx, ...p]);
  };

  // ── Pay schedule ──
  const saveSched = () => {
    setConfig(c => ({ ...c, paySchedule: { type: schedForm.type, anchorDate: schedForm.anchorDate, customDays: schedForm.type === "custom" ? parseInt(schedForm.customDays) || 14 : null } }));
    setShowSchedEdit(false); flashFor("sched");
  };

  // ── Categories ──
  const addCat = () => {
    const n = newCat.trim();
    if (!n || categories.includes(n)) return;
    setConfig(c => ({ ...c, categories: [...c.categories, n] }));
    setNewCat("");
  };
  const removeCat = cat => {
    const used = transactions.some(t => t.category === cat);
    if (used && !window.confirm(`"${cat}" is used by transactions. Delete anyway?`)) return;
    setConfig(c => ({ ...c, categories: c.categories.filter(x => x !== cat) }));
  };

  const upcomingPaydays = (() => {
    const dates = [], todayStr = toDateStr();
    for (let i = 0; dates.length < 3 && i < 15; i++) {
      const p = getPayPeriod(todayStr, i, config.paySchedule);
      if (p.start >= todayStr && !dates.includes(p.start)) dates.push(p.start);
    }
    return dates;
  })();

  const sh = { fontSize: 11, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--text-muted)", margin: "16px 0 8px", fontWeight: 500 };
  const card = { background: "var(--bg-elevated,#1a1a1a)", border: "0.5px solid var(--border)", borderRadius: "0.5rem", padding: "0.875rem", marginBottom: 8 };
  const inp = { width: "100%", marginBottom: 8 };
  const mono = { fontFamily: "var(--font-mono,monospace)", fontWeight: 500 };

  return (
    <div>
      {/* Pay schedule */}
      <p style={sh}>Pay schedule</p>
      <div style={card}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 500 }}>{config.paySchedule?.type || "biweekly"}</div>
            <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>Next paydays: {upcomingPaydays.join(", ")}</div>
          </div>
          <button className="btn" onClick={() => setShowSchedEdit(s => !s)} style={{ fontSize: 12, padding: "4px 10px" }}>{flash === "sched" ? "✓ Saved!" : "Edit"}</button>
        </div>
        {showSchedEdit && (
          <div style={{ marginTop: 12 }}>
            <select value={schedForm.type} onChange={e => setSchedForm(f => ({ ...f, type: e.target.value }))} style={inp}>
              {["weekly","biweekly","semimonthly","monthly","custom"].map(t => <option key={t} value={t}>{t}</option>)}
            </select>
            <input type="date" value={schedForm.anchorDate} onChange={e => setSchedForm(f => ({ ...f, anchorDate: e.target.value }))} placeholder="Anchor/next payday" style={inp} />
            {schedForm.type === "custom" && <input type="number" value={schedForm.customDays} onChange={e => setSchedForm(f => ({ ...f, customDays: e.target.value }))} placeholder="Days per period" style={inp} />}
            <button className="btn" onClick={saveSched} style={{ width: "100%", background: "var(--accent,#6366f1)", color: "#fff", border: "none" }}>Save schedule</button>
          </div>
        )}
      </div>

      {/* Income sources */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <p style={sh}>Income sources</p>
        <button className="btn" onClick={openNewInc} style={{ fontSize: 11, padding: "3px 8px" }}>+ Add</button>
      </div>
      {(config.income || []).length === 0
        ? <p style={{ color: "var(--text-muted)", fontSize: 13 }}>No income sources added yet.</p>
        : (config.income || []).map(inc => (
          <div key={inc.id} style={{ ...card, display: "flex", alignItems: "center" }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 500 }}>{inc.name}</div>
              <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>{inc.frequency} · next: {inc.nextDate}</div>
            </div>
            <span style={{ ...mono, fontSize: 14, marginRight: 12 }}>{formatMoney(inc.amount)}</span>
            <div style={{ display: "flex", gap: 4 }}>
              <button className="btn-sm" onClick={() => openEditInc(inc)} style={{ fontSize: 11, padding: "3px 8px" }}>Edit</button>
              <button className="btn-sm btn-delete" onClick={() => deleteInc(inc.id)} style={{ fontSize: 11, padding: "3px 8px" }}>Del</button>
            </div>
          </div>
        ))
      }
      {showIncForm && (
        <div style={{ ...card, borderColor: "var(--accent,#6366f1)" }}>
          <div style={{ fontSize: 12, color: "var(--text-muted)", fontWeight: 500, marginBottom: 10, textTransform: "uppercase", letterSpacing: "0.06em" }}>{incEditId ? "Edit income" : "Add income source"}</div>
          <input placeholder="Name (e.g. TxtSquad)" value={incForm.name} onChange={e => setIncForm(f => ({ ...f, name: e.target.value }))} style={inp} />
          <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
            <input type="number" placeholder="Amount" value={incForm.amount} onChange={e => setIncForm(f => ({ ...f, amount: e.target.value }))} style={{ flex: 1 }} />
            <select value={incForm.frequency} onChange={e => setIncForm(f => ({ ...f, frequency: e.target.value }))} style={{ flex: 1, fontSize: 13 }}>
              {FREQ_OPTS.map(f => <option key={f} value={f}>{f}</option>)}
            </select>
          </div>
          <label style={{ fontSize: 12, color: "var(--text-muted)", display: "block", marginBottom: 4 }}>Next payday</label>
          <input type="date" value={incForm.nextDate} onChange={e => setIncForm(f => ({ ...f, nextDate: e.target.value }))} style={inp} />
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn" onClick={saveInc} style={{ flex: 1, background: flash === "inc" ? "#22c55e" : "var(--accent,#6366f1)", color: "#fff", border: "none" }}>{flash === "inc" ? "✓ Saved!" : "Save"}</button>
            <button className="btn" onClick={() => setShowIncForm(false)} style={{ flex: 1 }}>Cancel</button>
          </div>
        </div>
      )}

      {/* Recurring bills */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <p style={sh}>Recurring bills</p>
        <button className="btn" onClick={openNewBill} style={{ fontSize: 11, padding: "3px 8px" }}>+ Add</button>
      </div>
      {(config.recurringBills || []).length === 0
        ? <p style={{ color: "var(--text-muted)", fontSize: 13 }}>No bills added yet.</p>
        : (config.recurringBills || []).map(b => (
          <div key={b.id} style={{ ...card, display: "flex", alignItems: "center" }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 500 }}>{b.name}</div>
              <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>{b.category} · {b.frequency} · from {b.startDate}{b.autoPay ? " · auto" : ""}</div>
            </div>
            <span style={{ ...mono, fontSize: 14, marginRight: 12 }}>{formatMoney(b.amount)}</span>
            <div style={{ display: "flex", gap: 4 }}>
              <button className="btn-sm" onClick={() => openEditBill(b)} style={{ fontSize: 11, padding: "3px 8px" }}>Edit</button>
              <button className="btn-sm btn-delete" onClick={() => deleteBill(b.id)} style={{ fontSize: 11, padding: "3px 8px" }}>Del</button>
            </div>
          </div>
        ))
      }
      {showBillForm && (
        <div style={{ ...card, borderColor: "#f59e0b" }}>
          <div style={{ fontSize: 12, color: "var(--text-muted)", fontWeight: 500, marginBottom: 10, textTransform: "uppercase", letterSpacing: "0.06em" }}>{billEditId ? "Edit bill" : "Add recurring bill"}</div>
          <input placeholder="Name (e.g. Rent, Netflix)" value={billForm.name} onChange={e => setBillForm(f => ({ ...f, name: e.target.value }))} style={inp} />
          <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
            <input type="number" placeholder="Amount" value={billForm.amount} onChange={e => setBillForm(f => ({ ...f, amount: e.target.value }))} style={{ flex: 1 }} />
            <select value={billForm.frequency} onChange={e => setBillForm(f => ({ ...f, frequency: e.target.value }))} style={{ flex: 1, fontSize: 13 }}>
              {FREQ_OPTS.map(f => <option key={f} value={f}>{f}</option>)}
            </select>
          </div>
          <select value={billForm.category} onChange={e => setBillForm(f => ({ ...f, category: e.target.value }))} style={inp}>
            {categories.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <label style={{ fontSize: 12, color: "var(--text-muted)", display: "block", marginBottom: 4 }}>Start date (first billing date)</label>
          <input type="date" value={billForm.startDate} onChange={e => setBillForm(f => ({ ...f, startDate: e.target.value }))} style={inp} />
          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, marginBottom: 10, cursor: "pointer" }}>
            <input type="checkbox" checked={billForm.autoPay} onChange={e => setBillForm(f => ({ ...f, autoPay: e.target.checked }))} />
            Auto-pay (won't prompt to pay manually)
          </label>
          <input placeholder="Notes (optional)" value={billForm.notes} onChange={e => setBillForm(f => ({ ...f, notes: e.target.value }))} style={inp} />
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn" onClick={saveBill} style={{ flex: 1, background: flash === "bill" ? "#22c55e" : "#f59e0b", color: "#000", border: "none", fontWeight: 600 }}>{flash === "bill" ? "✓ Saved!" : "Save bill"}</button>
            <button className="btn" onClick={() => setShowBillForm(false)} style={{ flex: 1 }}>Cancel</button>
          </div>
        </div>
      )}

      {/* Categories */}
      <p style={sh}>Categories</p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 10 }}>
        {categories.map(c => (
          <span key={c} style={{ display: "inline-flex", alignItems: "center", gap: 4, background: "var(--bg-raised,#1e1e1e)", border: "0.5px solid var(--border)", borderRadius: 99, padding: "4px 10px", fontSize: 12 }}>
            {c}
            <button onClick={() => removeCat(c)} style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", fontSize: 13, padding: 0, lineHeight: 1, marginLeft: 2 }}>×</button>
          </span>
        ))}
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <input value={newCat} onChange={e => setNewCat(e.target.value)} onKeyDown={e => e.key === "Enter" && addCat()} placeholder="New category…" style={{ flex: 1, fontSize: 13 }} />
        <button className="btn" onClick={addCat} style={{ fontSize: 12, padding: "4px 12px" }}>Add</button>
      </div>
    </div>
  );
}
