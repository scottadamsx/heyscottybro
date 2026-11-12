// ── Meal Plan tab (Health) — Connected Pages Phase 1 ─────────────────────────
// One week per view: planned meals with live costs, an aggregated shopping
// list, intentional skips, generated-task follow-through with Retry, and
// Log as eaten into the Food Log. Costs come from the shared useWeekCost
// read, the same one Finance uses.

import { useEffect, useMemo, useRef, useState } from "react";
import { Field, FormModal } from "../ui";
import { useToast } from "../../contexts/ToastContext";
import { useConfirm } from "../../hooks/useConfirm";
import { FoodModal } from "../health/HealthModals";
import * as mp from "../../api/mealPlanApi.js";
import { saveRecipe, setRecipeArchived } from "../../api/recipesApi.js";
import { saveMatch } from "../../api/groceryPricesApi.js";
import { addFoodReturning } from "../../api/healthApi.js";
import { completeReminder } from "../../api/plannerApi.js";
import { loadSourceTasks } from "../../api/generatedTasksApi.js";
import { costWeek, costMeal } from "../../lib/mealPlanCost.js";
import { snapshotDetails } from "../../lib/mealPlanCost.js";
import { formatCents, addDays } from "../../lib/cascades.js";
import { weekDates } from "../../lib/gapWatchers.js";
import { formatDisplayDate, toDateStr } from "../../utils/dates.js";
import { mondayOf, useWeekCost } from "./useWeekCost.js";
import { followThroughAfterItemChange, followThroughWeek } from "./mealPlanFollowThrough.js";
import "./mealplan.css";

const SLOTS = ["breakfast", "lunch", "dinner", "snack"];
const SLOT_LABEL = { breakfast: "Breakfast", lunch: "Lunch", dinner: "Dinner", snack: "Snack" };

export const fmtQty = (milli, kind) => {
  const base = (Number(milli) || 0) / 1000;
  if (kind === "mass") return base >= 1000 ? `${trimNum(base / 1000)} kg` : `${trimNum(base)} g`;
  if (kind === "volume") return base >= 1000 ? `${trimNum(base / 1000)} L` : `${trimNum(base)} ml`;
  return `${trimNum(base)} each`;
};
const trimNum = (n) => String(Math.round(n * 100) / 100);

const daysOld = (iso) => Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 86400000));

