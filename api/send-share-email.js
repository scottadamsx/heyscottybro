/**
 * Vercel serverless function — emails a document share link via Resend.
 *
 * Optional. If RESEND_API_KEY is not set the endpoint returns 501 and the
 * ShareModal falls back to a mailto: link, so email sharing degrades gracefully.
 *
 * Only sends links that point back at this site's /doc/ share pages, and only
 * for logged-in users (when Supabase env vars are configured) — otherwise this
 * would be an open relay anyone could use to send arbitrary links from our
 * sender address.
 *
 * Env vars (Vercel → Settings → Environment Variables):
 *   RESEND_API_KEY   (from https://resend.com — free tier 3k/mo)
 *   FROM_EMAIL       (a verified sender, e.g. noreply@heyscottybro.com)
 */
import { parseBody, escapeHtml, verifySupabaseUser } from "./_utils.js";

export default async function handler(req, res) {
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return res.status(501).json({ error: "Email not configured (RESEND_API_KEY missing). Use the mailto fallback." });
  }

  if (!(await verifySupabaseUser(req))) {
    return res.status(401).json({ error: "Not authenticated" });
  }

  try {
    const { to, document_name, share_url } = parseBody(req) || {};
    if (!to || !share_url) return res.status(400).json({ error: "Missing 'to' or 'share_url'" });
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(to))) {
      return res.status(400).json({ error: "Invalid recipient email" });
    }

    // The link must be one of this site's own share pages.
    const host = String(req.headers["x-forwarded-host"] || req.headers.host || "");
    let parsed;
    try { parsed = new URL(share_url); } catch { parsed = null; }
    if (!parsed || parsed.protocol !== "https:" || parsed.host !== host || !parsed.pathname.startsWith("/doc/")) {
      return res.status(400).json({ error: "share_url must be a share link on this site" });
    }

    const safeName = escapeHtml(document_name || "Document");
    const resp = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: process.env.FROM_EMAIL || "noreply@heyscottybro.com",
        to: [to],
        subject: `Document shared with you: ${document_name || "Document"}`,
        html: `
          <p>A document has been shared with you.</p>
          <h2 style="margin:0.2em 0;">${safeName}</h2>
          <p><a href="${escapeHtml(parsed.href)}" style="background:#6366f1;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;display:inline-block;">View document</a></p>
          <p style="color:#888;font-size:0.85em;margin-top:2em;">Sent via heyScottyBro. This link may have an expiry date.</p>
        `,
      }),
    });

    if (!resp.ok) {
      const err = await resp.json().catch(() => ({}));
      return res.status(502).json({ error: err?.message || "Resend rejected the request." });
    }
    return res.status(200).json({ ok: true });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
