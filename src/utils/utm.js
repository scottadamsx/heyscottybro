/**
 * UTM tagging for outbound links on the PUBLIC site (never /admin).
 *
 * Pure helpers — no DOM, no React — so they run under `node --test`.
 * The public shell calls tagOutboundHref() from a delegated click handler, so
 * the rewrite happens at click time and the rendered markup stays untouched.
 *
 * A link is tagged only when ALL of these hold:
 *   - it is http(s) and points at a different origin (mailto:, tel:, javascript:,
 *     relative and same-site links are left alone);
 *   - it carries no auth / signed-URL material (tokens, signatures, storage
 *     sign paths) — adding params to a signed URL can break or leak it;
 *   - the current page is not under /admin, and not a shared-document page
 *     (/doc/:token), whose links are signed file URLs.
 * Existing utm_* params are never overwritten; only missing ones are added.
 */

export const UTM_SOURCE = "heyscottybro";
export const UTM_MEDIUM = "referral";

// Query/hash parameter names that mean "this URL is a credential".
const AUTH_PARAM = /^(token|access_token|id_token|refresh_token|auth|authorization|code|state|sig|signature|key|api_key|apikey|jwt|session|sessionid|otp|password|secret|expires|x-amz-.*|x-goog-.*|googleaccessid|se|sp|sv|sr|st|skoid)$/i;
// Path shapes of signed storage URLs (Supabase, S3-style pre-signed paths).
const SIGNED_PATH = /\/(object\/sign|storage\/v1\/object\/sign|render\/image\/sign)\//i;

/** Page name used as utm_campaign: the first path segment, or "home". */
export function campaignForPath(pathname = "/") {
  const seg = String(pathname).split("/").filter(Boolean)[0];
  return seg ? seg.toLowerCase().replace(/[^a-z0-9-]/g, "") || "home" : "home";
}

/** True for pages whose links must never be rewritten. */
export function isExcludedPage(pathname = "/") {
  return /^\/(admin|doc)(\/|$)/.test(String(pathname));
}

function parse(href, origin) {
  try { return new URL(href, origin); } catch { return null; }
}

/** http(s) and a different origin than the site. */
export function isOutbound(href, origin) {
  const u = parse(href, origin);
  if (!u) return false;
  if (u.protocol !== "http:" && u.protocol !== "https:") return false;
  return u.origin !== new URL(origin).origin;
}

/** True when the URL carries a token, signature or signed-storage path. */
export function hasAuthMaterial(href, origin) {
  const u = parse(href, origin);
  if (!u) return true; // unparseable: don't touch it
  if (u.username || u.password) return true;
  if (SIGNED_PATH.test(u.pathname)) return true;
  for (const name of u.searchParams.keys()) if (AUTH_PARAM.test(name)) return true;
  if (u.hash.length > 1) {
    const hashParams = new URLSearchParams(u.hash.slice(1));
    for (const name of hashParams.keys()) if (AUTH_PARAM.test(name)) return true;
  }
  return false;
}

/**
 * Returns the href with UTM params added, or the original href unchanged when
 * the link is not eligible. `pathname` is the page the link sits on.
 */
export function tagOutboundHref(href, { origin, pathname = "/" } = {}) {
  if (!href || !origin) return href;
  if (isExcludedPage(pathname)) return href;
  if (!isOutbound(href, origin)) return href;
  if (hasAuthMaterial(href, origin)) return href;
  const u = parse(href, origin);
  const want = { utm_source: UTM_SOURCE, utm_medium: UTM_MEDIUM, utm_campaign: campaignForPath(pathname) };
  let changed = false;
  for (const [k, v] of Object.entries(want)) {
    if (!u.searchParams.has(k)) { u.searchParams.set(k, v); changed = true; }
  }
  return changed ? u.toString() : href;
}
