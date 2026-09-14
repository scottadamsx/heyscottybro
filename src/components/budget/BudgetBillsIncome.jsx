import { useEffect, useRef, useState } from "react";
import { formatMoney, toDateStr, genId, getPayPeriod, getBillDatesInRange } from "../../utils/budgetCalc";
import { useConfirm } from "../../hooks/useConfirm";
import "./budget.css";
import DatePicker from "../DatePicker";

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

  // "Saved" flashes on the button that saved: same button, success tone.
  const saveBtn = (key) => `btn btn-sm${flash === key ? " btn-complete" : ""}`;

  return (
    <div className="money money-tab">
      <div className="bi-grid">
        {/* ── Money in and out ── */}
        <div className="bi-col">
          {/* Income sources */}
          <div className="db-card">
            <div className="db-card-header">
              <h3 className="db-card-title">Income sources</h3>
              <button type="button" className="btn-sm btn-secondary-sm" onClick={openNewInc}><i className="fa-solid fa-plus" aria-hidden="true" /> Add</button>
            </div>
            {(config.income || []).length === 0
              ? <p className="money-card-note">No income sources added yet.</p>
              : (
                <div className="bi-list">
                  {(config.income || []).map(inc => {
                    const from = inc.startDate || inc.nextDate;
                    const to = inc.endDate;
                    const todayStr = toDateStr();
                    const isPast = to && to < todayStr;
                    const isFuture = from && from > todayStr;
                    return (
                      <div key={inc.id} className={`bi-row${isPast ? " is-ended" : ""}`}>
                        <div className="bi-row-main">
                          <div className="bi-row-name">
                            <span className="bud-ellipsis">{inc.name}</span>
                            <span className={`bud-status ${isPast ? "is-ended" : isFuture ? "is-upcoming" : "is-active"}`}>{isPast ? "Ended" : isFuture ? "Upcoming" : "Active"}</span>
                          </div>
                          <div className="bi-row-sub">
                            {inc.frequency} · {from ? `from ${from}` : "no start"}{to ? ` → ${to}` : " → ongoing"}
                          </div>
                        </div>
                        <span className="bi-row-amt">{formatMoney(inc.amount)}</span>
                        <div className="bud-actions">
                          <button type="button" className="btn-mini" onClick={() => openEditInc(inc)}>Edit</button>
                          <button type="button" className="btn-mini danger" onClick={() => deleteInc(inc.id)} aria-label={`Delete ${inc.name}`}>Delete</button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )
            }
            {showIncForm && (
              <div ref={incFormRef} className="bi-form">
                <h4 className="bi-form-title">{incEditId ? "Edit income" : "Add income source"}</h4>
                <input placeholder="Name (e.g. TxtSquad)" aria-label="Name" value={incForm.name} onChange={e => setIncForm(f => ({ ...f, name: e.target.value }))} />
                <div className="form-row">
                  <input type="number" placeholder="Amount" aria-label="Amount" value={incForm.amount} onChange={e => setIncForm(f => ({ ...f, amount: e.target.value }))} />
                  <select value={incForm.frequency} aria-label="Frequency" onChange={e => setIncForm(f => ({ ...f, frequency: e.target.value }))}>
                    {FREQ_OPTS.map(f => <option key={f} value={f}>{f}</option>)}
                  </select>
                </div>
                <div className="money-field">
                  <span className="field-label">Start date (first payday)</span>
                  <DatePicker value={incForm.startDate} onChange={(v) => setIncForm(f => ({ ...f, startDate: v }))} />
                </div>
                <div className="money-field">
                  <span className="field-label">End date <span className="bi-hint">(optional — leave blank for ongoing)</span></span>
                  <DatePicker value={incForm.endDate} onChange={(v) => setIncForm(f => ({ ...f, endDate: v }))} />
                </div>
                <div className="form-actions">
                  <button type="button" className={saveBtn("inc")} onClick={saveInc}>{flash === "inc" ? "Saved" : "Save"}</button>
                  <button type="button" className="btn-sm btn-secondary-sm" onClick={() => setShowIncForm(false)}>Cancel</button>
                </div>
              </div>
            )}
          </div>

          {/* Recurring bills */}
          <div className="db-card">
            <div className="db-card-header">
              <h3 className="db-card-title">Recurring bills</h3>
              <button type="button" className="btn-sm btn-secondary-sm" onClick={openNewBill}><i className="fa-solid fa-plus" aria-hidden="true" /> Add</button>
            </div>
            {(config.recurringBills || []).length === 0
              ? <p className="money-card-note">No bills added yet.</p>
              : (
                <div className="bi-list">
                  {(config.recurringBills || []).map(b => (
                    <div key={b.id} className="bi-row">
                      <div className="bi-row-main">
                        <div className="bi-row-name"><span className="bud-ellipsis">{b.name}</span></div>
                        <div className="bi-row-sub">{(() => { const nd = nextDueOf(b); return [b.category, b.frequency, `from ${b.startDate}`, nd && `next ${shortDate(nd)}`, b.variable ? "variable" : b.autoPay ? "auto" : ""].filter(Boolean).join(" · "); })()}</div>
                      </div>
                      <span className="bi-row-amt">{formatMoney(b.amount)}</span>
                      <div className="bud-actions">
                        <button type="button" className="btn-mini" onClick={() => openEditBill(b)}>Edit</button>
                        <button type="button" className="btn-mini danger" onClick={() => deleteBill(b.id)} aria-label={`Delete ${b.name}`}>Delete</button>
                      </div>
                    </div>
                  ))}
                </div>
              )
            }
            {showBillForm && (
              <div ref={billFormRef} className="bi-form">
                <h4 className="bi-form-title">{billEditId ? "Edit bill" : "Add recurring bill"}</h4>
                <input placeholder="Name (e.g. Rent, Netflix)" aria-label="Name" value={billForm.name} onChange={e => setBillForm(f => ({ ...f, name: e.target.value }))} />
                <div className="form-row">
                  <input type="number" placeholder="Amount" aria-label="Amount" value={billForm.amount} onChange={e => setBillForm(f => ({ ...f, amount: e.target.value }))} />
                  <select value={billForm.frequency} aria-label="Frequency" onChange={e => setBillForm(f => ({ ...f, frequency: e.target.value }))}>
                    {FREQ_OPTS.map(f => <option key={f} value={f}>{f}</option>)}
                  </select>
                </div>
                <select value={billForm.category} aria-label="Category" onChange={e => setBillForm(f => ({ ...f, category: e.target.value }))}>
                  {categories.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                <div className="money-field">
                  <span className="field-label">Start date (first billing date)</span>
                  <DatePicker value={billForm.startDate} onChange={(v) => setBillForm(f => ({ ...f, startDate: v }))} />
                </div>
                <label className="bi-check">
                  <input type="checkbox" checked={billForm.variable} onChange={e => setBillForm(f => ({ ...f, variable: e.target.checked }))} />
                  <span>Variable / quantifiable <span className="bi-hint">— track spending against this amount (e.g. Groceries, Gas, Fun). Shows a progress bar instead of paid/unpaid.</span></span>
                </label>
                {!billForm.variable && (
                  <label className="bi-check">
                    <input type="checkbox" checked={billForm.autoPay} onChange={e => setBillForm(f => ({ ...f, autoPay: e.target.checked }))} />
                    <span>Auto-pay (won&apos;t prompt to pay manually)</span>
                  </label>
                )}
                <input placeholder="Notes (optional)" aria-label="Notes" value={billForm.notes} onChange={e => setBillForm(f => ({ ...f, notes: e.target.value }))} />
                <div className="form-actions">
                  <button type="button" className={saveBtn("bill")} onClick={saveBill}>{flash === "bill" ? "Saved" : "Save bill"}</button>
                  <button type="button" className="btn-sm btn-secondary-sm" onClick={() => setShowBillForm(false)}>Cancel</button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── Settings ── */}
        <div className="bi-col">
          {/* Pay schedule */}
          <div className="db-card">
            <div className="db-card-header">
              <h3 className="db-card-title">Pay schedule</h3>
              <button type="button" className={flash === "sched" ? "btn-sm btn-complete" : "btn-sm btn-secondary-sm"} aria-expanded={showSchedEdit} onClick={() => setShowSchedEdit(s => !s)}>{flash === "sched" ? "Saved" : "Edit"}</button>
            </div>
            <div className="bi-sched-type">{config.paySchedule?.type || "biweekly"}</div>
            <div className="bi-row-sub">Next paydays: {upcomingPaydays.join(", ")}</div>
            {showSchedEdit && (
              <div className="bi-form">
                <select value={schedForm.type} aria-label="Pay schedule" onChange={e => setSchedForm(f => ({ ...f, type: e.target.value }))}>
                  {["weekly","biweekly","semimonthly","monthly","custom"].map(t => <option key={t} value={t}>{t}</option>)}
                </select>
                <DatePicker value={schedForm.anchorDate} onChange={(v) => setSchedForm(f => ({ ...f, anchorDate: v }))} placeholder="Anchor/next payday" />
                {schedForm.type === "custom" && <input type="number" value={schedForm.customDays} aria-label="Days per period" onChange={e => setSchedForm(f => ({ ...f, customDays: e.target.value }))} placeholder="Days per period" />}
                <div className="form-actions">
                  <button type="button" className="btn btn-sm" onClick={saveSched}>Save schedule</button>
                </div>
              </div>
            )}
          </div>

          {/* Categories */}
          <div className="db-card">
            <div className="db-card-header"><h3 className="db-card-title">Categories</h3></div>
            <div className="bi-cats">
              {categories.map(c => (
                <span key={c} className="bud-chip">
                  {c}
                  <button type="button" onClick={() => removeCat(c)} className="bi-chip-x" aria-label={`Remove ${c}`}><i className="fa-solid fa-xmark" aria-hidden="true" /></button>
                </span>
              ))}
            </div>
            <div className="bi-inline">
              <input value={newCat} aria-label="New category" onChange={e => setNewCat(e.target.value)} onKeyDown={e => e.key === "Enter" && addCat()} placeholder="New category…" />
              <button type="button" className="btn btn-sm" onClick={addCat}>Add</button>
            </div>
          </div>

          {/* Starting balance */}
          <div className="db-card">
            <div className="db-card-header"><h3 className="db-card-title">Starting balance</h3></div>
            <p className="money-card-note">The balance you&apos;re starting from. Used in the ledger running total and simulator.</p>
            <div className="bi-inline">
              <input type="number" step="0.01" value={balInput} aria-label="Starting balance" onChange={e => setBalInput(e.target.value)} placeholder="0.00" />
              <button type="button" className={saveBtn("bal")} onClick={() => { const v = parseFloat(balInput); if (!isNaN(v)) { setStartingBalance(v); flashFor("bal"); } }}>
                {flash === "bal" ? "Saved" : "Set balance"}
              </button>
            </div>
          </div>

          {/* Fresh start */}
          <div className="db-card">
            <div className="db-card-header"><h3 className="db-card-title">Reset</h3></div>
            <p className="money-card-note">
              Clear all transaction history and reset your balance to $0. Your recurring bills, income sources, pay schedule, and categories are kept.
            </p>
            <button type="button" className="btn-sm btn-delete bi-reset"
              onClick={async () => {
                if (!await confirm("Clear all transactions and reset balance to $0? Your bills config is kept. This cannot be undone.", { title: "Fresh start", confirmLabel: "Reset" })) return;
                if (onFreshStart) onFreshStart();
              }}
            >
              Fresh start: clear transactions &amp; reset balance
            </button>
          </div>
        </div>
      </div>
      {dialog}
    </div>
  );
}