export default function MealPlanPanel({ profileId }) {
  const { addToast } = useToast();
  const { confirm, dialog } = useConfirm();
  const [weekStart, setWeekStart] = useState(() => mondayOf(toDateStr()));
  const wk = useWeekCost(weekStart);
  const [itemForm, setItemForm] = useState(null); // { day, item? }
  const [recipeForm, setRecipeForm] = useState(null); // recipe or "new"
  const [eatenItem, setEatenItem] = useState(null);
  const [pending, setPending] = useState(null); // { errors, run }
  const watchedWeek = useRef(null);

  const { plan, items, recipes, budgetWeek, weekCost, currentSnapshot } = wk;
  const recipeById = useMemo(() => new Map(recipes.map((r) => [r.id, r])), [recipes]);
  const mealCostByItem = useMemo(
    () => new Map((weekCost?.meals || []).map((m) => [m.itemId, m])),
    [weekCost],
  );
  const shoppingByKey = useMemo(
    () => new Map(wk.shopping.items.map((i) => [`${i.ingredient_key}|${i.unit_kind}`, i])),
    [wk.shopping],
  );

  const costFor = (nextItems) => costWeek({
    entries: nextItems.map((item) => ({ item, recipe: item.recipe_id ? recipeById.get(item.recipe_id) || null : null })),
    matches: wk.matches, priceItems: wk.priceItems, storeKey: wk.storeKey,
    alreadyHaveMilli: mp.alreadyHaveMap(wk.shopping.items),
  });

  const runFollowThrough = async (args) => {
    const res = await followThroughAfterItemChange(args);
    if (res.pending) setPending({ errors: res.errors, run: () => runFollowThrough(args) });
    else setPending(null);
  };

  // Watchers evaluate on load (v1 trigger model): once per week shown.
  useEffect(() => {
    if (wk.loading || wk.error || !plan) return;
    if (watchedWeek.current === plan.id) return;
    watchedWeek.current = plan.id;
    followThroughWeek({ plan, items, weekCost, budgetWeek }).then((res) => {
      if (res.pending) setPending({ errors: res.errors, run: () => followThroughWeek({ plan, items, weekCost, budgetWeek }) });
    }).catch(() => {});
  }, [wk.loading, plan?.id]);

  if (wk.error) {
    return (
      <div className="health-stack">
        <p className="error-message" role="alert">Couldn&apos;t load the meal plan: {wk.error.message}</p>
        <p className="no-entries">If the Connected Pages tables are not live yet, this tab starts working as soon as the migration is applied. Nothing was changed.</p>
        <div><button type="button" className="btn btn-secondary" onClick={wk.reload}>Retry</button></div>
      </div>
    );
  }
  if (wk.loading || !weekCost) return <p className="no-entries">Loading the week…</p>;

  const dates = weekDates(weekStart);
  const storeName = wk.stores.find((s) => s.key === wk.storeKey)?.name || wk.storeKey;
  const stale = wk.priceImport ? daysOld(wk.priceImport.captured_at) > 14 : false;
  const frozen = currentSnapshot;

  const afterItemChange = async (savedItem, nextItems) => {
    await runFollowThrough({
      plan, item: savedItem,
      recipe: savedItem.recipe_id ? recipeById.get(savedItem.recipe_id) || null : null,
      items: nextItems, weekCost: costFor(nextItems), budgetWeek,
    });
    wk.reload();
  };

  const saveItem = async (values) => {
    const thePlan = plan || await mp.ensureWeekPlan(weekStart);
    const saved = await mp.saveWeekItem({ ...values, meal_plan_id: thePlan.id });
    setItemForm(null);
    addToast("Meal saved.", "success");
    const nextItems = [...items.filter((i) => i.id !== saved.id), saved];
    afterItemChange(saved, nextItems);
  };

  const changeStatus = async (item, patch, message) => {
    const saved = await mp.patchWeekItem(item.id, patch);
    addToast(message, "success");
    const nextItems = items.map((i) => (i.id === saved.id ? saved : i));
    afterItemChange(saved, nextItems);
  };

  const removeItem = async (item) => {
    const title = item.custom_title || recipeById.get(item.recipe_id)?.title || "this meal";
    if (!(await confirm({ title: "Remove meal?", body: `Remove ${title} from ${formatDisplayDate(item.planned_date)}? Its generated tasks retire too.`, confirmLabel: "Remove" }))) return;
    await mp.deleteWeekItem(item.id);
    addToast("Meal removed.", "success");
    const nextItems = items.filter((i) => i.id !== item.id);
    await runFollowThrough({
      plan, item: { ...item, status: "cancelled" }, recipe: null,
      items: nextItems, weekCost: costFor(nextItems), budgetWeek,
    });
    wk.reload();
  };

  const toggleShoppingState = async (line, state) => {
    let stored = shoppingByKey.get(`${line.ingredientKey}|${line.unitKind || "count"}`);
    if (!stored) {
      const synced = await mp.syncShoppingList({ plan, lines: weekCost.shoppingLines, storeKey: wk.storeKey, storeName });
      stored = synced.items.find((i) => i.ingredient_key === line.ingredientKey && i.unit_kind === (line.unitKind || "count"));
    }
    if (!stored) return;
    await mp.setShoppingItemState(stored.id, stored.state === state ? "needed" : state);
    wk.reload();
  };

  const markReady = async () => {
    const snap = await mp.markWeekReady({
      plan, weekCost, priceImportId: wk.priceImport?.id || null,
      storeKey: wk.storeKey, storeName, details: snapshotDetails(weekCost),
    });
    addToast(`Week marked ready. Planned grocery spend ${formatCents(snap.purchase_total_cents)}.`, "success");
    wk.reload();
  };

  const saveEaten = async (values) => {
    const item = eatenItem;
    const food = await addFoodReturning(profileId, {
      ...values, recipe_id: item.recipe_id || null, meal_plan_item_id: item.id,
    });
    // Food is saved; only now mark the plan item cooked and settle its tasks.
    const tasks = await loadSourceTasks("meal_plan_item", item.id).catch(() => []);
    const cook = tasks.find((t) => t.source_key === "cook" && !t.completed);
    if (cook) await completeReminder(cook.id).catch(() => {});
    const saved = await mp.patchWeekItem(item.id, { status: "cooked", food_log_id: food.id });
    setEatenItem(null);
    addToast("Logged as eaten.", "success");
    const nextItems = items.map((i) => (i.id === saved.id ? saved : i));
    afterItemChange(saved, nextItems);
  };

  return (
    <div className="health-stack">
      {dialog}
      <div className="mp-weekbar">
        <button type="button" className="btn btn-secondary btn-sm" onClick={() => setWeekStart(addDays(weekStart, -7))} aria-label="Previous week"><i className="fa-solid fa-chevron-left" /></button>
        <strong>{formatDisplayDate(weekStart)} to {formatDisplayDate(addDays(weekStart, 6))}</strong>
        <button type="button" className="btn btn-secondary btn-sm" onClick={() => setWeekStart(addDays(weekStart, 7))} aria-label="Next week"><i className="fa-solid fa-chevron-right" /></button>
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => setWeekStart(mondayOf(toDateStr()))}>This week</button>
      </div>

      {pending && (
        <div className="mp-pending" role="alert">
          <span>Follow-through pending: {pending.errors.join(" ")}</span>
          <button type="button" className="btn btn-secondary btn-sm" onClick={async () => { const r = await pending.run(); if (!r?.pending) setPending(null); }}>Retry</button>
        </div>
      )}

      <section className="db-card">
        <div className="db-card-header">
          <h3 className="db-card-title">Week summary</h3>
          <span className="db-card-count">{weekCost.meals.length} meals planned</span>
        </div>
        <div className="mp-summary">
          <div><span>Grocery budget</span><strong>{budgetWeek ? formatCents(budgetWeek.amount_cents) : "Not set"}</strong></div>
          <div><span>Planned grocery spend</span><strong>{formatCents(weekCost.purchaseTotalCents)}</strong></div>
          <div><span>Meal cost (food used)</span><strong>{formatCents(weekCost.consumedTotalCents)}</strong></div>
          <div><span>Room left</span><strong>{budgetWeek ? formatCents(budgetWeek.amount_cents - weekCost.purchaseTotalCents) : "—"}</strong></div>
        </div>
        <p className="field-hint">
          Prices: {wk.priceImport
            ? <>{storeName} · captured {formatDisplayDate(String(wk.priceImport.captured_at).slice(0, 10))}{stale && <span className="health-tag tone-warn"> Prices may be stale</span>}</>
            : "no price snapshot imported yet (Money tab, Grocery week). Costs stay unpriced until one is."}
          {" · "}Coverage: {weekCost.pricedLineCount} of {weekCost.requiredLineCount} lines priced
          {weekCost.coverageStatus === "partial" && weekCost.unpricedNames.length > 0 && <> · Unpriced: {weekCost.unpricedNames.join(", ")}</>}
        </p>
        {wk.stores.length > 1 && (
          <Field label="Price store">
            <select value={wk.storeKey} onChange={(e) => wk.setStoreKey(e.target.value)}>
              {wk.stores.map((s) => <option key={s.key} value={s.key}>{s.name}</option>)}
            </select>
          </Field>
        )}
        {frozen ? (
          <p className="field-hint">
            Marked ready {formatDisplayDate(String(frozen.created_at).slice(0, 10))}: planned spend {formatCents(frozen.purchase_total_cents)},
            meal cost {formatCents(frozen.consumed_total_cents)}, {frozen.priced_line_count} of {frozen.required_line_count} lines priced.
            {frozen.purchase_total_cents !== weekCost.purchaseTotalCents && " The plan has changed since; re-mark to freeze the new figures."}
          </p>
        ) : null}
        <div className="health-actions">
          <button type="button" className="btn btn-primary" onClick={markReady} disabled={!plan || weekCost.meals.length === 0}>
            <i className="fa-solid fa-lock" aria-hidden="true" /> {frozen ? "Re-mark week ready" : "Mark week ready"}
          </button>
        </div>
      </section>

      {dates.map((date) => {
        const dayItems = items.filter((i) => i.planned_date === date)
          .sort((a, b) => SLOTS.indexOf(a.meal_slot) - SLOTS.indexOf(b.meal_slot));
        return (
          <section key={date} className="db-card">
            <div className="db-card-header">
              <h3 className="db-card-title">{formatDisplayDate(date)}</h3>
              <span className="db-card-count">{dayItems.length} {dayItems.length === 1 ? "meal" : "meals"}</span>
            </div>
            {dayItems.length === 0 && <p className="no-entries">Nothing planned.</p>}
            <div className="db-list">
              {dayItems.map((item) => {
                const recipe = item.recipe_id ? recipeById.get(item.recipe_id) : null;
                const title = item.custom_title || recipe?.title || "Meal";
                const cost = mealCostByItem.get(item.id);
                return (
                  <div key={item.id} className="db-list-item health-row">
                    <div className="health-row-main">
                      <span className="db-list-item-title">{title}</span>
                      <span className="db-list-item-subtitle">
                        {SLOT_LABEL[item.meal_slot] || item.meal_slot} · {item.servings} serving{item.servings === 1 ? "" : "s"}
                        {item.eat_time ? ` · eats ${item.eat_time.slice(0, 5)}` : ""}
                        {item.status === "planned" && cost ? ` · meal cost ${formatCents(cost.mealCostCents)} (${cost.pricedLineCount} of ${cost.requiredLineCount} lines priced)` : ""}
                        {item.status === "cooked" ? " · Cooked, in the Food Log" : ""}
                        {item.status === "intentional_skip" ? " · Day off on purpose" : ""}
                      </span>
                    </div>
                    {item.status === "planned" && (
                      <span className="mp-item-actions">
                        <button type="button" className="btn btn-secondary btn-sm" onClick={() => setEatenItem(item)}>Log as eaten</button>
                        <button type="button" className="btn btn-ghost btn-sm" onClick={() => setItemForm({ day: date, item })}>Edit</button>
                        <button type="button" className="btn btn-ghost btn-sm" onClick={() => changeStatus(item, { status: "intentional_skip" }, "Marked as a day off.")}>Skip</button>
                        <button type="button" className="icon-btn" aria-label={`Remove ${title}`} onClick={() => removeItem(item)}><i className="fa-solid fa-trash" /></button>
                      </span>
                    )}
                    {item.status === "intentional_skip" && (
                      <button type="button" className="btn btn-ghost btn-sm" onClick={() => changeStatus(item, { status: "planned" }, "Back on the plan.")}>Undo skip</button>
                    )}
                  </div>
                );
              })}
            </div>
            <div className="health-actions">
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => setItemForm({ day: date })}>
                <i className="fa-solid fa-plus" aria-hidden="true" /> Add meal
              </button>
            </div>
          </section>
        );
      })}

      <section className="db-card">
        <div className="db-card-header">
          <h3 className="db-card-title">Shopping list</h3>
          <span className="db-card-count">{formatCents(weekCost.purchaseTotalCents)} planned</span>
        </div>
        {weekCost.shoppingLines.length === 0 && <p className="no-entries">Plan some meals and the list builds itself.</p>}
        <div className="db-list">
          {weekCost.shoppingLines.map((line) => {
            const stored = shoppingByKey.get(`${line.ingredientKey}|${line.unitKind || "count"}`);
            const state = stored?.state || line.state;
            return (
              <div key={`${line.ingredientKey}|${line.unitKind}`} className="db-list-item health-row">
                <div className="health-row-main">
                  <span className="db-list-item-title">{line.name}</span>
                  <span className="db-list-item-subtitle">
                    Needs {fmtQty(line.requiredMilli, line.unitKind)}
                    {line.product ? ` · ${line.product.product_name} · ${line.packages} × ${formatCents(line.packagePriceCents)}` : " · no confirmed product yet"}
                    {state === "already_have" ? " · Already have it" : state === "purchased" ? " · Bought" : state === "unpriced" ? " · Unpriced" : ""}
                  </span>
                </div>
                <span className="health-row-num">{line.purchaseCostCents != null ? formatCents(line.purchaseCostCents) : "—"}</span>
                <span className="mp-item-actions">
                  <button type="button" className="btn btn-ghost btn-sm" aria-pressed={state === "already_have"} onClick={() => toggleShoppingState(line, "already_have")}>Have it</button>
                  <button type="button" className="btn btn-ghost btn-sm" aria-pressed={state === "purchased"} onClick={() => toggleShoppingState(line, "purchased")}>Bought</button>
                </span>
              </div>
            );
          })}
        </div>
      </section>

      <MatchSection wk={wk} addToast={addToast} />
      <RecipesSection recipes={recipes} onEdit={(r) => setRecipeForm(r)} onNew={() => setRecipeForm("new")} addToast={addToast} reload={wk.reload} />

      {itemForm && (
        <ItemForm
          key={itemForm.item?.id || itemForm.day}
          day={itemForm.day} item={itemForm.item || null} recipes={recipes.filter((r) => !r.archived)}
          onClose={() => setItemForm(null)}
          onSave={async (values) => { try { await saveItem(values); } catch (e) { addToast(e.message, "error"); } }}
        />
      )}
      {recipeForm && (
        <RecipeForm
          key={recipeForm === "new" ? "new" : recipeForm.id}
          recipe={recipeForm === "new" ? null : recipeForm}
          onClose={() => setRecipeForm(null)}
          onSave={async (values) => {
            try { await saveRecipe(values); addToast("Recipe saved.", "success"); setRecipeForm(null); wk.reload(); }
            catch (e) { addToast(e.message, "error"); }
          }}
        />
      )}
      {eatenItem && (
        <FoodModal
          title="Log as eaten"
          profileId={profileId}
          defaultDate={eatenItem.planned_date}
          initial={{
            date: eatenItem.planned_date,
            meal_type: eatenItem.meal_slot,
            name: eatenItem.custom_title || recipeById.get(eatenItem.recipe_id)?.title || "",
            calories: Math.round((Number(recipeById.get(eatenItem.recipe_id)?.calories_per_serving) || 0) * (Number(eatenItem.servings) || 1)),
            protein_g: Math.round((Number(recipeById.get(eatenItem.recipe_id)?.protein_g) || 0) * (Number(eatenItem.servings) || 1)),
            carbs_g: Math.round((Number(recipeById.get(eatenItem.recipe_id)?.carbs_g) || 0) * (Number(eatenItem.servings) || 1)),
            fat_g: Math.round((Number(recipeById.get(eatenItem.recipe_id)?.fat_g) || 0) * (Number(eatenItem.servings) || 1)),
          }}
          onClose={() => setEatenItem(null)}
          onSave={async (values) => { try { await saveEaten(values); } catch (e) { addToast(e.message, "error"); } }}
        />
      )}
    </div>
  );
}


