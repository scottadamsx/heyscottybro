/**
 * Vercel function: Orbit's API for the People space (DR-017). Every /api/orbit/* path is
 * rewritten here (vercel.json). The code is Orbit's own (orbit/server, copied by
 * scripts/sync-orbit.mjs); requests need the signed-in user's Supabase token and run under
 * row security, so a caller only ever reads and writes their own people.
 */
import { createHostedApp } from "../orbit/server/hosted.js";

const BASE = "/api/orbit";
let app = null;

function getApp() {
  if (!app) {
    app = createHostedApp({
      base: BASE,
      url: process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
      publicKey:
        process.env.VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY ||
        process.env.SUPABASE_ANON_KEY ||
        process.env.VITE_SUPABASE_ANON_KEY,
    });
  }
  return app;
}

/** The rewrite may deliver /api/orbit?__orbit=people/x; rebuild the path Orbit's router expects. */
export function orbitUrl(rawUrl) {
  const url = new URL(rawUrl, "http://local");
  const sub = url.searchParams.get("__orbit");
  url.searchParams.delete("__orbit");
  const path = sub != null && url.pathname === BASE ? `${BASE}/${sub.replace(/^\/+/, "")}` : url.pathname;
  const query = url.searchParams.toString();
  return path + (query ? `?${query}` : "");
}

export default function handler(req, res) {
  let orbit;
  try {
    orbit = getApp();
  } catch (e) {
    return res.status(503).json({ ok: false, code: "not_configured", message: e.message });
  }
  req.url = orbitUrl(req.url);
  return orbit(req, res);
}
