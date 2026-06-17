/**
 * AI Inbox — Gmail poller. Imports matching Gmail messages into the `messages`
 * table as channel='email' rows so the Inbox tool can draft replies to them.
 *
 * Read-only against Gmail (we never modify the mailbox). Dedupes on
 * (user_id, external_id) so re-running is safe.
 *
 * Two ways to call it:
 *   • Cron (vercel.json) — authenticated with CRON_SECRET; owner = INBOX_USER_ID
 *     (falls back to OVERSEER_USER_ID).
 *   • The "Sync from Gmail" button — authenticated with the user's Supabase JWT;
 *     owner = that user.
 *
 * Env vars: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GMAIL_REFRESH_TOKEN,
 *   GMAIL_QUERY (optional), CRON_SECRET, INBOX_USER_ID (or OVERSEER_USER_ID),
 *   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.
 */
import { sbConfigured, sbSelect, sbUpsert } from "./_supabase.js";
import { getSupabaseUserId } from "./_utils.js";
import { gmailConfigured, getAccessToken, listMessageIds, getMessage, GMAIL_QUERY } from "./_gmail.js";

export default async function handler(req, res) {
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST" && req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (!sbConfigured()) return res.status(500).json({ error: "Supabase service role not configured" });
  if (!gmailConfigured()) {
    return res.status(501).json({ error: "Gmail not connected (set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GMAIL_REFRESH_TOKEN)." });
  }

  // Auth + resolve which user owns the imported rows.
  const cronSecret = process.env.CRON_SECRET;
  const auth = String(req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  let qsSecret = "";
  try { qsSecret = new URL(req.url, "http://localhost").searchParams.get("secret") || ""; } catch { /* ignore */ }
  const isCron = cronSecret && (auth === cronSecret || qsSecret === cronSecret);

  let userId;
  if (isCron) {
    userId = process.env.INBOX_USER_ID || process.env.OVERSEER_USER_ID;
    if (!userId) return res.status(500).json({ error: "Set INBOX_USER_ID (or OVERSEER_USER_ID) for cron sync" });
  } else {
    userId = await getSupabaseUserId(req);
    if (!userId) return res.status(401).json({ error: "Not authenticated" });
  }

  try {
    const token = await getAccessToken();
    const ids = await listMessageIds(token, GMAIL_QUERY, 25);
    if (ids.length === 0) return res.status(200).json({ ok: true, scanned: 0, imported: 0 });

    // Which of these have we already imported for this user?
    const uid = encodeURIComponent(userId);
    const list = ids.map((m) => `"${m.id}"`).join(",");
    const existing = await sbSelect("messages", `user_id=eq.${uid}&external_id=in.(${list})&select=external_id`);
    const seen = new Set(existing.map((r) => r.external_id));
    const fresh = ids.filter((m) => !seen.has(m.id));
    if (fresh.length === 0) return res.status(200).json({ ok: true, scanned: ids.length, imported: 0 });

    // Fetch + flatten the new ones, then bulk insert.
    const rows = [];
    for (const { id } of fresh) {
      const m = await getMessage(token, id);
      if (!m.body) continue;
      rows.push({
        user_id: userId,
        channel: "email",
        external_id: m.externalId,
        thread_id: m.threadId,
        sender: m.sender,
        subject: m.subject,
        body: m.body,
        status: "needs_reply",
        flagged: true,
        received_at: m.receivedAt,
      });
    }
    if (rows.length === 0) return res.status(200).json({ ok: true, scanned: ids.length, imported: 0 });

    // Upsert ignores any that raced in via the (user_id, external_id) unique index.
    const inserted = await sbUpsert("messages", rows, "user_id,external_id");
    return res.status(200).json({ ok: true, scanned: ids.length, imported: inserted.length });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
