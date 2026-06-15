/**
 * Galadriel, the Overseer — server-side daily run (Vercel Cron).
 *
 * Reads the day's data for OVERSEER_USER_ID with the Supabase service role,
 * asks Claude for a concise summary, and upserts it into the Brain as a dated
 * node. Runs without a browser session, so it talks to Anthropic directly
 * (the /api/chat proxy requires a user JWT and caps tokens).
 *
 * Cron config lives in vercel.json. Protect it with CRON_SECRET:
 *   Authorization: Bearer <CRON_SECRET>   (Vercel Cron sends this automatically)
 *   or ?secret=<CRON_SECRET>
 */
import { sbConfigured, sbSelect, sbUpsert } from "./_supabase.js";

const fmtMoney = (n) => `$${Math.abs(Number(n || 0)).toFixed(2)}`;

export default async function handler(req, res) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = String(req.headers.authorization || "").replace(/^Bearer\s+/i, "");
    let qs = "";
    try { qs = new URL(req.url, "http://localhost").searchParams.get("secret") || ""; } catch { /* ignore */ }
    if (auth !== secret && qs !== secret) return res.status(401).json({ error: "bad cron secret" });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  const userId = process.env.OVERSEER_USER_ID;
  if (!apiKey) return res.status(500).json({ error: "ANTHROPIC_API_KEY not configured" });
  if (!sbConfigured() || !userId) {
    return res.status(500).json({ error: "Set SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY and OVERSEER_USER_ID" });
  }

  try {
    const today = new Date().toISOString().slice(0, 10);
    const uid = encodeURIComponent(userId);
    const [reminders, events, journal, txns] = await Promise.all([
      sbSelect("reminders", `user_id=eq.${uid}&select=name,date,completed,completed_date`),
      sbSelect("events", `user_id=eq.${uid}&date=eq.${today}&select=title,description`),
      sbSelect("journal", `user_id=eq.${uid}&date=eq.${today}&select=title,entry,mood`),
      sbSelect("transactions", `user_id=eq.${uid}&date=eq.${today}&select=description,amount,type,category`),
    ]);

    const completed = reminders.filter((r) => r.completed && r.completed_date === today);
    const overdue = reminders.filter((r) => !r.completed && r.date && r.date < today);
    const dueToday = reminders.filter((r) => !r.completed && r.date === today);
    const spent = txns.filter((t) => Number(t.amount) < 0).reduce((s, t) => s + Math.abs(Number(t.amount)), 0);
    const earned = txns.filter((t) => Number(t.amount) > 0).reduce((s, t) => s + Number(t.amount), 0);

    const snapshot = [
      `Date: ${today}`,
      `Completed (${completed.length}): ${completed.map((r) => r.name).join("; ") || "—"}`,
      `Still open today (${dueToday.length}): ${dueToday.map((r) => r.name).join("; ") || "—"}`,
      `Overdue (${overdue.length}): ${overdue.slice(0, 12).map((r) => `${r.name} (${r.date})`).join("; ") || "—"}`,
      `Events (${events.length}): ${events.map((e) => e.title).join("; ") || "—"}`,
      `Money: spent ${fmtMoney(spent)}, in ${fmtMoney(earned)}`,
      `Journal: ${journal.map((j) => `${j.title || "entry"}${j.mood ? ` (${j.mood})` : ""}: ${(j.entry || "").slice(0, 240)}`).join(" / ") || "—"}`,
    ].join("\n");

    const prompt = `You are Galadriel, Scott's Overseer. Write a concise, skimmable daily summary in Markdown from this snapshot — what got done, what's still open or overdue, money in/out, anything notable in the journal, and one gentle nudge for tomorrow. Keep it tight.\n\n${snapshot}`;

    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({ model: "claude-sonnet-4-6", max_tokens: 1200, messages: [{ role: "user", content: prompt }] }),
    });
    const data = await r.json();
    if (!r.ok) throw new Error(data?.error?.message || `Anthropic ${r.status}`);
    const body = (data.content || []).filter((b) => b.type === "text").map((b) => b.text).join("\n").trim();

    const slug = `daily-${today}`;
    await sbUpsert("brain_nodes", [{
      user_id: userId, slug, title: `Daily Summary — ${today}`,
      body, type: "checkpoints", tags: ["daily", "summary", today.slice(0, 7)],
      source: "galadriel", agent_id: "galadriel",
    }], "user_id,slug");

    return res.status(200).json({ ok: true, slug, summary: body });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
