/**
 * Planner API — wraps Supabase calls for all planner data.
 * Tables required in Supabase:
 *   reminders  (id, user_id, name, date, recurrence, completed, completed_date)
 *   journal    (id, user_id, title, entry, date)
 *   events     (id, user_id, title, description, date)
 *   transactions (id, user_id, description, amount, type, category, date, notes)
 *   budget_config (id, user_id, categories, income, recurring_bills)
 */
import { supabase } from "../utils/supabase";

async function uid() {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.user?.id;
}

// ── Reminders ────────────────────────────────
export async function loadReminders() {
  const userId = await uid();
  const { data, error } = await supabase
    .from("reminders")
    .select("*")
    .eq("user_id", userId)
    .order("date", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function newReminder({ name, date, recurrence }) {
  const userId = await uid();
  const { error } = await supabase.from("reminders").insert({
    user_id: userId, name, date, recurrence: recurrence || "none", completed: false
  });
  if (error) throw error;
}

export async function completeReminder(id) {
  const { error } = await supabase
    .from("reminders")
    .update({ completed: true, completed_date: new Date().toISOString().split("T")[0] })
    .eq("id", id);
  if (error) throw error;
}

export async function deleteReminder(id) {
  const { error } = await supabase.from("reminders").delete().eq("id", id);
  if (error) throw error;
}

// ── Journal ──────────────────────────────────
export async function loadJournal() {
  const userId = await uid();
  const { data, error } = await supabase
    .from("journal")
    .select("*")
    .eq("user_id", userId)
    .order("date", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function newJournalEntry({ title, entry, date }) {
  const userId = await uid();
  const { error } = await supabase.from("journal").insert({ user_id: userId, title, entry, date });
  if (error) throw error;
}

// ── Events ───────────────────────────────────
export async function loadEvents() {
  const userId = await uid();
  const { data, error } = await supabase
    .from("events")
    .select("*")
    .eq("user_id", userId)
    .order("date", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function newEvent({ title, description, date }) {
  const userId = await uid();
  const { error } = await supabase.from("events").insert({ user_id: userId, title, description, date });
  if (error) throw error;
}

// ── Budget ───────────────────────────────────
export async function loadTransactions() {
  const userId = await uid();
  const { data, error } = await supabase
    .from("transactions")
    .select("*")
    .eq("user_id", userId)
    .order("date", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function newTransaction(tx) {
  const userId = await uid();
  const { error } = await supabase.from("transactions").insert({ user_id: userId, ...tx });
  if (error) throw error;
}

export async function loadBudgetConfig() {
  const userId = await uid();
  const { data, error } = await supabase
    .from("budget_config")
    .select("*")
    .eq("user_id", userId)
    .single();
  if (error && error.code !== "PGRST116") throw error;
  if (!data) return { categories: ["Food", "Transport", "Bills", "Entertainment", "Other"], income: [], recurringBills: [] };
  return {
    categories: data.categories ?? [],
    income: data.income ?? [],
    recurringBills: data.recurring_bills ?? [],
  };
}

export async function saveBudgetConfig(config) {
  const userId = await uid();
  const { error } = await supabase.from("budget_config").upsert({
    user_id: userId,
    categories: config.categories,
    income: config.income,
    recurring_bills: config.recurringBills,
  }, { onConflict: "user_id" });
  if (error) throw error;
}

export async function addIncome(income) {
  const cfg = await loadBudgetConfig();
  cfg.income = [...(cfg.income || []), income];
  await saveBudgetConfig(cfg);
}

export async function addRecurringBill(bill) {
  const cfg = await loadBudgetConfig();
  cfg.recurringBills = [...(cfg.recurringBills || []), bill];
  await saveBudgetConfig(cfg);
}

// ── Auth ─────────────────────────────────────
export async function login(email, password) {
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
}

export async function logout() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export async function getSession() {
  const { data: { session } } = await supabase.auth.getSession();
  return session;
}
