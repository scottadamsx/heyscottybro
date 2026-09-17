import { useState } from "react";
import { formatMoney, toDateStr, genId, getPayPeriod, getBillDatesInRange } from "../../utils/budgetCalc";
import { useConfirm } from "../../hooks/useConfirm";
import "./budget.css";
import DatePicker from "../DatePicker";
import { FormModal, Field } from "../ui";

const FREQ_OPTS = ["weekly","biweekly","monthly","yearly"];
const SCHED_OPTS = ["weekly","biweekly","semimonthly","monthly","custom"];
const EMPTY_BILL = { name: "", amount: "", category: "Housing", frequency: "monthly", startDate: toDateStr(), autoPay: false, variable: false, notes: "" };
const EMPTY_INC = { name: "", amount: "", frequency: "biweekly", startDate: toDateStr(), endDate: "" };

// Which form modal is open: "inc" | "bill" | "sched" | "cat" | "bal" | "reset" | null
export default function BudgetBillsIncome({ config, setConfig, transactions, startingBalance = 0, setStartingBalance, onFreshStart }) {
  const categories = config.categories || [];
  const { confirm, dialog } = useConfirm();
  const [modal, setModal] = useState(null);
  const close = () => setModal(null);
  const [billForm, setBillForm] = useState({ ...EMPTY_BILL });
  const [billEditId, setBillEditId] = useState(null);
  const [incForm, setIncForm] = useState({ ...EMPTY_INC });
  const [incEditId, setIncEditId] = useState(null);
  const [schedForm, setSchedForm] = useState({ type: "biweekly", anchorDate: toDateStr(), customDays: 14 });
  const [newCat, setNewCat] = useState("");
  const [balInput, setBalInput] = useState("");
  const [resetOk, setResetOk] = useState(false);

  // ── Bills ──
  const openNewBill = () => { setBillEditId(null); setBillForm({ ...EMPTY_BILL, startDate: toDateStr(), category: categories[0] || "Other" }); setModal("bill"); };
  const openEditBill = b => { setBillEditId(b.id); setBillForm({ name: b.name, amount: String(b.amount), category: b.category, frequency: b.frequency, startDate: b.startDate || toDateStr(), autoPay: b.autoPay, variable: !!b.variable, notes: b.notes || "" }); setModal("bill"); };
  const saveBill = () => {
    const amt = parseFloat(billForm.amount);
    if (!billForm.name.trim()) throw new Error("Give the bill a name.");
    if (isNaN(amt) || amt <= 0) throw new Error("Enter an amount greater than zero.");
    const nb = { id: billEditId || genId(), name: billForm.name.trim(), amount: amt, category: billForm.category, frequency: billForm.frequency, startDate: billForm.startDate, autoPay: billForm.autoPay, variable: billForm.variable, notes: billForm.notes };
    if (billEditId) setConfig(c => ({ ...c, recurringBills: c.recurringBills.map(b => b.id === billEditId ? nb : b) }));
    else setConfig(c => ({ ...c, recurringBills: [...(c.recurringBills || []), nb] }));
  };
  const deleteBill = async id => { if (!await confirm("Delete this bill?", { title: "Delete bill", confirmLabel: "Delete" })) return; setConfig(c => ({ ...c, recurringBills: c.recurringBills.filter(b => b.id !== id) })); };

  // ── Income ──
  const openNewInc = () => { setIncEditId(null); setIncForm({ ...EMPTY_INC, startDate: toDateStr() }); setModal("inc"); };
  const openEditInc = inc => { setIncEditId(inc.id); setIncForm({ name: inc.name, amount: String(inc.amount), frequency: inc.frequency, startDate: inc.startDate || inc.nextDate || toDateStr(), endDate: inc.endDate || "" }); setModal("inc"); };
  const saveInc = () => {
    const amt = parseFloat(incForm.amount);
    if (!incForm.name.trim()) throw new Error("Give the income source a name.");
    if (isNaN(amt) || amt <= 0) throw new Error("Enter an amount greater than zero.");
    if (!incForm.startDate) throw new Error("Pick the start date (first payday).");
    const ni = { id: incEditId || genId(), name: incForm.name.trim(), amount: amt, frequency: incForm.frequency, startDate: incForm.startDate, endDate: incForm.endDate || null };
    if (incEditId) setConfig(c => ({ ...c, income: c.income.map(i => i.id === incEditId ? ni : i) }));
    else setConfig(c => ({ ...c, income: [...(c.income || []), ni] }));
  };
  const deleteInc = async id => { if (!await confirm("Delete this income source?", { title: "Delete income", confirmLabel: "Delete" })) return; setConfig(c => ({ ...c, income: c.income.filter(i => i.id !== id) })); };

  // ── Pay schedule ── (the modal opens on the schedule as it is now)
  const openSched = () => {
    setSchedForm({ type: config.paySchedule?.type || "biweekly", anchorDate: config.paySchedule?.anchorDate || toDateStr(), customDays: config.paySchedule?.customDays || 14 });
    setModal("sched");
  };
  const saveSched = () => {
    setConfig(c => ({ ...c, paySchedule: { type: schedForm.type, anchorDate: schedForm.anchorDate, customDays: schedForm.type === "custom" ? parseInt(schedForm.customDays) || 14 : null } }));
  };

  // ── Categories ──
  const openCat = () => { setNewCat(""); setModal("cat"); };
  const addCat = () => {
    const n = newCat.trim();
    if (!n) throw new Error("Type a category name.");
    if (categories.includes(n)) throw new Error(`"${n}" is already a category.`);
    setConfig(c => ({ ...c, categories: [...c.categories, n] }));
  };
  const removeCat = async cat => {
    const used = transactions.some(t => t.category === cat);
    if (used && !await confirm(`"${cat}" is used by transactions. Delete anyway?`, { title: "Delete category", confirmLabel: "Delete" })) return;
    setConfig(c => ({ ...c, categories: c.categories.filter(x => x !== cat) }));
  };

  // ── Starting balance ──
  const openBal = () => { setBalInput(String(startingBalance)); setModal("bal"); };
  const saveBal = () => {
    const v = parseFloat(balInput);
    if (isNaN(v)) throw new Error("Enter a balance (it can be 0 or negative).");
    setStartingBalance(v);
  };

  // ── Fresh start ──
  const openReset = () => { setResetOk(false); setModal("reset"); };
  const doReset = () => { if (onFreshStart) onFreshStart(); };

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
    <>
    <div className="money money-tab">
      <div className="bi-grid">
        {/* ── Money in and out ── */}
        <div className="bi-col">
          {/* Income sources */}
          <div className="db-card">
            <div className="db-card-header">
              <h3 className="db-card-title">Income sources</h3>
              <button type="button" className="btn-sm btn-secondary-sm" onClick={openNewInc}><i className="fa-solid fa-plus" aria-hidden="true" /> Add income</button>
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
                          <button type="button" className="btn-mini" onClick={() => openEditInc(inc)} aria-label={`Edit ${inc.name}`}>Edit</button>
                          <button type="button" className="btn-mini danger" onClick={() => deleteInc(inc.id)} aria-label={`Delete ${inc.name}`}>Delete</button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )
            }
          </div>

          {/* Recurring bills */}
          <div className="db-card">
            <div className="db-card-header">
              <h3 className="db-card-title">Recurring bills</h3>
              <button type="button" className="btn-sm btn-secondary-sm" onClick={openNewBill}><i className="fa-solid fa-plus" aria-hidden="true" /> Add bill</button>
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
                        <button type="button" className="btn-mini" onClick={() => openEditBill(b)} aria-label={`Edit ${b.name}`}>Edit</button>
                        <button type="button" className="btn-mini danger" onClick={() => deleteBill(b.id)} aria-label={`Delete ${b.name}`}>Delete</button>
                      </div>
                    </div>
                  ))}
                </div>
              )
            }
          </div>
        </div>

        {/* ── Settings ── */}
        <div className="bi-col">
          {/* Pay schedule */}
          <div className="db-card">
            <div className="db-card-header">
              <h3 className="db-card-title">Pay schedule</h3>
              <button type="button" className="btn-sm btn-secondary-sm" onClick={openSched}><i className="fa-solid fa-pen" aria-hidden="true" /> Edit schedule</button>
            </div>
            <div className="bi-sched-type">{config.paySchedule?.type || "biweekly"}</div>
            <div className="bi-row-sub">Next paydays: {upcomingPaydays.join(", ")}</div>
          </div>

          {/* Categories */}
          <div className="db-card">
            <div className="db-card-header">
              <h3 className="db-card-title">Categories</h3>
              <button type="button" className="btn-sm btn-secondary-sm" onClick={openCat}><i className="fa-solid fa-plus" aria-hidden="true" /> Add category</button>
            </div>
            <div className="bi-cats">
              {categories.map(c => (
                <span key={c} className="bud-chip">
                  {c}
                  <button type="button" onClick={() => removeCat(c)} className="bi-chip-x" aria-label={`Remove ${c}`}><i className="fa-solid fa-xmark" aria-hidden="true" /></button>
                </span>
              ))}
            </div>
          </div>

          {/* Starting balance */}
          <div className="db-card">
            <div className="db-card-header">
              <h3 className="db-card-title">Starting balance</h3>
              <button type="button" className="btn-sm btn-secondary-sm" onClick={openBal}><i className="fa-solid fa-pen" aria-hidden="true" /> Set balance</button>
            </div>
            <div className="bi-balance">{formatMoney(startingBalance)}</div>
            <p className="money-card-note">The balance you&apos;re starting from. Used in the ledger running total and simulator.</p>
          </div>

          {/* Fresh start */}
          <div className="db-card">
            <div className="db-card-header"><h3 className="db-card-title">Reset</h3></div>
            <p className="money-card-note">
              Clear all transaction history and reset your balance to $0. Your recurring bills, income sources, pay schedule, and categories are kept.
            </p>
            <button type="button" className="btn-sm btn-delete bi-reset" onClick={openReset}>
              Fresh start…
            </button>
          </div>
        </div>
      </div>
      {dialog}
    </div>

    {/* Modals sit outside .money (a size container). */}
    {modal === "inc" && (
      <FormModal title={incEditId ? "Edit income source" : "Add income source"} submitLabel={incEditId ? "Save changes" : "Add income"} onClose={close} onSubmit={saveInc}>
        <Field label="Name">
          <input data-autofocus placeholder="e.g. TxtSquad" value={incForm.name} onChange={e => setIncForm(f => ({ ...f, name: e.target.value }))} />
        </Field>
        <div className="money-form-row">
          <Field label="Amount per payday">
            <input type="number" inputMode="decimal" step="0.01" placeholder="0.00" value={incForm.amount} onChange={e => setIncForm(f => ({ ...f, amount: e.target.value }))} />
          </Field>
          <Field label="Frequency">
            <select value={incForm.frequency} onChange={e => setIncForm(f => ({ ...f, frequency: e.target.value }))}>
              {FREQ_OPTS.map(f => <option key={f} value={f}>{f}</option>)}
            </select>
          </Field>
        </div>
        <div className="uik-field">
          <span className="field-label">Start date (first payday)</span>
          <DatePicker value={incForm.startDate} onChange={(v) => setIncForm(f => ({ ...f, startDate: v }))} />
        </div>
        <div className="uik-field">
          <span className="field-label">End date (optional)</span>
          <DatePicker value={incForm.endDate} onChange={(v) => setIncForm(f => ({ ...f, endDate: v }))} placeholder="Ongoing" />
          <span className="field-hint">Leave blank for ongoing income.</span>
        </div>
      </FormModal>
    )}

    {modal === "bill" && (
      <FormModal title={billEditId ? "Edit bill" : "Add recurring bill"} submitLabel={billEditId ? "Save changes" : "Add bill"} onClose={close} onSubmit={saveBill}>
        <Field label="Name">
          <input data-autofocus placeholder="e.g. Rent, Netflix" value={billForm.name} onChange={e => setBillForm(f => ({ ...f, name: e.target.value }))} />
        </Field>
        <div className="money-form-row">
          <Field label="Amount">
            <input type="number" inputMode="decimal" step="0.01" placeholder="0.00" value={billForm.amount} onChange={e => setBillForm(f => ({ ...f, amount: e.target.value }))} />
          </Field>
          <Field label="Frequency">
            <select value={billForm.frequency} onChange={e => setBillForm(f => ({ ...f, frequency: e.target.value }))}>
              {FREQ_OPTS.map(f => <option key={f} value={f}>{f}</option>)}
            </select>
          </Field>
        </div>
        <Field label="Category">
          <select value={billForm.category} onChange={e => setBillForm(f => ({ ...f, category: e.target.value }))}>
            {categories.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </Field>
        <div className="uik-field">
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
        <Field label="Notes (optional)">
          <input value={billForm.notes} onChange={e => setBillForm(f => ({ ...f, notes: e.target.value }))} />
        </Field>
      </FormModal>
    )}

    {modal === "sched" && (
      <FormModal title="Pay schedule" submitLabel="Save schedule" onClose={close} onSubmit={saveSched}>
        <Field label="How often you're paid">
          <select data-autofocus value={schedForm.type} onChange={e => setSchedForm(f => ({ ...f, type: e.target.value }))}>
            {SCHED_OPTS.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </Field>
        <div className="uik-field">
          <span className="field-label">Anchor payday</span>
          <DatePicker value={schedForm.anchorDate} onChange={(v) => setSchedForm(f => ({ ...f, anchorDate: v }))} placeholder="Anchor/next payday" />
          <span className="field-hint">Any real payday; periods are counted from it.</span>
        </div>
        {schedForm.type === "custom" && (
          <Field label="Days per period">
            <input type="number" inputMode="numeric" value={schedForm.customDays} onChange={e => setSchedForm(f => ({ ...f, customDays: e.target.value }))} placeholder="14" />
          </Field>
        )}
      </FormModal>
    )}

    {modal === "cat" && (
      <FormModal title="Add category" submitLabel="Add category" onClose={close} onSubmit={addCat} width={420}>
        <Field label="Category name">
          <input data-autofocus value={newCat} onChange={e => setNewCat(e.target.value)} placeholder="e.g. Pets" />
        </Field>
      </FormModal>
    )}

    {modal === "bal" && (
      <FormModal title="Starting balance" submitLabel="Set balance" onClose={close} onSubmit={saveBal} width={420}>
        <Field label="Balance" hint="Used in the ledger running total and the simulator.">
          <input data-autofocus type="number" inputMode="decimal" step="0.01" value={balInput} onChange={e => setBalInput(e.target.value)} placeholder="0.00" />
        </Field>
      </FormModal>
    )}

    {modal === "reset" && (
      <FormModal title="Fresh start" submitLabel="Clear everything" danger submitDisabled={!resetOk} onClose={close} onSubmit={doReset} width={460}>
        <p className="bi-reset-warn">
          This deletes <strong>all {transactions.length} transaction{transactions.length === 1 ? "" : "s"}</strong> and sets your starting balance to $0. It cannot be undone.
        </p>
        <p className="money-card-note">Your recurring bills, income sources, pay schedule and categories are kept.</p>
        <label className="bi-check">
          <input type="checkbox" checked={resetOk} onChange={e => setResetOk(e.target.checked)} />
          <span>I understand my transaction history will be permanently deleted.</span>
        </label>
      </FormModal>
    )}
    </>
  );
}
