import { useEffect, useRef, useState } from "react";
import { formatMoney, toDateStr, genId, getPayPeriod, formatPeriodLabel, getBillDatesInRange } from "../../utils/budgetCalc";
import { useConfirm } from "../../hooks/useConfirm";
import "./budget.css";

const FREQ_OPTS = ["weekly","biweekly","monthly","yearly"];
const EMPTY_BILL = { name: "", amount: "", category: "Housing", frequency: "monthly", startDate: toDateStr(), autoPay: false, variable: false, notes: "" };
const EMPTY_INC = { name: "", amount: "", frequency: "biweekly", startDate: toDateStr(), endDate: "" };

export default function BudgetBillsIncome({ config, setConfig, transactions, setTransactions, startingBalance = 0, setStartingBalance, onFreshStart }) {
  const categories = config.categories || [];
  const { confirm, dialog } = useConfirm();
  const [billForm, setBillForm] = useState({ ...EMPTY_BILL });
  const [billEditId, setBillEditId] = useState(null);
  const [showBillForm, setShowBillForm] = useState(false);
  const [incForm, setIncForm] = useState({ ...EMPTY_INC });
  const [incEditId, setIncEditId] = useState(null);
  const [showIncForm, setShowIncForm] = useState(false);
  const [showSchedEdit, setShowSchedEdit] = useState(false);
  const [schedForm, setSchedForm] = useState({ type: config.paySchedule?.type || "biweekly", anchorDate: config.paySchedule?.anchorDate || toDateStr(), customDays: config.paySchedule?.customDays || 14 });
  const [newCat, setNewCat] = useState("");
  const [balInput, setBalInput] = useState(String(startingBalance));
  const [flash, setFlash] = useState("");

  const flashFor = key => { setFlash(key); setTimeout(() => setFlash(""), 1800); };

  // The Add/Edit forms render inline below long lists, so opening one from the
  // top of the page leaves it off-screen. Scroll the form into view and focus
  // its first field whenever it opens (preventScroll so it doesn't fight the
  // smooth scroll). Covers both income and recurring-bill forms.
  const billFormRef = useRef(null);
  const incFormRef = useRef(null);
  const revealForm = (ref) => {
    const el = ref.current;
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    el.querySelector("input, select, textarea")?.focus({ preventScroll: true });
  };
  useEffect(() => { if (showBillForm) revealForm(billFormRef); }, [showBillForm]);
  useEffect(() => { if (showIncForm) revealForm(incFormRef); }, [showIncForm]);

  // ── Bills ──
  const openNewBill = () => { setBillEditId(null); setBillForm({ ...EMPTY_BILL, startDate: toDateStr(), category: categories[0] || "Other" }); setShowBillForm(true); };
  const openEditBill = b => { setBillEditId(b.id); setBillForm({ name: b.name, amount: String(b.amount), category: b.category, frequency: b.frequency, startDate: b.startDate || toDateStr(), autoPay: b.autoPay, variable: !!b.variable, notes: b.notes || "" }); setShowBillForm(true); };
  const saveBill = () => {
    const amt = parseFloat(billForm.amount);
    if (!billForm.name.trim() || isNaN(amt) || amt <= 0) return;
    const nb = { id: billEditId || genId(), name: billForm.name.trim(), amount: amt, category: billForm.category, frequency: billForm.frequency, startDate: billForm.startDate, autoPay: billForm.autoPay, variable: billForm.variable, notes: billForm.notes };
    if (billEditId) setConfig(c => ({ ...c, recurringBills: c.recurringBills.map(b => b.id === billEditId ? nb : b) }));
    else setConfig(c => ({ ...c, recurringBills: [...(c.recurringBills || []), nb] }));
    setShowBillForm(false); setBillEditId(null); flashFor("bill");
  };
  const deleteBill = async id => { if (!await confirm("Delete this bill?", { title: "Delete bill", confirmLabel: "Delete" })) return; setConfig(c => ({ ...c, recurringBills: c.recurringBills.filter(b => b.id !== id) })); };

  // ── Income ──
  const openNewInc = () => { setIncEditId(null); setIncForm({ ...EMPTY_INC, startDate: toDateStr() }); setShowIncForm(true); };
  const openEditInc = inc => { setIncEditId(inc.id); setIncForm({ name: inc.name, amount: String(inc.amount), frequency: inc.frequency, startDate: inc.startDate || inc.nextDate || toDateStr(), endDate: inc.endDate || "" }); setShowIncForm(true); };
  const saveInc = () => {
    const amt = parseFloat(incForm.amount);
    if (!incForm.name.trim() || isNaN(amt) || amt <= 0 || !incForm.startDate) return;
    const ni = { id: incEditId || genId(), name: incForm.name.trim(), amount: amt, frequency: incForm.frequency, startDate: incForm.startDate, endDate: incForm.endDate || null };
    if (incEditId) setConfig(c => ({ ...c, income: c.income.map(i => i.id === incEditId ? ni : i) }));
    else setConfig(c => ({ ...c, income: [...(c.income || []), ni] }));
    setShowIncForm(false); setIncEditId(null); flashFor("inc");
  };
  const deleteInc = async id => { if (!await confirm("Delete this income source?", { title: "Delete income", confirmLabel: "Delete" })) return; setConfig(c => ({ ...c, income: c.income.filter(i => i.id !== id) })); };

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
  const removeCat = async cat => {
    const used = transactions.some(t => t.category === cat);
    if (used && !await confirm(`"${cat}" is used by transactions. Delete anyway?`, { title: "Delete category", confirmLabel: "Delete" })) return;
    setConfig(c => ({ ...c, categories: c.categories.filter(x => x !== cat) }));
  };

  // Bills schedule off frequency + startDate (there is no separate "due day"
  // field — the day-of-month comes from startDate). Surface the next occurrence
  // so the due date is visible on each bill instead of only its start date.
  const shortDate = (ds) => new Date(ds + "T00:00:00").toLocaleDateString(undefined, { month: "short", day: "numeric" });
  const nextDueOf = (b) => {
    if (b.variable) return null; // variable bills are spending envelopes, not dated
    const today = toDateStr();
    const end = toDateStr(new Date(new Date().getFullYear(), new Date().getMonth() + 4, 1));
    return getBillDatesInRange(b, today, end)[0] || null;
  };

  const upcomingPaydays = (() => {
    const dates = [], todayStr = toDateStr();
    for (let i = 0; dates.length < 3 && i < 15; i++) {
      const p = getPayPeriod(todayStr, i, config.paySchedule);
      if (p.start >= todayStr && !dates.includes(p.start)) dates.push(p.start);
    }
    return dates;
  })();

  return (
    <div>
      {/* Pay schedule */}
      <p className="bud-sh">Pay schedule</p>
      <div className="bud-panel bud-panel-bi">
        <div className="bud-row">
          <div>
            <div className="bud-title-14">{config.paySchedule?.type || "biweekly"}</div>
            <div className="bud-muted-12" style={{ marginTop: 2 }}>Next paydays: {upcomingPaydays.join(", ")}</div>
          </div>
          <button className="btn bud-btn-sm" onClick={() => setShowSchedEdit(s => !s)}>{flash === "sched" ? "✓ Saved!" : "Edit"}</button>
        </div>
        {showSchedEdit && (
          <div style={{ marginTop: 12 }}>
            <select value={schedForm.type} onChange={e => setSchedForm(f => ({ ...f, type: e.target.value }))} className="bud-inp">
              {["weekly","biweekly","semimonthly","monthly","custom"].map(t => <option key={t} value={t}>{t}</option>)}
            </select>
            <input type="date" value={schedForm.anchorDate} onChange={e => setSchedForm(f => ({ ...f, anchorDate: e.target.value }))} placeholder="Anchor/next payday" className="bud-inp" />
            {schedForm.type === "custom" && <input type="number" value={schedForm.customDays} onChange={e => setSchedForm(f => ({ ...f, customDays: e.target.value }))} placeholder="Days per period" className="bud-inp" />}
            <button className="btn" onClick={saveSched} style={{ width: "100%", background: "var(--accent)", color: "var(--text-on-accent)", border: "none" }}>Save schedule</button>
          </div>
        )}
      </div>

      {/* Income sources */}
      <div className="bud-row-b">
        <p className="bud-sh">Income sources</p>
        <button className="btn bud-btn-xs" onClick={openNewInc}>+ Add</button>
      </div>
      {(config.income || []).length === 0
        ? <p className="bud-muted-13">No income sources added yet.</p>
        : (config.income || []).map(inc => {
          const from = inc.startDate || inc.nextDate;
          const to = inc.endDate;
          const todayStr = toDateStr();
          const isActive = (!from || from <= todayStr) && (!to || to >= todayStr);
          const isPast = to && to < todayStr;
          const isFuture = from && from > todayStr;
          const statusColor = isPast ? "var(--text-muted)" : isFuture ? "var(--orange)" : "var(--green)";
          return (
          <div key={inc.id} className="bud-panel bud-panel-bi" style={{ display: "flex", alignItems: "center", opacity: isPast ? 0.55 : 1 }}>
            <div style={{ flex: 1 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span className="bud-title-14">{inc.name}</span>
                <span style={{ fontSize: 10, color: statusColor, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>{isPast ? "ended" : isFuture ? "upcoming" : "active"}</span>
              </div>
              <div className="bud-muted-11" style={{ marginTop: 2 }}>
                {inc.frequency} · {from ? `from ${from}` : "no start"}{to ? ` → ${to}` : " → ongoing"}
              </div>
            </div>
            <span className="bud-mono bud-amt-14">{formatMoney(inc.amount)}</span>
            <div className="bud-actions">
              <button className="btn-sm bud-btn-xs" onClick={() => openEditInc(inc)}>Edit</button>
              <button className="btn-sm btn-delete bud-btn-xs" onClick={() => deleteInc(inc.id)}>Del</button>
            </div>
          </div>
          );
        })
      }
      {showIncForm && (
        <div ref={incFormRef} className="bud-panel bud-panel-bi" style={{ borderColor: "var(--accent)" }}>
          <div className="bud-form-title">{incEditId ? "Edit income" : "Add income source"}</div>
          <input placeholder="Name (e.g. TxtSquad)" value={incForm.name} onChange={e => setIncForm(f => ({ ...f, name: e.target.value }))} className="bud-inp" />
          <div className="bud-hstack" style={{ marginBottom: 8 }}>
            <input type="number" placeholder="Amount" value={incForm.amount} onChange={e => setIncForm(f => ({ ...f, amount: e.target.value }))} style={{ flex: 1 }} />
            <select value={incForm.frequency} onChange={e => setIncForm(f => ({ ...f, frequency: e.target.value }))} style={{ flex: 1, fontSize: 13 }}>
              {FREQ_OPTS.map(f => <option key={f} value={f}>{f}</option>)}
            </select>
          </div>
          <label className="bud-label">Start date (first payday)</label>
          <input type="date" value={incForm.startDate} onChange={e => setIncForm(f => ({ ...f, startDate: e.target.value }))} className="bud-inp" />
          <label className="bud-label">End date <span style={{ fontWeight: 400, opacity: 0.7 }}>(optional — leave blank for ongoing)</span></label>
          <input type="date" value={incForm.endDate} onChange={e => setIncForm(f => ({ ...f, endDate: e.target.value }))} className="bud-inp" />
          <div className="bud-hstack">
            <button className="btn bud-flex1" onClick={saveInc} style={{ background: flash === "inc" ? "var(--green)" : "var(--accent)", color: "var(--text-on-accent)", border: "none" }}>{flash === "inc" ? "✓ Saved!" : "Save"}</button>
            <button className="btn bud-flex1" onClick={() => setShowIncForm(false)}>Cancel</button>
          </div>
        </div>
      )}

      {/* Recurring bills */}
      <div className="bud-row-b">
        <p className="bud-sh">Recurring bills</p>
        <button className="btn bud-btn-xs" onClick={openNewBill}>+ Add</button>
      </div>
      {(config.recurringBills || []).length === 0
        ? <p className="bud-muted-13">No bills added yet.</p>
        : (config.recurringBills || []).map(b => (
          <div key={b.id} className="bud-panel bud-panel-bi" style={{ display: "flex", alignItems: "center" }}>
            <div style={{ flex: 1 }}>
              <div className="bud-title-14">{b.name}</div>
              <div className="bud-muted-11" style={{ marginTop: 2 }}>{b.category} · {b.frequency} · from {b.startDate}{(() => { const nd = nextDueOf(b); return nd ? ` · next ${shortDate(nd)}` : ""; })()}{b.variable ? " · variable" : b.autoPay ? " · auto" : ""}</div>
            </div>
            <span className="bud-mono bud-amt-14">{formatMoney(b.amount)}</span>
            <div className="bud-actions">
              <button className="btn-sm bud-btn-xs" onClick={() => openEditBill(b)}>Edit</button>
              <button className="btn-sm btn-delete bud-btn-xs" onClick={() => deleteBill(b.id)}>Del</button>
            </div>
          </div>
        ))
      }
      {showBillForm && (
        <div ref={billFormRef} className="bud-panel bud-panel-bi" style={{ borderColor: "var(--orange)" }}>
          <div className="bud-form-title">{billEditId ? "Edit bill" : "Add recurring bill"}</div>
          <input placeholder="Name (e.g. Rent, Netflix)" value={billForm.name} onChange={e => setBillForm(f => ({ ...f, name: e.target.value }))} className="bud-inp" />
          <div className="bud-hstack" style={{ marginBottom: 8 }}>
            <input type="number" placeholder="Amount" value={billForm.amount} onChange={e => setBillForm(f => ({ ...f, amount: e.target.value }))} style={{ flex: 1 }} />
            <select value={billForm.frequency} onChange={e => setBillForm(f => ({ ...f, frequency: e.target.value }))} style={{ flex: 1, fontSize: 13 }}>
              {FREQ_OPTS.map(f => <option key={f} value={f}>{f}</option>)}
            </select>
          </div>
          <select value={billForm.category} onChange={e => setBillForm(f => ({ ...f, category: e.target.value }))} className="bud-inp">
            {categories.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <label className="bud-label">Start date (first billing date)</label>
          <input type="date" value={billForm.startDate} onChange={e => setBillForm(f => ({ ...f, startDate: e.target.value }))} className="bud-inp" />
          <label style={{ display: "flex", alignItems: "flex-start", gap: 8, fontSize: 13, marginBottom: 8, cursor: "pointer" }}>
            <input type="checkbox" checked={billForm.variable} onChange={e => setBillForm(f => ({ ...f, variable: e.target.checked }))} style={{ marginTop: 3 }} />
            <span>Variable / quantifiable <span style={{ color: "var(--text-muted)" }}>— track spending against this amount (e.g. Groceries, Gas, Maria). Shows a progress bar instead of paid/unpaid.</span></span>
          </label>
          {!billForm.variable && (
            <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, marginBottom: 10, cursor: "pointer" }}>
              <input type="checkbox" checked={billForm.autoPay} onChange={e => setBillForm(f => ({ ...f, autoPay: e.target.checked }))} />
              Auto-pay (won't prompt to pay manually)
            </label>
          )}
          <input placeholder="Notes (optional)" value={billForm.notes} onChange={e => setBillForm(f => ({ ...f, notes: e.target.value }))} className="bud-inp" />
          <div className="bud-hstack">
            <button className="btn bud-flex1" onClick={saveBill} style={{ background: flash === "bill" ? "var(--green)" : "var(--orange)", color: "var(--text-on-accent)", border: "none", fontWeight: 600 }}>{flash === "bill" ? "✓ Saved!" : "Save bill"}</button>
            <button className="btn bud-flex1" onClick={() => setShowBillForm(false)}>Cancel</button>
          </div>
        </div>
      )}

      {/* Categories */}
      <p className="bud-sh">Categories</p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 10 }}>
        {categories.map(c => (
          <span key={c} className="bud-chip">
            {c}
            <button onClick={() => removeCat(c)} className="bud-x" style={{ fontSize: 13, padding: 0, lineHeight: 1, marginLeft: 2 }}>×</button>
          </span>
        ))}
      </div>
      <div className="bud-hstack">
        <input value={newCat} onChange={e => setNewCat(e.target.value)} onKeyDown={e => e.key === "Enter" && addCat()} placeholder="New category…" style={{ flex: 1, fontSize: 13 }} />
        <button className="btn bud-btn-sm2" onClick={addCat}>Add</button>
      </div>

      {/* Starting balance */}
      <p className="bud-sh">Starting balance</p>
      <div className="bud-panel bud-panel-bi">
        <div className="bud-muted-12" style={{ marginBottom: 8 }}>The balance you're starting from. Used in the ledger running total and simulator.</div>
        <div className="bud-hstack">
          <input type="number" step="0.01" value={balInput} onChange={e => setBalInput(e.target.value)} placeholder="0.00" style={{ flex: 1, fontFamily: "var(--font-mono,monospace)" }} />
          <button className="btn bud-btn-sm2" onClick={() => { const v = parseFloat(balInput); if (!isNaN(v)) { setStartingBalance(v); flashFor("bal"); } }} style={{ background: flash === "bal" ? "var(--green)" : undefined, color: flash === "bal" ? "#000" : undefined }}>
            {flash === "bal" ? "✓ Saved!" : "Set balance"}
          </button>
        </div>
      </div>

      {/* Fresh start */}
      <p className="bud-sh">Reset</p>
      <div className="bud-panel bud-panel-bi" style={{ border: "0.5px solid var(--danger-bg)" }}>
        <div className="bud-muted-12" style={{ marginBottom: 10 }}>
          Clear all transaction history and reset your balance to $0. Your recurring bills, income sources, pay schedule, and categories are kept.
        </div>
        <button className="btn"
          onClick={async () => {
            if (!await confirm("Clear all transactions and reset balance to $0? Your bills config is kept. This cannot be undone.", { title: "Fresh start", confirmLabel: "Reset" })) return;
            if (onFreshStart) onFreshStart();
          }}
          style={{ background: "var(--danger-bg)", color: "var(--red)", border: "1px solid var(--danger-bg)", fontWeight: 600, width: "100%" }}>
          Fresh start — clear transactions &amp; reset balance
        </button>
      </div>
      {dialog}
    </div>
  );
}
