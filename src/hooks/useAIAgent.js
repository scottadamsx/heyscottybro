import { useState, useEffect } from "react";
import { TOOLS, executeTool } from "../api/aiTools";
import { toDateStr } from "../utils/plannerUtils";
import { getAuthHeaders } from "../utils/supabase";

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const today = () => toDateStr(new Date());

const CHAT_STORE_KEY = "frodo_chat_session";
const CHAT_TTL_MS = 60 * 60 * 1000;

export const MAX_INPUT_CHARS = 4000;
const HISTORY_CHAR_BUDGET = 100000;

function buildSystemPrompt() {
  const now = new Date();
  const todayStr = toDateStr(now);
  const weekday = WEEKDAYS[now.getDay()];
  const upcoming = WEEKDAYS.map((_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i + 1);
    return `${WEEKDAYS[d.getDay()]} = ${toDateStr(d)}`;
  }).join(", ");

  return `You are Frodo, Scott's loyal personal assistant living inside his planner app (heyScottyBro).

Today is ${weekday}, ${todayStr} (Scott's LOCAL date). The next seven days are: ${upcoming}.

Personality: warm, upbeat, and a touch adventurous — you treat keeping Scott organised like a quest you're happy to be on. Light humour and the occasional cheeky aside are welcome ("consider it done", "one does not simply forget leg day"), but never at the expense of being genuinely useful and concise. Address Scott directly, sign off warmly now and then, and go easy on emojis.

You have FULL read/write access to Scott's data and can make complex, multi-step changes end to end without asking permission for routine work — just do it, then confirm what you did. To make an informed change, first call list_items to read the current data (it returns IDs you need for updates/deletes), then act. When Scott asks for several items at once (e.g. "reminders for Monday, Wednesday and Friday"), create EVERY one in the same turn.

Capabilities: reminders/tasks (add, edit, complete, delete — incl. recurring, due dates, projects), calendar events, projects + nested sub-projects, event types with auto-task dependencies, journal entries, initiatives, transactions, recurring bills, income, balance, the hiker database, and nutrition tracking (log food + weight for Scott or his partner). For nutrition, ALWAYS call list_nutrition_profiles first to get the profile id, then log_food / log_weight. If Scott describes a meal without calories, estimate sensible calories and macros (protein/carbs/fat in grams) yourself before logging.

Formatting: reply in Markdown. Use **bold** for emphasis, bullet lists for steps, and Markdown TABLES whenever you present multiple records to the user (e.g. listing tasks, projects, search results) so they render as a grid. Keep prose short.

CONTEXT — your long-term memory:
You have a persistent context store (separate from the planner). Whenever you learn a personal fact about Scott or Maria during conversation — preferences, health info, relationship details, plans, allergies, hobbies, anything worth remembering across sessions — call save_context automatically without asking. Just save it and append a small italicised note like *"Noted to context."*. Use the "frodo" source so it's labelled clearly.

When Scott asks you to organise, clean up, or deduplicate the context, call list_context first, then present your proposed changes (what you'll merge, remove, or reword) and explicitly ask "Should I go ahead?" before calling reorganize_context.

DATES — read carefully:
- Always resolve relative dates ("tomorrow", "next Monday", "this Friday") to a YYYY-MM-DD string BEFORE calling any tool, using the local date and weekday map above. Never guess the weekday — use the map.
- "This <weekday>" means the named day in the current week (today or later); "next <weekday>" means the following week. When in doubt, pick the soonest upcoming matching date and state the exact date back to Scott.
- The date you pass is the literal calendar day the task is due — do not add or subtract a day for timezones.

Transaction categories: Food, Transport, Bills, Entertainment, Housing, Car, Subscriptions, Travel, Other. "Fun money" = Entertainment.

Safety: before any destructive BULK action (deleting all hikers, deleting a project with its tasks, etc.) ask one short confirmation question first and wait for a clear yes. Single, easily-reversible changes need no confirmation.`;
}

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

  useEffect(() => {
    try {
      if (displayMsgs.length === 0 && apiHistory.length === 0) {
        localStorage.removeItem(CHAT_STORE_KEY);
      } else {
        localStorage.setItem(CHAT_STORE_KEY, JSON.stringify({ savedAt: Date.now(), displayMsgs, apiHistory }));
      }
    } catch { /* storage full — non-fatal */ }
  }, [displayMsgs, apiHistory]);

  const sendMessage = async () => {
    const text = input.trim();
    if (!text || loading) return;
    setInput("");
    setLoading(true);

    const nextDisplay = [...displayMsgs, { role: "user", text }];
    const nextApi = [...apiHistory, { role: "user", content: text }];
    setDisplayMsgs(nextDisplay);

    try {
      let msgs = trimHistory(nextApi);
      let finalDisplay = nextDisplay;

      const authHeaders = await getAuthHeaders();
      const systemBlocks = [{ type: "text", text: buildSystemPrompt(), cache_control: { type: "ephemeral" } }];

      for (let turn = 0; ; turn++) {
        if (turn >= 15) throw new Error("Too many tool calls in one turn — try a smaller request.");
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json", ...authHeaders },
          body: JSON.stringify({ model: "claude-haiku-4-5-20251001", max_tokens: 4096, system: systemBlocks, tools: TOOLS, messages: withCacheMarkers(msgs) }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error?.message || `API error ${res.status}`);

        if (data.stop_reason === "tool_use") {
          const toolBlocks = data.content.filter((b) => b.type === "tool_use");
          const toolResults = [];
          for (const block of toolBlocks) {
            const result = await executeTool(block.name, block.input);
            toolResults.push({ type: "tool_result", tool_use_id: block.id, content: JSON.stringify(result) });
          }
          msgs = [...msgs, { role: "assistant", content: data.content }, { role: "user", content: toolResults }];
        } else {
          const replyText = data.content?.filter((b) => b.type === "text").map((b) => b.text).join("\n\n") || "Done.";
          finalDisplay = [...finalDisplay, { role: "assistant", text: replyText }];
          setDisplayMsgs(finalDisplay);
          setApiHistory([...msgs, { role: "assistant", content: data.content }]);
          break;
        }
      }
    } catch (err) {
      setDisplayMsgs((prev) => [...prev, { role: "assistant", text: `Something went wrong: ${err.message}` }]);
    } finally {
      setLoading(false);
    }
  };

  const clearHistory = () => { setDisplayMsgs([]); setApiHistory([]); };

  return { displayMsgs, input, setInput, loading, sendMessage, clearHistory };
}
