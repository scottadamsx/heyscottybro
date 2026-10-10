/**
 * Vercel serverless function — proxies Claude API calls (with tool use) server-side.
 * Set ANTHROPIC_API_KEY in Vercel project → Settings → Environment Variables.
 * Requires a logged-in Supabase session when SUPABASE_URL is configured; see api/_utils.js.
 */
import { proxyAnthropic, verifySupabaseUser } from "./_utils.js";
import { handleJournalCleanup, journalCleanupStatus, JOURNAL_CLEANUP_FEATURE } from "./_journalCleanup.js";
import { handleEventDraft, eventDraftStatus, EVENT_DRAFT_FEATURE } from "./_eventDraft.js";

export async function handleChatRoute(req, res, {
  verify = verifySupabaseUser,
  cleanup = handleJournalCleanup,
  status = journalCleanupStatus,
  proxy = proxyAnthropic,
  draft = handleEventDraft,
  draftStatus = eventDraftStatus,
} = {}) {
  if (req.method === "GET") {
    if (!(await verify(req))) return res.status(401).json({ error: "Not authenticated" });
    return res.status(200).json({ journalCleanup: status(), eventDrafting: draftStatus() });
  }
  let body = req.body;
  try { if (typeof body === "string") body = JSON.parse(body); } catch { /* proxy returns the canonical body error */ }
  if (req.method === "POST" && body?.feature === JOURNAL_CLEANUP_FEATURE) {
    return cleanup({ ...req, body }, res);
  }
  if (req.method === "POST" && body?.feature === EVENT_DRAFT_FEATURE) {
    return draft({ ...req, body }, res);
  }
  return proxy(req, res);
}

export default function handler(req, res) {
  return handleChatRoute(req, res);
}
