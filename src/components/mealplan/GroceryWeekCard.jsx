// ── Finance: grocery week (connected-pages.md §2.3, §2.6) ───────────────────
// Owns the week's grocery budget record and the price snapshot import.
// Planned spend comes from the same shared read Meal Plan uses; it is a
// derived figure and is never written as a transaction. Actual grocery
// spending is what receipts/transactions already say (category "Groceries").

import { useRef, useState } from "react";
import { Field, FormModal } from "../ui";
import { useToast } from "../../contexts/ToastContext";
import { importPriceSnapshot } from "../../api/groceryPricesApi.js";
import { saveBudgetWeek } from "../../api/mealPlanApi.js";
import { evaluateBudgetWatcher } from "../../api/gapWatchersApi.js";
import { formatCents, addDays } from "../../lib/cascades.js";
import { formatDisplayDate, toDateStr } from "../../utils/dates.js";
import { mondayOf, useWeekCost } from "./useWeekCost.js";
import "./mealplan.css";

const daysOld = (iso) => Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 86400000));

export default function GroceryWeekCard({ transactions = [] }) {
  const { addToast } = useToast();
  const weekStart = mondayOf(toDateStr());
  const wk = useWeekCost(weekStart);
  const [budgetForm, setBudgetForm] = useState(false);
  const [budgetDollars, setBudgetDollars] = useState("");
  const [importing, setImporting] = useState(false);
  const fileRef = useRef(null);

  const { budgetWeek, weekCost, currentSnapshot, priceImport } = wk;
  const plannedCents = currentSnapshot
    ? currentSnapshot.purchase_total_cents
    : weekCost?.purchaseTotalCents ?? null;
  const actualCents = transactions
    .filter((t) => t.type === "expense" && t.category === "Groceries" && t.date >= weekStart && t.date <= addDays(weekStart, 6))
    .reduce((s, t) => s + Math.round(Math.abs(Number(t.amount) || 0) * 100), 0);
  const stale = priceImport ? daysOld(priceImport.captured_at) > 14 : false;

  const onImportFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setImporting(true);
    try {
      const text = await file.text();
      const res = await importPriceSnapshot({ sourceName: file.name, text });
      addToast(`Imported ${res.accepted} prices${res.rejected.length ? `, ${res.rejected.length} rows rejected` : ""}.`, "success");
      wk.reload();
    } catch (err) {
      addToast(err.message, "error");
    } finally {
      setImporting(false);
    }
  };

  const saveBudget = async () => {
    const cents = Math.round(Number(budgetDollars) * 100);
    if (!Number.isFinite(cents) || cents < 0) { addToast("Enter a budget amount.", "error"); return; }
    const saved = await saveBudgetWeek({ weekStart, amountCents: cents });
    setBudgetForm(false);
    addToast(`Grocery budget for this week set to ${formatCents(cents)}.`, "success");
    await evaluateBudgetWatcher({ weekStart, budgetWeek: saved }).catch(() => {});
    wk.reload();
  };

  return (
    <section className="db-card" aria-label="Grocery week">
      <div className="db-card-header">
        <h3 className="db-card-title">Grocery week</h3>
        <span className="db-card-count">{formatDisplayDate(weekStart)} to {formatDisplayDate(addDays(weekStart, 6))}</span>
      </div>
      {wk.error ? (
        <p className="no-entries">Grocery week data is not available yet: {wk.error.message}</p>
      ) : wk.loading ? (
        <p className="no-entries">Loading the grocery week…</p>
      ) : (
        <>
          <div className="mp-summary">
            <div><span>Week budget</span><strong>{budgetWeek ? formatCents(budgetWeek.amount_cents) : "Not set"}</strong></div>
            <div><span>Planned grocery spend{currentSnapshot ? " (marked ready)" : ""}</span><strong>{plannedCents != null ? formatCents(plannedCents) : "—"}</strong></div>
            <div><span>Logged grocery spending</span><strong>{formatCents(actualCents)}</strong></div>
            <div><span>Room left</span><strong>{budgetWeek && plannedCents != null ? formatCents(budgetWeek.amount_cents - plannedCents) : "—"}</strong></div>
          </div>
          <p className="field-hint">
            {priceImport
              ? <>Price snapshot: {priceImport.source_name}, captured {formatDisplayDate(String(priceImport.captured_at).slice(0, 10))} ({priceImport.row_count} products{priceImport.rejected_count ? `, ${priceImport.rejected_count} rejected` : ""}).{stale && <span className="health-tag tone-warn"> Prices may be stale, import a fresher snapshot</span>}</>
              : "No price snapshot imported yet. Meal Plan costs stay unpriced until one is."}
            {" "}Planned spend is the whole packages the week needs; it is never posted as a transaction. Actual spending changes only when a receipt or transaction is logged.
          </p>
          <div className="health-actions">
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => { setBudgetDollars(budgetWeek ? String(budgetWeek.amount_cents / 100) : "75"); setBudgetForm(true); }}>
              <i className="fa-solid fa-basket-shopping" aria-hidden="true" /> {budgetWeek ? "Edit week budget" : "Set week budget"}
            </button>
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => fileRef.current?.click()} disabled={importing}>
              <i className="fa-solid fa-file-import" aria-hidden="true" /> {importing ? "Importing…" : "Import price snapshot"}
            </button>
            <input ref={fileRef} type="file" accept=".csv,.json,.txt" hidden onChange={onImportFile} />
          </div>
        </>
      )}
      {budgetForm && (
        <FormModal title="Grocery budget for this week" submitLabel="Save budget" onClose={() => setBudgetForm(false)} onSubmit={saveBudget}>
          <Field label="Amount ($)" hint="Scott's standing week is $75. This sets this week only.">
            <input type="number" min="0" step="0.01" value={budgetDollars} onChange={(e) => setBudgetDollars(e.target.value)} data-autofocus />
          </Field>
        </FormModal>
      )}
    </section>
  );
}
