/**
 * Vercel serverless function — proxies Claude API calls server-side.
 * Set ANTHROPIC_API_KEY in Vercel project → Settings → Environment Variables.
 * Requires a logged-in Supabase session when SUPABASE_URL is configured; see api/_utils.js.
 */
import { proxyAnthropic } from "./_utils.js";

export default function handler(req, res) {
  return proxyAnthropic(req, res);
}
