/**
 * AI Inbox — mark a message read. Sets the DB `read` flag and, for email
 * messages, removes Gmail's UNREAD label (needs the gmail.modify scope).
 * User-initiated only: authenticated with the caller's Supabase JWT.
 *
 * Body: { id: <messages.id> }
 * The Gmail label update is best-effort — if it fails, the local read flag is
 * still set so the app stays consistent.
 */
import { sbConfigured, sbSelect, sbUpdate } from "./_supabase.js";
import { parseBody, getSupabaseUserId } from "./_utils.js";
import { gmailConfigured, getAccessToken, markRead } from "./_gmail.js";

export default async function handler(req, res) {
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  if (!sbConfigured()) return res.status(500).json({ error: "Supabase service role not configured" });

  const userId = await getSupabaseUserId(req);
  if (!userId) return res.status(401).json({ error: "Not authenticated" });

  try {
    const { id } = parseBody(req) || {};
    if (!id) return res.status(400).json({ error: "Missing message id" });

    const uid = encodeURIComponent(userId);
    const rows = await sbSelect("messages", `id=eq.${encodeURIComponent(id)}&user_id=eq.${uid}&select=id,channel,external_id,read`);
    const msg = rows[0];
    if (!msg) return res.status(404).json({ error: "Message not found" });
    if (msg.read) return res.status(200).json({ ok: true, read: true }); // already read, nothing to do

    let gmail = false;
    if (msg.channel === "email" && msg.external_id && gmailConfigured()) {
      try {
        const token = await getAccessToken();
        await markRead(token, msg.external_id);
        gmail = true;
      } catch { /* best-effort: keep the local flag in sync even if Gmail balks */ }
    }

    await sbUpdate("messages", `id=eq.${encodeURIComponent(id)}&user_id=eq.${uid}`, { read: true });
    return res.status(200).json({ ok: true, read: true, gmail });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
