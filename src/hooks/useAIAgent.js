import { useState, useEffect } from "react";
import { TOOLS, executeTool } from "../api/aiTools";
import { TIERS, buildSystemPrompt, escalationToolFor } from "../api/aiTiers";
import { getAuthHeaders } from "../utils/supabase";

const CHAT_STORE_KEY = "frodo_chat_session";
const CHAT_TTL_MS = 60 * 60 * 1000;

export const MAX_INPUT_CHARS = 4000;
const HISTORY_CHAR_BUDGET = 100000;

/* Catch-nets around each tier (see aiTiers.js for the explicit pass_to_* tools):
 * - transient API failures retry with backoff before counting as a real error
 * - ERROR_STREAK_LIMIT consecutive failed tool calls force a handoff upward
 * - each tier has a tool-turn budget; blowing it forces a handoff (or, at the
 *   top tier, a wrap-up instruction instead of an exception)
 * - history is committed after every completed tool exchange, so even when a
 *   turn dies mid-flight the next message knows what already changed */
const ERROR_STREAK_LIMIT = 3;
const RETRY_STATUSES = new Set([429, 500, 503, 529]);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function trimHistory(msgs) {
  const size = (m) => JSON.stringify(m).length;
  let total = msgs.reduce((s, m) => s + size(m), 0);
  let start = 0;
  while (total > HISTORY_CHAR_BUDGET && start < msgs.length - 2) {
    total -= size(msgs[start]);
    start++;
  }
  while (start > 0 && start < msgs.length - 1 && !(msgs[start].role === "user" && typeof msgs[start].content === "string")) start++;
  return start > 0 ? msgs.slice(start) : msgs;
}

