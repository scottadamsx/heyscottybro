/**
 * Planner API — Supabase calls with an automatic localStorage fallback.
 *
 * - Normal mode: talks to Supabase. If a call fails (offline / schema issue),
 *   it falls back to localStorage so the UI keeps working, and flips the
 *   connection status to "disconnected".
 * - Local mode (toggle in the dashboard, or VITE_LOCAL_DATA=1): every call uses
 *   localStorage consistently — handy for offline testing.
 */
import { supabase } from "../utils/supabase";
import { local } from "../utils/localStore";

/* ── connection + mode state ─────────────────── */
let _connected = null; // null = unknown, true, false
const _listeners = new Set();

export function getConnectionStatus() { return _connected; }
export function onConnectionChange(cb) { _listeners.add(cb); return () => _listeners.delete(cb); }
function setConnected(v) {
  if (_connected !== v) { _connected = v; _listeners.forEach((f) => { try { f(v); } catch { /* noop */ } }); }
}

export function isLocalMode() {
  if (import.meta.env.VITE_LOCAL_DATA === "1") return true;
  try { return localStorage.getItem("forceLocal") === "1"; } catch { return false; }
}
export function setLocalMode(on) {
  try {
    if (on) localStorage.setItem("forceLocal", "1");
    else localStorage.removeItem("forceLocal");
  } catch { /* noop */ }
}

export async function checkConnection() {
  if (isLocalMode()) { setConnected(false); return false; }
  try {
    const { error } = await supabase.from("reminders").select("id").limit(1);
    if (error) throw error;
    setConnected(true);
    return true;
  } catch {
    setConnected(false);
    return false;
  }
}

/** Run a Supabase op, falling back to local storage on failure (or always, in local mode). */
async function op(remote, localFn) {
  if (isLocalMode()) return localFn();
  try {
    const r = await remote();
    setConnected(true);
    return r;
  } catch {
    setConnected(false);
    return localFn();
  }
}

async function uid() {
  if (isLocalMode()) return "local-user";
  const { data: { session } } = await supabase.auth.getSession();
  return session?.user?.id;
}

const byDateAsc = (k = "date") => (a, b) => String(a[k] || "").localeCompare(String(b[k] || ""));