// ── Ingredient line editor (recipes and custom meals) ────────────────────────
// Quantities are entered in base units (g, ml, each); storage is milliunits.

export function LinesEditor({ lines, onChange }) {
  const update = (i, patch) => onChange(lines.map((l, j) => (j === i ? { ...l, ...patch } : l)));
  const toLine = (l) => ({
    name: l.name || "",
    normalized_name: (l.name || "").toLowerCase().replace(/\s+/g, " ").trim(),
    quantity_milliunits: l.quantity_milliunits ?? null,
    unit_kind: l.unit_kind || "mass",
    display_quantity: l.display_quantity || "",
    preparation: l.preparation || "",
    optional: !!l.optional,
    costable: l.parse_status !== "needs_review",
    parse_status: l.parse_status || "ready",
  });
  return (
    <div className="mp-lines">
      {lines.map((l, i) => (
        <div key={i} className="mp-line-row">
          <input aria-label="Ingredient" placeholder="Ingredient" value={l.name}
            onChange={(e) => update(i, { name: e.target.value })} />
          <input aria-label="Quantity in base units" type="number" min="0" step="any" placeholder="Qty"
            value={l.quantity_milliunits == null ? "" : l.quantity_milliunits / 1000}
            onChange={(e) => update(i, { quantity_milliunits: e.target.value === "" ? null : Math.round(Number(e.target.value) * 1000), parse_status: "ready", costable: true })} />
          <select aria-label="Unit kind" value={l.unit_kind || "mass"} onChange={(e) => update(i, { unit_kind: e.target.value })}>
            <option value="mass">grams</option>
            <option value="volume">ml</option>
            <option value="count">each</option>
          </select>
          <input aria-label="Preparation" placeholder="Prep (diced…)" value={l.preparation || ""}
            onChange={(e) => update(i, { preparation: e.target.value })} />
          <label className="mp-line-opt">
            <input type="checkbox" checked={!!l.optional} onChange={(e) => update(i, { optional: e.target.checked })} /> Optional
          </label>
          {l.parse_status === "needs_review" && <span className="health-tag tone-warn">Needs review</span>}
          <button type="button" className="icon-btn" aria-label="Remove line" onClick={() => onChange(lines.filter((_, j) => j !== i))}>
            <i className="fa-solid fa-xmark" />
          </button>
        </div>
      ))}
      <button type="button" className="btn btn-secondary btn-sm" onClick={() => onChange([...lines, toLine({})])}>
        <i className="fa-solid fa-plus" aria-hidden="true" /> Add ingredient
      </button>
    </div>
  );
}

