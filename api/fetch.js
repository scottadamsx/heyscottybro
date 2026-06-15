/**
 * Vercel serverless function — lets Frodo fetch a web page server-side
 * (avoids browser CORS) and returns readable text. Auth-gated like /api/chat.
 */
import { parseBody, verifySupabaseUser } from "./_utils.js";

function htmlToText(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<\/(p|div|li|h[1-6]|tr|br)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/[ \t]+/g, " ").replace(/\n\s*\n\s*\n+/g, "\n\n").trim();
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  if (!(await verifySupabaseUser(req))) return res.status(401).json({ error: "Not authenticated" });

  try {
    const { url } = parseBody(req) || {};
    if (!url || !/^https?:\/\//i.test(url)) return res.status(400).json({ error: "Provide a full http(s) URL" });

    // Basic SSRF guard — don't let the proxy hit internal/private hosts.
    const host = new URL(url).hostname;
    if (/^(localhost|127\.|0\.0\.0\.0|10\.|192\.168\.|169\.254\.|::1)/i.test(host) || /\.local$/i.test(host)) {
      return res.status(400).json({ error: "Blocked host" });
    }

    const r = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; heyScottyBro-Frodo/1.0)", Accept: "text/html,application/json,text/plain,*/*" },
      redirect: "follow",
    });
    const ctype = r.headers.get("content-type") || "";
    const raw = await r.text();

    let title = "", text;
    if (ctype.includes("html")) {
      const m = raw.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
      title = m ? htmlToText(m[1]) : "";
      text = htmlToText(raw);
    } else {
      text = raw;
    }

    const MAX = 12000;
    return res.status(200).json({
      url, status: r.status, title,
      truncated: text.length > MAX,
      text: text.slice(0, MAX),
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
