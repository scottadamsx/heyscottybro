/**
 * The ONE agent-loop core (Phase 5). Before this, the Anthropic call + retry
 * policy + safety limits were pasted into three places (runAgent.js,
 * useAIAgent.js, and a partial copy in api/overseer-run.js) and had already
 * started to drift. Both client loops now import from here.
 */

export const RETRY_STATUSES = new Set([429, 500, 503, 529]);
export const ERROR_STREAK_LIMIT = 3;

import { parseJsonResponse } from "../lib/http.js";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** POST /api/chat with exponential-backoff retries on transient failures. */
export async function callClaude(payload, headers) {
  for (let attempt = 0; ; attempt++) {
    let res;
    try {
      res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...headers },
        body: JSON.stringify(payload),
      });
    } catch (err) {
      if (attempt >= 2) throw err;
      await sleep(800 * 2 ** attempt);
      continue;
    }
    if (RETRY_STATUSES.has(res.status) && attempt < 2) {
      await sleep(1200 * 2 ** attempt);
      continue;
    }
    // Guarded parse: an HTML error page from the platform used to surface as
    // "unexpected MIME type" — now the real status + snippet reaches the user.
    const data = await parseJsonResponse(res);
    if (!res.ok) throw new Error(data.error?.message || (typeof data.error === "string" ? data.error : "") || `API error ${res.status}`);
    return data;
  }
}

/**
 * A user turn we can safely restart history from: any user message that is
 * NOT a tool_result batch — a plain string, or a content array that carries a
 * text/image block. Restarting on a tool_result turn would orphan the tool
 * calls from the assistant turn we just dropped.
 */
export function isRestartableUserTurn(m) {
  if (!m || m.role !== "user") return false;
  if (typeof m.content === "string") return true;
  if (!Array.isArray(m.content)) return false;
  return m.content.some((b) => b && b.type !== "tool_result");
}

/** Trim history to a character budget, keeping turn boundaries sane. */
export function trimHistory(msgs, budget = 100000) {
  const size = (m) => JSON.stringify(m).length;
  let total = msgs.reduce((s, m) => s + size(m), 0);
  let start = 0;
  while (total > budget && start < msgs.length - 2) {
    total -= size(msgs[start]);
    start++;
  }
  if (start === 0) return msgs;
  // Advance to the next clean user turn. Previously this only accepted
  // string-content user messages, so a history of tool exchanges (arrays) let
  // the scan walk to the end and wipe everything but the last message. If no
  // clean turn exists, keep the budget-computed slice rather than collapsing.
  let aligned = start;
  while (aligned < msgs.length - 1 && !isRestartableUserTurn(msgs[aligned])) aligned++;
  if (aligned >= msgs.length - 1 || !isRestartableUserTurn(msgs[aligned])) aligned = start;
  return msgs.slice(aligned);
}

/** Mark the last content block ephemeral for prompt caching. */
export function withCacheMarkers(msgs) {
  return msgs.map((m, i) => {
    const isLast = i === msgs.length - 1;
    let content = m.content;
    if (typeof content === "string") {
      if (!isLast) return m;
      content = [{ type: "text", text: content }];
    } else {
      content = content.map(({ cache_control, ...b }) => b);
    }
    if (isLast && content.length > 0) {
      content = content.map((b, j) => (j === content.length - 1 ? { ...b, cache_control: { type: "ephemeral" } } : b));
    }
    return { ...m, content };
  });
}