// ── Meal item form ───────────────────────────────────────────────────────────

function ItemForm({ day, item, recipes, onClose, onSave }) {
  const [mode, setMode] = useState(item?.recipe_id ? "recipe" : item ? "custom" : "recipe");
  const [recipeId, setRecipeId] = useState(item?.recipe_id || recipes[0]?.id || "");
  const [customTitle, setCustomTitle] = useState(item?.custom_title || "");
  const [lines, setLines] = useState(item?.custom_ingredients || []);
  const [date, setDate] = useState(item?.planned_date || day);
  const [slot, setSlot] = useState(item?.meal_slot || "dinner");
  const [servings, setServings] = useState(item?.servings ?? 1);
  const [eatTime, setEatTime] = useState(item?.eat_time ? item.eat_time.slice(0, 5) : "");
  const [prepKind, setPrepKind] = useState(item?.advance_prep_kind || "none");
  const [prepLead, setPrepLead] = useState(item?.advance_prep_lead_minutes ?? "");
  const [prepNote, setPrepNote] = useState(item?.advance_prep_note || "");

  const submit = () => onSave({
    ...(item ? { id: item.id, meal_plan_id: item.meal_plan_id } : {}),
    planned_date: date,
    meal_slot: slot,
    recipe_id: mode === "recipe" ? recipeId || null : null,
    custom_title: mode === "custom" ? customTitle.trim() : null,
    custom_ingredients: mode === "custom" ? lines : [],
    servings: Number(servings) || 1,
    eat_time: eatTime || null,
    status: item?.status || "planned",
    advance_prep_kind: prepKind,
    advance_prep_lead_minutes: prepKind === "lead_time" && prepLead !== "" ? Number(prepLead) : null,
    advance_prep_note: prepNote || null,
  });

  return (
    <FormModal title={item ? "Edit meal" : "Add meal"} submitLabel="Save meal" onClose={onClose} onSubmit={submit}
      submitDisabled={mode === "recipe" ? !recipeId : !customTitle.trim()}>
      <Field label="From">
        <select value={mode} onChange={(e) => setMode(e.target.value)}>
          <option value="recipe">A recipe</option>
          <option value="custom">A custom meal</option>
        </select>
      </Field>
      {mode === "recipe" ? (
        <Field label="Recipe">
          <select value={recipeId} onChange={(e) => setRecipeId(e.target.value)}>
            {recipes.map((r) => <option key={r.id} value={r.id}>{r.title}</option>)}
          </select>
        </Field>
      ) : (
        <>
          <Field label="What are you eating?">
            <input value={customTitle} onChange={(e) => setCustomTitle(e.target.value)} placeholder="e.g. Leftovers night" data-autofocus />
          </Field>
          <Field label="Ingredients (optional, for costing)">
            <LinesEditor lines={lines} onChange={setLines} />
          </Field>
        </>
      )}
      <Field label="Day"><input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
      <Field label="Meal">
        <select value={slot} onChange={(e) => setSlot(e.target.value)}>
          {SLOTS.map((s) => <option key={s} value={s}>{SLOT_LABEL[s]}</option>)}
        </select>
      </Field>
      <Field label="Servings"><input type="number" min="0.25" step="0.25" value={servings} onChange={(e) => setServings(e.target.value)} /></Field>
      <Field label="Eating time" hint="Cook and prep tasks count back from this.">
        <input type="time" value={eatTime} onChange={(e) => setEatTime(e.target.value)} />
      </Field>
      <Field label="Advance prep for this meal" hint="Overrides the recipe's prep profile.">
        <select value={prepKind} onChange={(e) => setPrepKind(e.target.value)}>
          <option value="none">Use the recipe profile</option>
          <option value="night_before">Night before (8:00 PM)</option>
          <option value="morning">Morning (8:00 AM)</option>
          <option value="lead_time">Lead time before eating</option>
        </select>
      </Field>
      {prepKind === "lead_time" && (
        <Field label="Lead time (minutes)"><input type="number" min="0" value={prepLead} onChange={(e) => setPrepLead(e.target.value)} /></Field>
      )}
      <Field label="Prep note"><input value={prepNote} onChange={(e) => setPrepNote(e.target.value)} placeholder="e.g. Marinate the chicken" /></Field>
    </FormModal>
  );
}

