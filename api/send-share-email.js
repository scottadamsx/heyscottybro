/**
 * Vercel serverless function — emails a document share link via Resend.
 *
 * Optional. If RESEND_API_KEY is not set the endpoint returns 501 and the
 * ShareModal falls back to a mailto: link, so email sharing degrades gracefully.
 *
 * Env vars (Vercel → Settings → Environment Variables):
 *   RESEND_API_KEY   (from https://resend.com — free tier 3k/mo)
 *   FROM_EMAIL       (a verified sender, e.g. noreply@heyscottybro.com)
 */
export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return res.status(501).json({ error: "Email not configured (RESEND_API_KEY missing). Use the mailto fallback." });
  }

  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
    const { to, document_name, share_url } = body || {};
    if (!to || !share_url) return res.status(400).json({ error: "Missing 'to' or 'share_url'" });

    const resp = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: process.env.FROM_EMAIL || "noreply@heyscottybro.com",
        to: [to],
        subject: `Document shared with you: ${document_name || "Document"}`,
        html: `
          <p>A document has been shared with you.</p>
          <h2 style="margin:0.2em 0;">${document_name || "Document"}</h2>
          <p><a href="${share_url}" style="background:#6366f1;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;display:inline-block;">View document</a></p>
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
