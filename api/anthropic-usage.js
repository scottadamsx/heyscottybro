/**
 * Vercel serverless function — proxies the Anthropic Admin Usage & Cost API.
 * Requires an ADMIN key (sk-ant-admin01-...) from an Anthropic *Organization*;
 * it is NOT a standard API key and is NOT available on individual accounts.
 * Set ANTHROPIC_ADMIN_KEY in Vercel env. Auth-gated like /api/chat.
 */
import { verifySupabaseUser } from "./_utils.js";

const ORG = "https://api.anthropic.com/v1/organizations";

function startUTC(daysAgo) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - daysAgo);
  d.setUTCHours(0, 0, 0, 0);
  return d.toISOString();
}

async function adminGet(path, { starting_at, groupBy }, key) {
  const qs = new URLSearchParams({ starting_at, bucket_width: "1d", limit: "31" });
  (groupBy || []).forEach((g) => qs.append("group_by[]", g));
  const r = await fetch(`${ORG}${path}?${qs.toString()}`, {
    headers: { "x-api-key": key, "anthropic-version": "2023-06-01" },
  });
  const data = await r.json();
  if (!r.ok) throw new Error(data?.error?.message || `Admin API error ${r.status}`);
  return data;
}

export default async function handler(req, res) {
  if (req.method !== "GET" && req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  if (!(await verifySupabaseUser(req))) return res.status(401).json({ error: "Not authenticated" });

  const key = process.env.ANTHROPIC_ADMIN_KEY;
  if (!key) {
    return res.status(200).json({
      error: "no_admin_key",
      message: "ANTHROPIC_ADMIN_KEY is not set. Add an Admin API key (sk-ant-admin01-…) from an Anthropic Organization to your Vercel environment.",
    });
  }

  const days = Math.min(Number(req.query?.days) || 30, 31);
  const starting_at = startUTC(days);

  try {
    const [cost, usage] = await Promise.all([
      adminGet("/cost_report", { starting_at, groupBy: ["description"] }, key),
      adminGet("/usage_report/messages", { starting_at, groupBy: ["model"] }, key),
    ]);
    return res.status(200).json({ days, starting_at, cost, usage });
  } catch (err) {
    // Individual accounts / non-admin keys surface a 401/403 here.
    return res.status(200).json({ error: "admin_api_error", message: err.message });
  }
}