/* ── Reminders ───────────────────────────────── */
export async function loadReminders() {
  return op(
    async () => {
      const userId = await uid();
      const { data, error } = await supabase.from("reminders").select("*").eq("user_id", userId).order("date", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
    () => local.list("reminders").slice().sort(byDateAsc()),
  );
}

export async function newReminder({ name, date, time, description, recurrence, project_id, recur_until, recur_times, show_on_calendar }) {
  const base = { name, date: date || null, recurrence: recurrence || "none", completed: false };
  if (project_id) base.project_id = project_id;
  if (recur_until) base.recur_until = recur_until;
  if (recur_times) base.recur_times = Number(recur_times);
  if (time) base.time = time;
  if (description) base.description = description;
  if (show_on_calendar === false) base.show_on_calendar = false;
  return op(
    async () => {
      const userId = await uid();
      const { error } = await supabase.from("reminders").insert({ user_id: userId, ...base });
      if (error) throw error;
    },
    () => { local.insert("reminders", { show_on_calendar: base.show_on_calendar !== false, ...base }); },
  );
}

export async function completeReminder(id) {
  const completed_date = new Date().toISOString().split("T")[0];
  return op(
    async () => { const { error } = await supabase.from("reminders").update({ completed: true, completed_date }).eq("id", id); if (error) throw error; },
    () => local.update("reminders", id, { completed: true, completed_date }),
  );
}

export async function updateReminder(id, fields) {
  // Only persist keys that were actually provided (so partial edits don't wipe columns).
  const patch = {};
  ["name", "date", "time", "description", "recurrence", "project_id", "recur_until", "recur_times", "show_on_calendar", "completed"].forEach((k) => {
    if (fields[k] !== undefined) patch[k] = fields[k];
  });
  if (patch.recur_times != null) patch.recur_times = Number(patch.recur_times);
  return op(
    async () => { const { error } = await supabase.from("reminders").update(patch).eq("id", id); if (error) throw error; },
    () => local.update("reminders", id, patch),
  );
}

export async function deleteReminder(id) {
  return op(
    async () => { const { error } = await supabase.from("reminders").delete().eq("id", id); if (error) throw error; },
    () => local.remove("reminders", id),
  );
}

/* ── Journal ─────────────────────────────────── */
export async function loadJournal() {
  return op(
    async () => {
      const userId = await uid();
      const { data, error } = await supabase.from("journal").select("*").eq("user_id", userId).order("date", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
    () => local.list("journal").slice().sort(byDateAsc()),
  );
}

export async function newJournalEntry({ title, entry, date }) {
  return op(
    async () => { const userId = await uid(); const { error } = await supabase.from("journal").insert({ user_id: userId, title, entry, date }); if (error) throw error; },
    () => { local.insert("journal", { title, entry, date }); },
  );
}

/* ── Events ──────────────────────────────────── */
export async function loadEvents() {
  return op(
    async () => {
      const userId = await uid();
      const { data, error } = await supabase.from("events").select("*").eq("user_id", userId).order("date", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
    () => local.list("events").slice().sort(byDateAsc()),
  );
}

export async function newEvent({ title, description, date, project_id, event_type_id }) {
  const row = { title, description, date };
  if (project_id) row.project_id = project_id;
  if (event_type_id) row.event_type_id = event_type_id;
  return op(
    async () => { const userId = await uid(); const { error } = await supabase.from("events").insert({ user_id: userId, ...row }); if (error) throw error; },
    () => { local.insert("events", row); },
  );
}

export async function deleteEvent(id) {
  return op(
    async () => { const { error } = await supabase.from("events").delete().eq("id", id); if (error) throw error; },
    () => local.remove("events", id),
  );
}

/* ── Budget ──────────────────────────────────── */
function signTx(tx) {
  const n = Number(tx.amount || 0);
  const signed = tx.type === "expense" ? -Math.abs(n) : tx.type === "income" ? Math.abs(n) : n;
  return { ...tx, amount: signed };
}

export async function loadTransactions() {
  return op(
    async () => {
      const userId = await uid();
      const { data, error } = await supabase.from("transactions").select("*").eq("user_id", userId).order("date", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    () => local.list("transactions").slice().sort((a, b) => String(b.date || "").localeCompare(String(a.date || ""))),
  );
}

export async function newTransaction(tx) {
  const row = signTx(tx);
  return op(
    async () => { const userId = await uid(); const { data, error } = await supabase.from("transactions").insert(signTx({ user_id: userId, ...tx })).select().single(); if (error) throw error; return data; },
    () => local.insert("transactions", row),
  );
}

export async function updateTransaction(id, updates) {
  const patch = "type" in updates || "amount" in updates ? signTx(updates) : updates;
  return op(
    async () => { const { error } = await supabase.from("transactions").update(patch).eq("id", id); if (error) throw error; },
    () => local.update("transactions", id, patch),
  );
}

export async function deleteTransaction(id) {
  return op(
    async () => { const { error } = await supabase.from("transactions").delete().eq("id", id); if (error) throw error; },
    () => local.remove("transactions", id),
  );
}

export async function linkTransactionToRecurring(txId, recurringId) {
  return op(
    async () => { const { error } = await supabase.from("transactions").update({ fulfills_recurring_id: recurringId, fulfills_income_id: null }).eq("id", txId); if (error) throw error; },
    () => local.update("transactions", txId, { fulfills_recurring_id: recurringId, fulfills_income_id: null }),
  );
}

export async function linkTransactionToIncome(txId, incomeId) {
  return op(
    async () => { const { error } = await supabase.from("transactions").update({ fulfills_income_id: incomeId, fulfills_recurring_id: null }).eq("id", txId); if (error) throw error; },
    () => local.update("transactions", txId, { fulfills_income_id: incomeId, fulfills_recurring_id: null }),
  );
}

const DEFAULT_CONFIG = {
  categories: ["Food", "Transport", "Bills", "Entertainment", "Housing", "Car", "Subscriptions", "Travel", "Other"],
  incomeSources: [],
  recurringBills: [],
  taxRate: 0.18,
  startingBalance: 0,
};

export async function loadBudgetConfig() {
  return op(
    async () => {
      const userId = await uid();
      const { data, error } = await supabase.from("budget_config").select("*").eq("user_id", userId).single();
      if (error && error.code !== "PGRST116") throw error;
      if (!data) return { ...DEFAULT_CONFIG };
      return {
        categories: data.categories ?? DEFAULT_CONFIG.categories,
        incomeSources: data.income_sources ?? data.income ?? [],
        recurringBills: data.recurring_bills ?? [],
        taxRate: data.tax_rate != null ? Number(data.tax_rate) : 0.18,
        startingBalance: data.starting_balance != null ? Number(data.starting_balance) : 0,
      };
    },
    () => local.singleton("budget_config") || { ...DEFAULT_CONFIG },
  );
}

export async function saveBudgetConfig(config) {
  return op(
    async () => {
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
    },
    () => local.setSingleton("budget_config", {
      categories: config.categories,
      incomeSources: config.incomeSources,
      recurringBills: config.recurringBills,
      taxRate: config.taxRate ?? 0.18,
      startingBalance: config.startingBalance ?? 0,
    }),
  );
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
  cfg.incomeSources = (cfg.incomeSources || []).map((s) => s.id === id ? { ...s, ...updates } : s);
  await saveBudgetConfig(cfg);
}
export async function deleteIncomeSource(id) {
  const cfg = await loadBudgetConfig();
  cfg.incomeSources = (cfg.incomeSources || []).filter((s) => s.id !== id);
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
  cfg.recurringBills = (cfg.recurringBills || []).map((b) => b.id === id ? { ...b, ...updates } : b);
  await saveBudgetConfig(cfg);
}
export async function deleteRecurringBill(id) {
  const cfg = await loadBudgetConfig();
  cfg.recurringBills = (cfg.recurringBills || []).filter((b) => b.id !== id);
  await saveBudgetConfig(cfg);
}
export async function addIncome(income) { return addIncomeSource(income); }

/* ── Projects ────────────────────────────────── */
export async function loadProjects() {
  return op(
    async () => {
      const userId = await uid();
      const { data, error } = await supabase.from("projects").select("*").eq("user_id", userId).order("created_at", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
    () => local.list("projects"),
  );
}

export async function newProject({ name, description, color, parent_id }) {
  const row = { name, description: description || "", color: color || "#6366f1" };
  if (parent_id) row.parent_id = parent_id;
  return op(
    async () => { const userId = await uid(); const { data, error } = await supabase.from("projects").insert({ user_id: userId, ...row }).select().single(); if (error) throw error; return data; },
    () => local.insert("projects", row),
  );
}

export async function updateProject(id, updates) {
  return op(
    async () => { const { error } = await supabase.from("projects").update(updates).eq("id", id); if (error) throw error; },
    () => local.update("projects", id, updates),
  );
}

export async function deleteProject(id) {
  return op(
    async () => { const { error } = await supabase.from("projects").delete().eq("id", id); if (error) throw error; },
    () => local.remove("projects", id),
  );
}

/* ── Event Types ─────────────────────────────── */
export async function loadEventTypes() {
  return op(
    async () => {
      const userId = await uid();
      const { data, error } = await supabase.from("event_types").select("*").eq("user_id", userId).order("name", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
    () => local.list("event_types"),
  );
}

export async function newEventType({ name, color, auto_tasks }) {
  const row = { name, color: color || "#22d3ee", auto_tasks: auto_tasks || [] };
  return op(
    async () => { const userId = await uid(); const { data, error } = await supabase.from("event_types").insert({ user_id: userId, ...row }).select().single(); if (error) throw error; return data; },
    () => local.insert("event_types", row),
  );
}

export async function updateEventType(id, updates) {
  return op(
    async () => { const { error } = await supabase.from("event_types").update(updates).eq("id", id); if (error) throw error; },
    () => local.update("event_types", id, updates),
  );
}

export async function deleteEventType(id) {
  return op(
    async () => { const { error } = await supabase.from("event_types").delete().eq("id", id); if (error) throw error; },
    () => local.remove("event_types", id),
  );
}

/* ── Initiatives ─────────────────────────────── */
export async function loadInitiatives(projectId) {
  return op(
    async () => {
      const userId = await uid();
      let query = supabase.from("initiatives").select("*").eq("user_id", userId);
      if (projectId) query = query.eq("project_id", projectId);
      const { data, error } = await query.order("created_at", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
    () => local.list("initiatives").filter((i) => !projectId || String(i.project_id) === String(projectId)),
  );
}

export async function newInitiative({ project_id, name, description, recurrence }) {
  const row = { project_id: project_id || null, name, description: description || "", recurrence: recurrence || "weekly", active: true };
  return op(
    async () => { const userId = await uid(); const { error } = await supabase.from("initiatives").insert({ user_id: userId, ...row }); if (error) throw error; },
    () => { local.insert("initiatives", row); },
  );
}

export async function deleteInitiative(id) {
  return op(
    async () => { const { error } = await supabase.from("initiatives").delete().eq("id", id); if (error) throw error; },
    () => local.remove("initiatives", id),
  );
}

/* ── Auth ────────────────────────────────────── */
export async function login(email, password) {
  if (isLocalMode()) { try { localStorage.setItem("localSession", "1"); } catch { /* noop */ } return; }
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
}

export async function loginWithGoogle() {
  if (isLocalMode()) { try { localStorage.setItem("localSession", "1"); } catch { /* noop */ } window.location.href = "/admin/dashboard"; return; }
  const { error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: `${window.location.origin}/admin/dashboard` },
  });
  if (error) throw error;
}

export async function logout() {
  if (isLocalMode()) { try { localStorage.removeItem("localSession"); } catch { /* noop */ } return; }
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export async function getSession() {
  if (isLocalMode()) return { user: { id: "local-user" } };
  const { data: { session } } = await supabase.auth.getSession();
  return session;
}

/* ── AI Briefing ─────────────────────────────── */
export async function getAIBriefing({ reminders, events, projects, initiatives }) {
  const today = new Date();
  const todayStr = today.toLocaleDateString("en-AU", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
  const todayIso = today.toISOString().split("T")[0];

  const todayTasks = reminders.filter((r) => !r.completed && r.date === todayIso).map((r) => `- ${r.name}`).join("\n") || "None";
  const upcomingTasks = reminders.filter((r) => !r.completed && r.date > todayIso).slice(0, 10).map((r) => `- ${r.name} (${r.date})`).join("\n") || "None";
  const upcomingEvents = events.filter((e) => e.date >= todayIso).slice(0, 8).map((e) => `- ${e.title} on ${e.date}${e.description ? `: ${e.description}` : ""}`).join("\n") || "None";
  const projectList = projects.map((p) => `- ${p.name}${p.description ? `: ${p.description}` : ""}`).join("\n") || "None";
  const initiativeList = initiatives.filter((i) => i.active).map((i) => `- ${i.name} (${i.recurrence})`).join("\n") || "None";

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

  const response = await fetch("/api/briefing", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model: "claude-haiku-4-5-20251001", max_tokens: 300, messages: [{ role: "user", content: prompt }] }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error?.message || `API error ${response.status}`);
  }
  const result = await response.json();
  return result.content?.[0]?.text ?? "Unable to generate briefing.";
}
