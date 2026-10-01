import { supabase } from "../utils/supabase";
import { uid } from "./_base";

export async function upsertPageUsageSession(visit, expectedOwnerId) {
  const userId = await uid(expectedOwnerId);
  const { error } = await supabase.from("page_usage_sessions").upsert({
    ...visit,
    user_id: userId,
    updated_at: new Date().toISOString(),
  }, { onConflict: "visit_id" });
  if (error) throw new Error(`Couldn't save page usage: ${error.message || error}`);
}

export async function loadPageUsageSessions({ from, limit = 2000 } = {}) {
  const userId = await uid();
  let query = supabase.from("page_usage_sessions").select("visit_id, route_key, started_at, ended_at, active_ms, last_seen_at").eq("user_id", userId).order("started_at", { ascending: false }).limit(limit);
  if (from) query = query.gte("started_at", from);
  const { data, error } = await query;
  if (error) throw new Error(`Couldn't load page usage: ${error.message || error}`);
  return data || [];
}
