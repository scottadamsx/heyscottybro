/**
 * The ONE agent-loop core (Phase 5). Before this, the Anthropic call + retry
 * policy + safety limits were pasted into three places (runAgent.js,
 * useAIAgent.js, and a partial copy in api/overseer-run.js) and had already
 * started to drift. Both client loops now import from here.
 */

export const RETRY_STATUSES = new Set([429, 500, 503, 529]);
export const ERROR_STREAK_LIMIT = 3;

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
    const data = await res.json();
    if (!res.ok) throw new Error(data.error?.message || `API error ${res.status}`);
    return data;
  }
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
  while (start > 0 && start < msgs.length - 1 && !(msgs[start].role === "user" && typeof msgs[start].content === "string")) start++;
  return start > 0 ? msgs.slice(start) : msgs;
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
