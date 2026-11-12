// Connected Pages follow-through (connected-pages.md §1.3, §2.4): after a
// meal-plan write, reconcile the generated tasks and re-evaluate the week's
// watchers. A failed step never blocks the plan save — it is reported so the
// panel can offer Retry.

import { reconcileGeneratedTasks } from "../../api/generatedTasksApi.js";
import { buildMealDesiredTasks, buildShoppingDesiredTask } from "../../lib/cascades.js";
import { evaluateMealsWatcher, evaluateBudgetWatcher } from "../../api/gapWatchersApi.js";
import { toDateStr } from "../../utils/dates.js";

const shoppingSummary = (weekCost, budgetWeek) => weekCost ? {
  itemCount: weekCost.meals.length,
  pricedCount: weekCost.pricedLineCount,
  purchaseTotalCents: weekCost.purchaseTotalCents,
  budgetCents: budgetWeek ? budgetWeek.amount_cents : null,
} : null;

export async function followThroughWeek({ plan, items, weekCost, budgetWeek }) {
  const errors = [];
  const shoppingTask = buildShoppingDesiredTask(plan, items, shoppingSummary(weekCost, budgetWeek), new Date());
  try {
    await reconcileGeneratedTasks({
      sourceType: "meal_plan_week",
      sourceId: plan.id,
      desired: shoppingTask ? [shoppingTask] : [],
    });
  } catch (e) { errors.push(`Shopping task: ${e.message}`); }
  const today = toDateStr();
  try { await evaluateMealsWatcher({ weekStart: plan.week_start, items, today }); }
  catch (e) { errors.push(`Meals watcher: ${e.message}`); }
  try { await evaluateBudgetWatcher({ weekStart: plan.week_start, budgetWeek, today }); }
  catch (e) { errors.push(`Budget watcher: ${e.message}`); }
  return { pending: errors.length > 0, errors };
}

export async function followThroughAfterItemChange({ plan, item, recipe, items, weekCost, budgetWeek }) {
  const errors = [];
  try {
    await reconcileGeneratedTasks({
      sourceType: "meal_plan_item",
      sourceId: item.id,
      desired: buildMealDesiredTasks(item, recipe),
    });
  } catch (e) { errors.push(`Meal tasks: ${e.message}`); }
  const week = await followThroughWeek({ plan, items, weekCost, budgetWeek });
  return { pending: errors.length > 0 || week.pending, errors: [...errors, ...week.errors] };
}
