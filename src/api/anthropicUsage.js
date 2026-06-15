import { getAuthHeaders } from "../utils/supabase";

/** Fetch Anthropic API usage + cost for the last `days` days (max 31). */
export async function loadAnthropicUsage(days = 30) {
  const res = await fetch(`/api/anthropic-usage?days=${days}`, {
    headers: { "Content-Type": "application/json", ...(await getAuthHeaders()) },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error?.message || data?.message || `Usage API error ${res.status}`);
  return data; // { days, starting_at, cost, usage } OR { error, message }
}
