/**
 * Shared helpers for the Vercel serverless functions. Files prefixed with "_"
 * in /api are not exposed as routes.
 */

/** Parse a JSON body that may arrive as a string or an object. */
export function parseBody(req) {
  return typeof req.body === "string" ? JSON.parse(req.body) : req.body;
}

export function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Resolve the Supabase project URL + a key usable as the `apikey` header.
 * Serverless functions prefer the bare SUPABASE_* names, but fall back to the
 * VITE_-prefixed vars the SPA build already sets on Vercel — so auth works even
 * if only the frontend vars were configured. The service-role key is preferred
 * (bypasses RLS); the publishable/anon key is fine for validating a user token.
 */
export function supabaseEnv() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    process.env.VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY ||
    process.env.VITE_SUPABASE_ANON_KEY;
  return { url, key };
}

/**
 * Verify the caller is a logged-in Supabase user (the SPA sends its session
 * token as `Authorization: Bearer <jwt>`). Validates the token against the
 * project's /auth/v1/user endpoint. If no Supabase env vars are set at all,
 * verification fails CLOSED so unconfigured deployments can't be called.
 *
 * @returns {Promise<boolean>} true if the request is allowed
 */
export async function verifySupabaseUser(req) {
  const { url, key } = supabaseEnv();
  if (!url || !key) return false; // auth not configured — fail CLOSED (Phase 1)

  const token = String(req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  if (!token) return false;
  try {
    const res = await fetch(`${url.replace(/\/$/, "")}/auth/v1/user`, {
      headers: { apikey: key, Authorization: `Bearer ${token}` },
    });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Resolve the logged-in Supabase user's id from the request's Bearer token,
 * or null if the token is missing/invalid. Like verifySupabaseUser but returns
 * the id so a function can scope writes to the caller.
 */
export async function getSupabaseUserId(req) {
  const { url, key } = supabaseEnv();
  if (!url || !key) return null;
  const token = String(req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  if (!token) return null;
  try {
    const res = await fetch(`${url.replace(/\/$/, "")}/auth/v1/user`, {
      headers: { apikey: key, Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return null;
    const user = await res.json();
    return user?.id || null;
  } catch {
    return null;
  }
}

/**
 * Resolve the logged-in user's { id, email } from the Bearer token, or null.
 * Used by send-to-me so exports can only ever be mailed to the account owner.
 */
export async function getSupabaseUser(req) {
  const { url, key } = supabaseEnv();
  if (!url || !key) return null;
  const token = String(req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  if (!token) return null;
  try {
    const res = await fetch(`${url.replace(/\/$/, "")}/auth/v1/user`, {
      headers: { apikey: key, Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return null;
    const user = await res.json();
    return user?.id ? { id: user.id, email: user.email || null } : null;
  } catch {
    return null;
  }
}

// Only the models this app actually uses may pass through the proxy, so a
// leaked endpoint can't be used to run expensive models on our key.
// Frodo (haiku) → Sam (sonnet) → Gandalf (opus) escalation ladder.
const ALLOWED_MODELS = new Set(["claude-haiku-4-5-20251001", "claude-sonnet-4-6", "claude-opus-4-8"]);
const MAX_TOKENS_CAP = 4096;

/**
 * Proxy a Messages API call to Anthropic. The endpoints are same-origin with
 * the SPA, so no CORS headers are needed (and none are set — wildcard CORS
 * here would let any website spend our API credit).
 */
export async function proxyAnthropic(req, res) {
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "ANTHROPIC_API_KEY not configured — add it to Vercel environment variables" });
  }

  if (!(await verifySupabaseUser(req))) {
    return res.status(401).json({ error: "Not authenticated" });
  }

  try {
    const body = parseBody(req);
    if (!body || !Array.isArray(body.messages)) {
      return res.status(400).json({ error: "Invalid request body" });
    }
    if (!ALLOWED_MODELS.has(body.model)) {
      return res.status(400).json({ error: `Model not allowed: ${body.model}` });
    }
    body.max_tokens = Math.min(Number(body.max_tokens) || 1024, MAX_TOKENS_CAP);

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify(body),
    });

    const data = await response.json();
    return res.status(response.status).json(data);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
