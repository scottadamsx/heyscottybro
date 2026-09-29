import crypto from "node:crypto";

/**
 * Agent API authentication.
 *
 * Production env:
 *   HSB_AGENT_OWNER_ID=<Supabase auth user UUID whose brain/projects agents may access>
 *   HSB_AGENT_KEYS={"project-manager":"long-secret-1","mybackyard-admin":"long-secret-2"}
 *
 * Callers send either:
 *   Authorization: Bearer <secret>
 * or
 *   X-Agent-Key: <secret>
 *
 * Secrets never live in the database or browser. Rotate one agent without
 * touching Supabase credentials. The returned `id` becomes provenance on every
 * brain/context/action write.
 */

function safeEqual(a, b) {
  const aa = Buffer.from(String(a || ""));
  const bb = Buffer.from(String(b || ""));
  if (!aa.length || aa.length !== bb.length) return false;
  return crypto.timingSafeEqual(aa, bb);
}

function configuredAgents() {
  const raw = process.env.HSB_AGENT_KEYS || "";
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    console.error("[agent-api] HSB_AGENT_KEYS is not valid JSON");
    return {};
  }
}

export function agentOwnerId() {
  return String(process.env.HSB_AGENT_OWNER_ID || "").trim() || null;
}

export function authenticateAgent(req) {
  const ownerId = agentOwnerId();
  if (!ownerId) return { ok: false, status: 503, error: "Agent API owner is not configured" };

  const auth = String(req.headers.authorization || "").replace(/^Bearer\s+/i, "").trim();
  const headerKey = String(req.headers["x-agent-key"] || "").trim();
  const supplied = auth || headerKey;
  if (!supplied) return { ok: false, status: 401, error: "Missing agent key" };

  const agents = configuredAgents();
  for (const [id, secret] of Object.entries(agents)) {
    if (safeEqual(supplied, secret)) return { ok: true, id, ownerId };
  }
  return { ok: false, status: 401, error: "Invalid agent key" };
}

export function requireAgent(req, res) {
  const auth = authenticateAgent(req);
  if (!auth.ok) {
    res.status(auth.status).json({ error: auth.error });
    return null;
  }
  return auth;
}