// ── Recipe form (structured ingredients + prep profile) ─────────────────────

function RecipeForm({ recipe, onClose, onSave }) {
  const [title, setTitle] = useState(recipe?.title || "");
  const [servings, setServings] = useState(recipe?.servings ?? 1);
  const [prepMinutes, setPrepMinutes] = useState(recipe?.prep_minutes ?? 0);
  const [cookMinutes, setCookMinutes] = useState(recipe?.cook_minutes ?? 0);
  const [calories, setCalories] = useState(recipe?.calories_per_serving ?? 0);
  const [protein, setProtein] = useState(recipe?.protein_g ?? 0);
  const [carbs, setCarbs] = useState(recipe?.carbs_g ?? 0);
  const [fat, setFat] = useState(recipe?.fat_g ?? 0);
  const [lines, setLines] = useState(recipe?.lines || []);
  const [prepRequired, setPrepRequired] = useState(!!recipe?.prep_profile?.required);
  const [prepKind, setPrepKind] = useState(recipe?.prep_profile?.kind || "night_before");
  const [prepLead, setPrepLead] = useState(recipe?.prep_profile?.lead_minutes ?? "");
  const [prepNote, setPrepNote] = useState(recipe?.prep_profile?.note || "");

  const submit = () => onSave({
    ...(recipe ? { id: recipe.id } : {}),
    title: title.trim(),
    servings: Number(servings) || 1,
    prep_minutes: Number(prepMinutes) || 0,
    cook_minutes: Number(cookMinutes) || 0,
    calories_per_serving: Number(calories) || 0,
    protein_g: Number(protein) || 0,
    carbs_g: Number(carbs) || 0,
    fat_g: Number(fat) || 0,
    lines,
    prep_profile: {
      required: prepRequired,
      kind: prepKind,
      lead_minutes: prepKind === "lead_time" && prepLead !== "" ? Number(prepLead) : null,
      note: prepNote,
    },
    tags: recipe?.tags || [],
    favorite: !!recipe?.favorite,
  });

  return (
    <FormModal title={recipe ? "Edit recipe" : "New recipe"} submitLabel="Save recipe" onClose={onClose} onSubmit={submit} submitDisabled={!title.trim()}>
      <Field label="Title"><input value={title} onChange={(e) => setTitle(e.target.value)} data-autofocus /></Field>
      <Field label="Servings"><input type="number" min="1" step="1" value={servings} onChange={(e) => setServings(e.target.value)} /></Field>
      <Field label="Prep minutes"><input type="number" min="0" value={prepMinutes} onChange={(e) => setPrepMinutes(e.target.value)} /></Field>
      <Field label="Cook minutes"><input type="number" min="0" value={cookMinutes} onChange={(e) => setCookMinutes(e.target.value)} /></Field>
      <Field label="Per serving: calories / protein / carbs / fat (g)">
        <span className="mp-macro-row">
          <input type="number" min="0" aria-label="Calories per serving" value={calories} onChange={(e) => setCalories(e.target.value)} />
          <input type="number" min="0" aria-label="Protein grams" value={protein} onChange={(e) => setProtein(e.target.value)} />
          <input type="number" min="0" aria-label="Carbs grams" value={carbs} onChange={(e) => setCarbs(e.target.value)} />
          <input type="number" min="0" aria-label="Fat grams" value={fat} onChange={(e) => setFat(e.target.value)} />
        </span>
      </Field>
      <Field label="Ingredients" hint="Quantities in grams, ml, or each. Saving a converted recipe is what confirms its lines.">
        <LinesEditor lines={lines} onChange={setLines} />
      </Field>
      <Field label="Advance prep">
        <label className="mp-line-opt">
          <input type="checkbox" checked={prepRequired} onChange={(e) => setPrepRequired(e.target.checked)} /> This recipe needs prep ahead
        </label>
      </Field>
      {prepRequired && (
        <>
          <Field label="When">
            <select value={prepKind} onChange={(e) => setPrepKind(e.target.value)}>
              <option value="night_before">Night before (8:00 PM)</option>
              <option value="morning">Morning (8:00 AM)</option>
              <option value="lead_time">Lead time before eating</option>
            </select>
          </Field>
          {prepKind === "lead_time" && (
            <Field label="Lead time (minutes)"><input type="number" min="0" value={prepLead} onChange={(e) => setPrepLead(e.target.value)} /></Field>
          )}
          <Field label="Prep note"><input value={prepNote} onChange={(e) => setPrepNote(e.target.value)} /></Field>
        </>
      )}
    </FormModal>
  );
}

