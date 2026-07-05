/**
 * Vercel serverless — "Email me" for the universal ExportKit.
 * POST { subject, markdown } → emails the export to the LOGGED-IN USER'S OWN
 * address (resolved from their token — never a caller-supplied recipient, so
 * this can't be used as a relay). Markdown is sent as readable HTML-ish text.
 *
 * Env: RESEND_API_KEY, FROM_EMAIL (same as send-share-email).
 */
import { parseBody, escapeHtml, getSupabaseUser } from "./_utils.js";

// Minimal markdown → email HTML (headings, bold, lists, code, tables kept as text)
function mdToHtml(md) {
  const esc = escapeHtml(String(md));
  return esc
    .replace(/^### (.*)$/gm, "<h3>$1</h3>")
    .replace(/^## (.*)$/gm, "<h2>$1</h2>")
    .replace(/^# (.*)$/gm, "<h1>$1</h1>")
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/^[-*] (.*)$/gm, "• $1")
    .replace(/\n/g, "<br/>");
}

export default async function handler(req, res) {
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return res.status(501).json({ error: "Email not configured (RESEND_API_KEY missing)." });

  const user = await getSupabaseUser(req);
  if (!user) return res.status(401).json({ error: "Not authenticated" });
  if (!user.email) return res.status(400).json({ error: "Your account has no email address" });

  try {
    const { subject, markdown } = parseBody(req) || {};
    if (!markdown) return res.status(400).json({ error: "Missing 'markdown'" });
    const subj = String(subject || "Your heyScottyBro export").slice(0, 160);

    const resp = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: process.env.FROM_EMAIL || "noreply@heyscottybro.com",
        to: [user.email],
        subject: subj,
        html: `<div style="font-family:Georgia,serif;font-size:15px;line-height:1.6;color:#111;max-width:640px;">
          ${mdToHtml(markdown)}
          <p style="color:#888;font-size:12px;margin-top:2em;">Exported from your heyScottyBro command center · ${new Date().toISOString().slice(0, 10)}</p>
        </div>`,
      }),
    });
    const data = await resp.json().catch(() => ({}));
    if (!resp.ok) return res.status(502).json({ error: data?.message || "Resend rejected the email" });
    return res.status(200).json({ ok: true, to: user.email });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
