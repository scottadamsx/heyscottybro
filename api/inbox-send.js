/**
 * AI Inbox — send a reply to an email message via Gmail, as Scott.
 * User-initiated only (no cron): authenticated with the caller's Supabase JWT.
 *
 * Body: { id: <messages.id>, draft: <reply text> }
 * Sends the draft to the original sender, threaded into the original
 * conversation, then marks the message replied and saves the sent text.
 *
 * Needs the gmail.send scope on GMAIL_REFRESH_TOKEN (re-mint via
 * scripts/gmail-auth.mjs) plus the usual GOOGLE_* + SUPABASE_* env vars.
 */
import { sbConfigured, sbSelect, sbUpdate } from "./_supabase.js";
import { parseBody, getSupabaseUserId } from "./_utils.js";
import { gmailConfigured, getAccessToken, getReplyTarget, sendReply } from "./_gmail.js";

export default async function handler(req, res) {
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  if (!sbConfigured()) return res.status(500).json({ error: "Supabase service role not configured" });
  if (!gmailConfigured()) return res.status(501).json({ error: "Gmail not connected." });

  const userId = await getSupabaseUserId(req);
  if (!userId) return res.status(401).json({ error: "Not authenticated" });

  try {
    const { id, draft } = parseBody(req) || {};
    if (!id) return res.status(400).json({ error: "Missing message id" });
    if (!draft || !draft.trim()) return res.status(400).json({ error: "Nothing to send — the draft is empty." });

    // Load the message and confirm it's the caller's and repliable.
    const uid = encodeURIComponent(userId);
    const rows = await sbSelect("messages", `id=eq.${encodeURIComponent(id)}&user_id=eq.${uid}&select=*`);
    const msg = rows[0];
    if (!msg) return res.status(404).json({ error: "Message not found" });
    if (msg.channel !== "email" || !msg.external_id) {
      return res.status(400).json({ error: "This message didn't come from Gmail, so it can't be sent as an email reply." });
    }

    const token = await getAccessToken();
    const target = await getReplyTarget(token, msg.external_id);
    const sent = await sendReply(token, {
      to: target.to,
      subject: target.subject || msg.subject,
      body: draft,
      threadId: msg.thread_id || target.threadId,
      inReplyTo: target.messageId,
    });

    // Mark replied and clear the draft (the reply's been sent; box should empty).
    await sbUpdate("messages", `id=eq.${encodeURIComponent(id)}&user_id=eq.${uid}`, { status: "replied", draft: "" });
    return res.status(200).json({ ok: true, to: target.to, gmailId: sent.id });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
