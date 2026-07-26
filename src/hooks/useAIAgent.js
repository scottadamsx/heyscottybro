import { useState, useEffect, useRef } from "react";
import { TOOLS, executeTool } from "../api/aiTools";
import { callClaude, trimHistory as trimHistoryCore, withCacheMarkers, ERROR_STREAK_LIMIT } from "../agents/loop";
import { TIERS, buildSystemPrompt, escalationToolFor } from "../api/aiTiers";
import { getAuthHeaders } from "../utils/supabase";
import { loadAgentSessions, saveAgentSession, clearAgentSession } from "../api/agentSessionsApi";

// Legacy store. Frodo used to keep his whole memory here behind a ONE HOUR TTL,
// which is why he'd forget a conversation from earlier the same day and ask
// Scott to repeat himself. History now lives in Supabase `agent_sessions` (the
// same store the Command Center agents use), so it survives refreshes, new
// tabs, days, and devices. This key is read once to migrate, then removed.
const LEGACY_CHAT_KEY = "frodo_chat_session";
const AGENT_ID = "frodo";

export const MAX_INPUT_CHARS = 4000;
const HISTORY_CHAR_BUDGET = 100000;
// What we PERSIST is smaller than what we send: a long-lived row shouldn't grow
// without bound, and old turns stop earning their keep.
const PERSIST_CHAR_BUDGET = 60000;

/* Catch-nets around each tier (see aiTiers.js for the explicit pass_to_* tools):
 * - transient API failures retry with backoff before counting as a real error
 * - ERROR_STREAK_LIMIT consecutive failed tool calls force a handoff upward
 * - each tier has a tool-turn budget; blowing it forces a handoff (or, at the
 *   top tier, a wrap-up instruction instead of an exception)
 * - history is committed after every completed tool exchange, so even when a
 *   turn dies mid-flight the next message knows what already changed */

const trimHistory = (msgs) => trimHistoryCore(msgs, HISTORY_CHAR_BUDGET);

/**
 * Strip base64 image payloads before storing. A single screenshot is ~1–3 MB of
 * base64; persisting a few would blow past Postgres row limits and make every
 * load slow. The model already described the image in its reply, so the stored
 * turn keeps a placeholder that reads correctly in future context.
 */
function stripImages(msgs) {
  return msgs.map((m) => {
    if (!Array.isArray(m.content)) return m;
    return {
      ...m,
      content: m.content.map((b) =>
        b.type === "image" ? { type: "text", text: "[screenshot Scott attached earlier]" } : b),
    };
  });
}

function readLegacyChat() {
  try {
    const raw = localStorage.getItem(LEGACY_CHAT_KEY);
    if (!raw) return null;
    const saved = JSON.parse(raw);
    if (!saved?.displayMsgs?.length && !saved?.apiHistory?.length) return null;
    return { displayMsgs: saved.displayMsgs || [], apiHistory: saved.apiHistory || [] };
  } catch {
    return null;
  }
}

export default function useAIAgent() {
  const [displayMsgs, setDisplayMsgs] = useState([]);
  const [apiHistory, setApiHistory] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("");
  // Until the stored session has been read back, don't write over it — an empty
  // first render would otherwise wipe the very history we're restoring.
  const hydrated = useRef(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      let restored = null;
      try {
        const sessions = await loadAgentSessions();
        const mine = sessions[AGENT_ID];
        if (mine && (mine.display?.length || mine.convo?.length)) {
          restored = { displayMsgs: mine.display || [], apiHistory: mine.convo || [] };
        }
      } catch { /* offline / not migrated — fall through to the legacy store */ }

      // One-time migration off the old localStorage store.
      if (!restored) restored = readLegacyChat();
      try { localStorage.removeItem(LEGACY_CHAT_KEY); } catch { /* noop */ }

      if (cancelled) return;
      if (restored) {
        setDisplayMsgs(restored.displayMsgs);
        setApiHistory(restored.apiHistory);
      }
      hydrated.current = true;
    })();
    return () => { cancelled = true; };
  }, []);

  // Persist after every settled change. Debounced so a burst of tool turns
  // writes once, and image-stripped/trimmed so the row stays small.
  useEffect(() => {
    if (!hydrated.current) return undefined;
    const t = setTimeout(() => {
      saveAgentSession(AGENT_ID, {
        display: displayMsgs.slice(-200),
        convo: trimHistoryCore(stripImages(apiHistory), PERSIST_CHAR_BUDGET),
      }).catch(() => { /* non-fatal: the chat still works in memory */ });
    }, 600);
    return () => clearTimeout(t);
  }, [displayMsgs, apiHistory]);

  const sendMessage = async (attachments = []) => {
    const text = input.trim();
    if ((!text && attachments.length === 0) || loading) return;
    setInput("");
    setLoading(true);

    const shown = text || (attachments.length ? `📎 ${attachments.length} screenshot${attachments.length === 1 ? "" : "s"}` : "");
    let display = [...displayMsgs, { role: "user", text: shown, shots: attachments.length || undefined }];
    setDisplayMsgs(display);

    // With image attachments, the user turn becomes a content array (vision).
    const userContent = attachments.length
      ? [
          ...attachments.map((a) => ({ type: "image", source: { type: "base64", media_type: a.media_type, data: a.data } })),
          { type: "text", text: text || "Here's a screenshot — look at it and tell me what you see, then log it if it's a bug or a feature request." },
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

  const clearHistory = () => {
    setDisplayMsgs([]);
    setApiHistory([]);
    clearAgentSession(AGENT_ID).catch(() => { /* noop */ });
  };

  return { displayMsgs, input, setInput, loading, status, sendMessage, clearHistory };
}
