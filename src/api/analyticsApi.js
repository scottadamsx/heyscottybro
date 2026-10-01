import { supabase } from "../utils/supabase";
import { uid } from "./_base";

const SOURCES = {
  reminders: ["reminders", "created_at", false],
  journal: ["journal", "created_at", false],
  events: ["events", "created_at", false],
  transactions: ["transactions", "created_at", false],
  projects: ["projects", "created_at", false],
  workLogs: ["work_log", "date", false],
  accountability: ["accountability_state", "updated_at", true],
  food: ["food_logs", "created_at", false],
  weights: ["weight_logs", "date", false],
  workouts: ["workout_sessions", "started_at", false],
  sets: ["workout_sets", "logged_at", false],
  peopleEvents: ["orbit_events", "created_at", false],
  agentActions: ["agent_actions", "created_at", false],
  activityEvents: ["activity_events", "occurred_at", false],
  pageUsage: ["page_usage_sessions", "started_at", false],
};

async function loadSource(userId, [table, order, maybeSingle]) {
  const pageSize = 1000;
  const maxRows = maybeSingle ? 1 : 5000;
  const rows = [];
  let total = null;
  for (let from = 0; from < maxRows; from += pageSize) {
    let query = supabase.from(table).select("*", { count: "exact" }).eq("user_id", userId).order(order, { ascending: false });
    query = maybeSingle ? query.limit(1) : query.range(from, Math.min(from + pageSize - 1, maxRows - 1));
    const { data, error, count } = await query;
    if (error) throw new Error(error.message || String(error));
    if (total == null) total = count;
    rows.push(...(data || []));
    if (maybeSingle || (data || []).length < pageSize) break;
  }
  return { rows, total: total ?? rows.length, truncated: total != null && rows.length < total };
}

export async function loadAnalyticsData() {
  const userId = await uid();
  const entries = await Promise.all(Object.entries(SOURCES).map(async ([key, spec]) => {
    try { return [key, await loadSource(userId, spec), null]; }
    catch (error) { return [key, { rows: [], total: 0, truncated: false }, error?.message || String(error)]; }
  }));
  const data = {};
  const errors = {};
  const limitations = {};
  for (const [key, result, error] of entries) {
    data[key] = result.rows;
    if (error) errors[key] = error;
    if (result.truncated) limitations[key] = { loaded: result.rows.length, total: result.total };
  }
  return { data, errors, limitations, loadedAt: new Date().toISOString() };
}