function withCacheMarkers(msgs) {
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

async function callClaude(payload, headers) {
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

function loadSavedChat() {
  try {
    const raw = localStorage.getItem(CHAT_STORE_KEY);
    if (!raw) return { displayMsgs: [], apiHistory: [] };
    const saved = JSON.parse(raw);
    if (!saved.savedAt || Date.now() - saved.savedAt > CHAT_TTL_MS) {
      localStorage.removeItem(CHAT_STORE_KEY);
      return { displayMsgs: [], apiHistory: [] };
    }
    return { displayMsgs: saved.displayMsgs || [], apiHistory: saved.apiHistory || [] };
  } catch {
    return { displayMsgs: [], apiHistory: [] };
  }
}

export default function useAIAgent() {
  const [displayMsgs, setDisplayMsgs] = useState(() => loadSavedChat().displayMsgs);
  const [apiHistory, setApiHistory] = useState(() => loadSavedChat().apiHistory);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("");

  useEffect(() => {
    try {
      if (displayMsgs.length === 0 && apiHistory.length === 0) {
        localStorage.removeItem(CHAT_STORE_KEY);
      } else {
        localStorage.setItem(CHAT_STORE_KEY, JSON.stringify({ savedAt: Date.now(), displayMsgs, apiHistory }));
      }
    } catch { /* storage full — non-fatal */ }
  }, [displayMsgs, apiHistory]);

  const sendMessage = async (attachments = []) => {
    const text = input.trim();
    if ((!text && attachments.length === 0) || loading) return;
    setInput("");
    setLoading(true);

    const shown = text || (attachments.length ? `📎 ${attachments.length} screenshot${attachments.length === 1 ? "" : "s"}` : "");
    let display = [...displayMsgs, { role: "user", text: shown }];
    setDisplayMsgs(display);

    // With image attachments, the user turn becomes a content array (vision).
    const userContent = attachments.length
      ? [
          ...attachments.map((a) => ({ type: "image", source: { type: "base64", media_type: a.media_type, data: a.data } })),
          { type: "text", text: text || "Here's a screenshot — log it." },
        ]
      : text;

    let msgs = trimHistory([...apiHistory, { role: "user", content: userContent }]);
    // Last fully-completed exchange — what we fall back to if the turn dies
    // mid-flight, so already-executed tool side effects stay in history.
    let committed = msgs;

    const pushNote = (note) => {
      display = [...display, { role: "note", text: note }];
      setDisplayMsgs(display);
    };

    let tierIdx = 0;
    let turnsInTier = 0;
    let errorStreak = 0;
    let wrapUpInjected = false;

    // Move one tier up, telling the next model what happened in-band so it
    // continues instead of restarting. `msgs` must end with a tool_results
    // user message — the note rides along as an extra text block.
    const escalate = (reason) => {
      const next = TIERS[tierIdx + 1];
      const last = msgs[msgs.length - 1];
      msgs = [...msgs.slice(0, -1), {
        ...last,
        content: [...last.content, { type: "text", text: `[handoff] ${reason} ${next.label} is taking over — review what was already done above and continue; do not redo completed work.` }],
      }];
      pushNote(`${TIERS[tierIdx].label} passed this to ${next.label} — ${reason}`);
      tierIdx++;
      turnsInTier = 0;
      errorStreak = 0;
    };

    try {
      const authHeaders = await getAuthHeaders();

      for (;;) {
        const tier = TIERS[tierIdx];
        setStatus(`${tier.label} is thinking…`);

        const passTool = escalationToolFor(tierIdx);
        const data = await callClaude({
          model: tier.model,
          max_tokens: 4096,
          system: [{ type: "text", text: buildSystemPrompt(tier), cache_control: { type: "ephemeral" } }],
          tools: passTool ? [...TOOLS, passTool] : TOOLS,
          messages: withCacheMarkers(msgs),
        }, authHeaders);

        const toolBlocks = (data.content || []).filter((b) => b.type === "tool_use");

        if (toolBlocks.length > 0) {
          turnsInTier++;
          const passBlock = passTool ? toolBlocks.find((b) => b.name === passTool.name) : null;

          const results = [];
          for (const block of toolBlocks) {
            if (block === passBlock) {
              results.push({ type: "tool_result", tool_use_id: block.id, content: JSON.stringify({ success: true, note: `Handoff accepted — ${TIERS[tierIdx + 1].label} now has the task.` }) });
              continue;
            }
            setStatus(`${tier.label}: ${block.name.replace(/_/g, " ")}…`);
            const result = await executeTool(block.name, block.input);
            errorStreak = result?.error ? errorStreak + 1 : 0;
            results.push({ type: "tool_result", tool_use_id: block.id, content: JSON.stringify(result) });
          }

          msgs = [...msgs, { role: "assistant", content: data.content }, { role: "user", content: results }];
          committed = msgs;

          if (passBlock && tierIdx < TIERS.length - 1) {
            escalate(passBlock.input?.reason || "needs more firepower.");
            continue;
          }
          if (errorStreak >= ERROR_STREAK_LIMIT && tierIdx < TIERS.length - 1) {
            escalate(`${ERROR_STREAK_LIMIT} tool calls failed in a row.`);
            continue;
          }
          if (turnsInTier >= tier.maxToolTurns) {
            if (tierIdx < TIERS.length - 1) {
              escalate(`hit the ${tier.maxToolTurns}-step budget without finishing.`);
              continue;
            }
            if (!wrapUpInjected) {
              wrapUpInjected = true;
              const last = msgs[msgs.length - 1];
              msgs = [...msgs.slice(0, -1), {
                ...last,
                content: [...last.content, { type: "text", text: "[system] Tool budget exhausted. Stop calling tools now — summarise honestly what was completed, what wasn't, and what Scott should do next." }],
              }];
              continue;
            }
            throw new Error("Ran out of steps even at the top tier — try breaking the request into smaller pieces.");
          }
          continue;
        }

        // No tool calls — this is the reply.
        let replyText = (data.content || []).filter((b) => b.type === "text").map((b) => b.text).join("\n\n").trim();
        if (data.stop_reason === "max_tokens") {
          replyText += "\n\n*…I ran out of room — say \"continue\" and I'll pick up where I left off.*";
        }
        display = [...display, { role: "assistant", by: tier.id, text: replyText || "Done." }];
        setDisplayMsgs(display);
        setApiHistory([...msgs, { role: "assistant", content: data.content }]);
        break;
      }
    } catch (err) {
      // Keep everything that completed, so the next message has true history.
      // Close with an assistant turn so roles still alternate on the next send.
      setApiHistory([...committed, { role: "assistant", content: [{ type: "text", text: `(turn interrupted: ${err.message})` }] }]);
      display = [...display, { role: "assistant", by: TIERS[tierIdx].id, text: `Something went wrong: ${err.message}` }];
      setDisplayMsgs(display);
    } finally {
      setStatus("");
      setLoading(false);
    }
  };

  const clearHistory = () => { setDisplayMsgs([]); setApiHistory([]); };

  return { displayMsgs, input, setInput, loading, status, sendMessage, clearHistory };
}