// ── Unpriced ingredients → confirmed product matches ────────────────────────

function MatchSection({ wk, addToast }) {
  const [filter, setFilter] = useState("");
  const [choice, setChoice] = useState({});
  const unpriced = useMemo(() => {
    const byId = new Map(wk.recipes.map((r) => [r.id, r]));
    const seen = new Map();
    for (const item of wk.items) {
      if (item.status !== "planned") continue;
      const meal = costMeal({
        recipe: item.recipe_id ? byId.get(item.recipe_id) || null : null,
        customLines: item.custom_ingredients?.length ? item.custom_ingredients : null,
        servings: item.servings,
      }, { matches: wk.matches, products: new Map(wk.priceItems.map((p) => [`${p.store_key}|${p.external_product_key}`, p])), storeKey: wk.storeKey });
      for (const line of meal.lines) {
        if (line.state !== "priced") seen.set(line.key, { name: line.name, unitKind: line.unitKind, state: line.state });
      }
    }
    return [...seen.entries()].map(([normalized, v]) => ({ normalized, ...v }));
  }, [wk]);

  if (!wk.priceImport || unpriced.length === 0) return null;
  const candidates = (unitKind) => wk.priceItems
    .filter((p) => p.store_key === wk.storeKey && p.unit_kind === unitKind)
    .filter((p) => !filter || p.product_name.toLowerCase().includes(filter.toLowerCase()))
    .slice(0, 50);

  return (
    <section className="db-card">
      <div className="db-card-header">
        <h3 className="db-card-title">Unpriced ingredients</h3>
        <span className="db-card-count">{unpriced.length} to match</span>
      </div>
      <p className="field-hint">Pick the product you actually buy for each ingredient. The match is confirmed for the selected store and reused everywhere.</p>
      <Field label="Filter products"><input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="e.g. flour" /></Field>
      <div className="db-list">
        {unpriced.map((u) => (
          <div key={u.normalized} className="db-list-item health-row">
            <div className="health-row-main">
              <span className="db-list-item-title">{u.name}</span>
              <span className="db-list-item-subtitle">{u.state === "needs_review" ? "Quantity needs review in the recipe" : "No confirmed product"}</span>
            </div>
            <select aria-label={`Product for ${u.name}`} value={choice[u.normalized] || ""}
              onChange={(e) => setChoice((c) => ({ ...c, [u.normalized]: e.target.value }))}>
              <option value="">Choose a product…</option>
              {candidates(u.unitKind).map((p) => (
                <option key={p.external_product_key} value={p.external_product_key}>
                  {p.product_name} · {formatCents(p.package_price_cents)}
                </option>
              ))}
            </select>
            <button type="button" className="btn btn-secondary btn-sm" disabled={!choice[u.normalized]}
              onClick={async () => {
                try {
                  await saveMatch({ normalized_ingredient: u.normalized, store_key: wk.storeKey, external_product_key: choice[u.normalized], status: "confirmed" });
                  addToast(`Matched ${u.name}.`, "success");
                  wk.reload();
                } catch (e) { addToast(e.message, "error"); }
              }}>
              Confirm match
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}

// ── Recipes list ─────────────────────────────────────────────────────────────

function RecipesSection({ recipes, onEdit, onNew, addToast, reload }) {
  return (
    <section className="db-card">
      <div className="db-card-header">
        <h3 className="db-card-title">Recipes</h3>
        <span className="db-card-count">{recipes.length} {recipes.length === 1 ? "recipe" : "recipes"}</span>
      </div>
      <div className="db-list">
        {recipes.map((r) => {
          const review = (r.lines || []).filter((l) => l.parse_status === "needs_review").length;
          return (
            <div key={r.id} className="db-list-item health-row">
              <div className="health-row-main">
                <span className="db-list-item-title">{r.title}{r.archived ? " (archived)" : ""}</span>
                <span className="db-list-item-subtitle">
                  Serves {r.servings} · {(r.lines || []).length} ingredients
                  {review > 0 ? ` · ${review} need review` : ""}
                  {(r.ingredients_schema_version || 1) < 2 ? " · converted from the old format, saving confirms it" : ""}
                </span>
              </div>
              <span className="mp-item-actions">
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => onEdit(r)}>Edit</button>
                <button type="button" className="btn btn-ghost btn-sm" onClick={async () => {
                  try { await setRecipeArchived(r.id, !r.archived); reload(); }
                  catch (e) { addToast(e.message, "error"); }
                }}>{r.archived ? "Unarchive" : "Archive"}</button>
              </span>
            </div>
          );
        })}
      </div>
      <div className="health-actions">
        <button type="button" className="btn btn-secondary btn-sm" onClick={onNew}>
          <i className="fa-solid fa-plus" aria-hidden="true" /> New recipe
        </button>
      </div>
    </section>
  );
}
