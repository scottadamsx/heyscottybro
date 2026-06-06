/**
 * Planner API — wraps Supabase calls for all planner data.
 * Tables: reminders, journal, events, transactions, budget_config,
 *         projects, event_types, initiatives
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

export async function newReminder({ name, date, time, description, recurrence, project_id, recur_until, recur_times, show_on_calendar }) {
  const userId = await uid();
  const row = {
    user_id: userId,
    name,
    date: date || null,
    recurrence: recurrence || "none",
    completed: false,
  };
  // Only include new columns if they have values — avoids 400 if schema not yet migrated
  if (project_id) row.project_id = project_id;
  if (recur_until) row.recur_until = recur_until;
  if (recur_times) row.recur_times = Number(recur_times);
  if (time) row.time = time;
  if (description) row.description = description;
  // Default is true; only persist when explicitly turned off (keeps base schema working)
  if (show_on_calendar === false) row.show_on_calendar = false;
  const { error } = await supabase.from("reminders").insert(row);
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

export async function newEvent({ title, description, date, project_id, event_type_id, cost }) {
  const userId = await uid();
  const row = { user_id: userId, title, description, date, cost: Number(cost || 0) };
  if (project_id) row.project_id = project_id;
  if (event_type_id) row.event_type_id = event_type_id;
  const { error } = await supabase.from("events").insert(row);
  if (error) throw error;
}

export async function deleteEvent(id) {
  const { error } = await supabase.from("events").delete().eq("id", id);
  if (error) throw error;
}

// ── Budget ───────────────────────────────────
// Transactions are stored with SIGNED amounts (expense negative, income positive).
// The projection engine relies on this convention.

function signTx(tx) {
  const n = Number(tx.amount || 0);
  const signed = tx.type === "expense" ? -Math.abs(n) : tx.type === "income" ? Math.abs(n) : n;
  return { ...tx, amount: signed };
}

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
  const row = signTx({ user_id: userId, ...tx });
  const { data, error } = await supabase.from("transactions").insert(row).select().single();
  if (error) throw error;
  return data;
}

export async function updateTransaction(id, updates) {
  const patch = "type" in updates || "amount" in updates ? signTx(updates) : updates;
  const { error } = await supabase.from("transactions").update(patch).eq("id", id);
  if (error) throw error;
}

export async function deleteTransaction(id) {
  const { error } = await supabase.from("transactions").delete().eq("id", id);
  if (error) throw error;
}

export async function linkTransactionToRecurring(txId, recurringId) {
  const { error } = await supabase
    .from("transactions")
    .update({ fulfills_recurring_id: recurringId, fulfills_income_id: null })
    .eq("id", txId);
  if (error) throw error;
}

export async function linkTransactionToIncome(txId, incomeId) {
  const { error } = await supabase
    .from("transactions")
    .update({ fulfills_income_id: incomeId, fulfills_recurring_id: null })
    .eq("id", txId);
  if (error) throw error;
}

const DEFAULT_CONFIG = {
  categories: ["Food", "Transport", "Bills", "Entertainment", "Housing", "Car", "Subscriptions", "Travel", "Other"],
  incomeSources: [],
  recurringBills: [],
  taxRate: 0.18,
  startingBalance: 0,
};

export async function loadBudgetConfig() {
  const userId = await uid();
  const { data, error } = await supabase
    .from("budget_config")
    .select("*")
    .eq("user_id", userId)
    .single();
  if (error && error.code !== "PGRST116") throw error;
  if (!data) return { ...DEFAULT_CONFIG };
  return {
    categories: data.categories ?? DEFAULT_CONFIG.categories,
    incomeSources: data.income_sources ?? data.income ?? [],
    recurringBills: data.recurring_bills ?? [],
    taxRate: data.tax_rate != null ? Number(data.tax_rate) : 0.18,
    startingBalance: data.starting_balance != null ? Number(data.starting_balance) : 0,
  };
}

export async function saveBudgetConfig(config) {
  const userId = await uid();
  const { error } = await supabase.from("budget_config").upsert({
    user_id: userId,
    categories: config.categories,
    income_sources: config.incomeSources,
    recurring_bills: config.recurringBills,
    tax_rate: config.taxRate ?? 0.18,
    starting_balance: config.startingBalance ?? 0,
  }, { onConflict: "user_id" });
  if (error) throw error;
}

function genId(prefix = "id") {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return `${prefix}-${crypto.randomUUID()}`;
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export async function addIncomeSource(source) {
  const cfg = await loadBudgetConfig();
  const row = { id: genId("inc"), frequency: "monthly", ...source };
  cfg.incomeSources = [...(cfg.incomeSources || []), row];
  await saveBudgetConfig(cfg);
  return row;
}

export async function updateIncomeSource(id, updates) {
  const cfg = await loadBudgetConfig();
  cfg.incomeSources = (cfg.incomeSources || []).map(s => s.id === id ? { ...s, ...updates } : s);
  await saveBudgetConfig(cfg);
}

export async function deleteIncomeSource(id) {
  const cfg = await loadBudgetConfig();
  cfg.incomeSources = (cfg.incomeSources || []).filter(s => s.id !== id);
  await saveBudgetConfig(cfg);
}

export async function addRecurringBill(bill) {
  const cfg = await loadBudgetConfig();
  const row = { id: genId("rb"), frequency: "monthly", autoPay: false, ...bill };
  cfg.recurringBills = [...(cfg.recurringBills || []), row];
  await saveBudgetConfig(cfg);
  return row;
}

export async function updateRecurringBill(id, updates) {
  const cfg = await loadBudgetConfig();
  cfg.recurringBills = (cfg.recurringBills || []).map(b => b.id === id ? { ...b, ...updates } : b);
  await saveBudgetConfig(cfg);
}

export async function deleteRecurringBill(id) {
  const cfg = await loadBudgetConfig();
  cfg.recurringBills = (cfg.recurringBills || []).filter(b => b.id !== id);
  await saveBudgetConfig(cfg);
}

// Back-compat shim — old code calls addIncome
export async function addIncome(income) {
  return addIncomeSource(income);
}

// ── Projects ─────────────────────────────────
export async function loadProjects() {
  const userId = await uid();
  const { data, error } = await supabase
    .from("projects")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function newProject({ name, description, color, parent_id }) {
  const userId = await uid();
  const row = { user_id: userId, name, description: description || "", color: color || "#6366f1" };
  // Only include parent_id when set — avoids 400 if the column isn't migrated yet
  if (parent_id) row.parent_id = parent_id;
  const { data, error } = await supabase
    .from("projects")
    .insert(row)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateProject(id, updates) {
  const { error } = await supabase.from("projects").update(updates).eq("id", id);
  if (error) throw error;
}

export async function deleteProject(id) {
  const { error } = await supabase.from("projects").delete().eq("id", id);
  if (error) throw error;
}

// ── Event Types ──────────────────────────────
export async function loadEventTypes() {
  const userId = await uid();
  const { data, error } = await supabase
    .from("event_types")
    .select("*")
    .eq("user_id", userId)
    .order("name", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function newEventType({ name, color, auto_tasks }) {
  const userId = await uid();
  const { data, error } = await supabase
    .from("event_types")
    .insert({ user_id: userId, name, color: color || "#22d3ee", auto_tasks: auto_tasks || [] })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateEventType(id, updates) {
  const { error } = await supabase.from("event_types").update(updates).eq("id", id);
  if (error) throw error;
}

export async function deleteEventType(id) {
  const { error } = await supabase.from("event_types").delete().eq("id", id);
  if (error) throw error;
}

// ── Initiatives ──────────────────────────────
export async function loadInitiatives(projectId) {
  const userId = await uid();
  let query = supabase.from("initiatives").select("*").eq("user_id", userId);
  if (projectId) query = query.eq("project_id", projectId);
  const { data, error } = await query.order("created_at", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function newInitiative({ project_id, name, description, recurrence }) {
  const userId = await uid();
  const { error } = await supabase.from("initiatives").insert({
    user_id: userId,
    project_id: project_id || null,
    name,
    description: description || "",
    recurrence: recurrence || "weekly",
    active: true,
  });
  if (error) throw error;
}

export async function deleteInitiative(id) {
  const { error } = await supabase.from("initiatives").delete().eq("id", id);
  if (error) throw error;
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

// ── AI Briefing ──────────────────────────────
export async function getAIBriefing({ reminders, events, projects, initiatives }) {
  const today = new Date();
  const todayStr = today.toLocaleDateString("en-AU", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
  const todayIso = today.toISOString().split("T")[0];

  const todayTasks = reminders
    .filter(r => !r.completed && r.date === todayIso)
    .map(r => `- ${r.name}`).join("\n") || "None";

  const upcomingTasks = reminders
    .filter(r => !r.completed && r.date > todayIso)
    .slice(0, 10)
    .map(r => `- ${r.name} (${r.date})`).join("\n") || "None";

  const upcomingEvents = events
    .filter(e => e.date >= todayIso)
    .slice(0, 8)
    .map(e => `- ${e.title} on ${e.date}${e.description ? `: ${e.description}` : ""}`).join("\n") || "None";

  const projectList = projects
    .map(p => `- ${p.name}${p.description ? `: ${p.description}` : ""}`).join("\n") || "None";

  const initiativeList = initiatives
    .filter(i => i.active)
    .map(i => `- ${i.name} (${i.recurrence})`).join("\n") || "None";

  const prompt = `You are a personal assistant for Scott. Today is ${todayStr}.

TASKS DUE TODAY:
${todayTasks}

UPCOMING TASKS:
${upcomingTasks}

UPCOMING EVENTS:
${upcomingEvents}

ACTIVE PROJECTS:
${projectList}

RECURRING INITIATIVES:
${initiativeList}

Write Scott a short, friendly, personalised morning briefing (3-5 sentences). Cover what's on today, anything notable this week, and a brief heads-up on any project needing attention. Be direct and practical — no bullet points, just natural prose.`;

  // Calls our serverless proxy (/api/briefing in prod, Vite proxy in dev)
  const response = await fetch("/api/briefing", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 300,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error?.message || `API error ${response.status}`);
  }

  const result = await response.json();
  return result.content?.[0]?.text ?? "Unable to generate briefing.";
}
