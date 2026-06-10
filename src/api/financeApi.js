/**
 * Finance API — Supabase calls for the fin_* schema.
 * All money is integer cents. Multi-write actions go through atomic
 * Postgres RPCs (fin_*). RLS scopes everything to the logged-in user.
 */
import { supabase } from "../utils/supabase";
import { toDateStr } from "../utils/plannerUtils";

async function uid() {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.user?.id;
}

const rows = (res) => {
  if (res.error) throw res.error;
  return res.data ?? [];
};
const one = (res) => {
  if (res.error) throw res.error;
  return res.data;
};

/* ── Bulk load (everything the dashboard + views need) ── */
export async function loadAllFinance() {
  const [settings, categories, income, recurringBills, billInstances, expenses, savingsGoals, savingsAllocations, debts, debtPayments] =
    await Promise.all([
      getSettings(),
      supabase.from("fin_categories").select("*").order("name").then(rows),
      supabase.from("fin_income").select("*").order("pay_date", { ascending: false }).then(rows),
      supabase.from("fin_recurring_bills").select("*").order("due_day").then(rows),
      supabase.from("fin_bill_instances").select("*").order("due_date").then(rows),
      supabase.from("fin_expenses").select("*").order("date", { ascending: false }).then(rows),
      supabase.from("fin_savings_goals").select("*").order("created_at").then(rows),
      supabase.from("fin_savings_allocations").select("*").then(rows),
      supabase.from("fin_debts").select("*").order("created_at").then(rows),
      supabase.from("fin_debt_payments").select("*").order("date", { ascending: false }).then(rows),
    ]);
  return { settings, categories, income, recurringBills, billInstances, expenses, savingsGoals, savingsAllocations, debts, debtPayments };
}

/* ── Settings ── */
export async function getSettings() {
  const userId = await uid();
  const res = await supabase.from("fin_settings").select("*").eq("user_id", userId).maybeSingle();
  return one(res);
}
export async function updateSettings(patch) {
  const userId = await uid();
  return one(await supabase.from("fin_settings").update({ ...patch, updated_at: new Date().toISOString() })
    .eq("user_id", userId).select().single());
}

/* ── Income (auto-reserve via RPC) ── */
export async function addIncome({ amount, payDate, source, notes, received = false }) {
  return one(await supabase.rpc("fin_add_income", {
    p_amount: amount, p_pay_date: payDate, p_source: source ?? null, p_notes: notes ?? null, p_received: received,
  }));
}
export async function setIncomeReceived(id, received) {
  const r = await supabase.from("fin_income").update({ received }).eq("id", id);
  if (r.error) throw r.error;
}
export async function deleteIncome(id) {
  const r = await supabase.from("fin_income").delete().eq("id", id); if (r.error) throw r.error;
}

/* ── Recurring bills ── */
export async function addRecurringBill(b) {
  const userId = await uid();
  return one(await supabase.from("fin_recurring_bills").insert({ user_id: userId, ...b }).select().single());
}
export async function updateRecurringBill(id, patch) {
  const r = await supabase.from("fin_recurring_bills").update(patch).eq("id", id); if (r.error) throw r.error;
}
export async function deleteRecurringBill(id) {
  const r = await supabase.from("fin_recurring_bills").delete().eq("id", id); if (r.error) throw r.error;
}

/* ── Bill instances ── */
export async function generateBillInstances(month) {
  // month: 'YYYY-MM-01' string or Date → first of month (local, not UTC)
  const m = typeof month === "string" ? month : toDateStr(new Date(month)).slice(0, 7) + "-01";
  return one(await supabase.rpc("fin_generate_bill_instances", { p_month: m }));
}
export async function addOneOffBill({ name, amount, dueDate, categoryId }) {
  const userId = await uid();
  return one(await supabase.from("fin_bill_instances")
    .insert({ user_id: userId, recurring_bill_id: null, name, amount, due_date: dueDate, category_id: categoryId ?? null, paid: false })
    .select().single());
}
export async function payBill(id) {
  const r = await supabase.from("fin_bill_instances")
    .update({ paid: true, paid_date: toDateStr(new Date()) }).eq("id", id);
  if (r.error) throw r.error;
}
export async function unpayBill(id) {
  const r = await supabase.from("fin_bill_instances").update({ paid: false, paid_date: null }).eq("id", id);
  if (r.error) throw r.error;
}
export async function deleteBillInstance(id) {
  const r = await supabase.from("fin_bill_instances").delete().eq("id", id); if (r.error) throw r.error;
}

/* ── Expenses (with optional filters) ── */
export async function listExpenses({ q, categoryId, from, to } = {}) {
  let query = supabase.from("fin_expenses").select("*").order("date", { ascending: false });
  if (categoryId) query = query.eq("category_id", categoryId);
  if (from) query = query.gte("date", from);
  if (to) query = query.lte("date", to);
  if (q) query = query.ilike("description", `%${q}%`);
  return rows(await query);
}
export async function addExpense({ amount, date, categoryId, description }) {
  const userId = await uid();
  return one(await supabase.from("fin_expenses")
    .insert({ user_id: userId, amount, date, category_id: categoryId ?? null, description })
    .select().single());
}
export async function deleteExpense(id) {
  const r = await supabase.from("fin_expenses").delete().eq("id", id); if (r.error) throw r.error;
}

/* ── Savings ── */
export async function addSavingsGoal(g) {
  const userId = await uid();
  return one(await supabase.from("fin_savings_goals").insert({ user_id: userId, ...g }).select().single());
}
export async function allocateToGoal(goalId, amount, source = "pool") {
  const r = await supabase.rpc("fin_allocate_to_goal", { p_goal_id: goalId, p_amount: amount, p_source: source });
  if (r.error) throw r.error;
}
export async function deleteSavingsGoal(id) {
  const r = await supabase.from("fin_savings_goals").delete().eq("id", id); if (r.error) throw r.error;
}

/* ── Debt ── */
export async function addDebt(d) {
  const userId = await uid();
  return one(await supabase.from("fin_debts").insert({ user_id: userId, ...d }).select().single());
}
export async function recordDebtPayment(debtId, { amount, principal, interest, date }) {
  const r = await supabase.rpc("fin_record_debt_payment", {
    p_debt_id: debtId, p_amount: amount, p_principal: principal ?? amount, p_interest: interest ?? 0, p_date: date ?? null,
  });
  if (r.error) throw r.error;
}
export async function deleteDebt(id) {
  const r = await supabase.from("fin_debts").delete().eq("id", id); if (r.error) throw r.error;
}

/* ── Categories ── */
export async function addCategory({ name, kind = "expense", color, icon }) {
  const userId = await uid();
  return one(await supabase.from("fin_categories").insert({ user_id: userId, name, kind, color, icon }).select().single());
}

/* ── Reset (atomic RPCs) ── */
export async function softReset() {
  const r = await supabase.rpc("fin_soft_reset"); if (r.error) throw r.error;
}
export async function factoryReset() {
  const r = await supabase.rpc("fin_factory_reset"); if (r.error) throw r.error;
}
