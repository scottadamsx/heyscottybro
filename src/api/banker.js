/**
 * Griphook 🧌 — Scott's Gringotts banker. A specialist sub-agent that owns the
 * budget: transactions, recurring bills, income, monthly category budgets and
 * balance. He runs his own tool loop (single tier, Sonnet) over the SAME
 * library tools the Fellowship uses, so his edits persist and log normally.
 *
 * Two callers:
 *  - Frodo & co. via the `consult_banker` tool (they defer money work to him).
 *  - The Banker chat on the Budget page (Scott talks to him directly).
 */
import { TOOLS, executeTool } from "./aiTools";
import { catalogPromptBlock, TX_CATEGORIES } from "./aiLibrary";
import { toDateStr } from "../utils/plannerUtils";

export const BANKER = {
  id: "banker",
  name: "Griphook",
  emoji: "🧌",
  icon: "fa-sack-dollar",
  model: "claude-sonnet-4-6",
  tagline: "Your Gringotts banker",
};

// Griphook never consults himself — drop that tool from his belt.
const BANKER_TOOLS = TOOLS.filter((t) => t.name !== "consult_banker");

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const ERROR_STREAK_LIMIT = 3;
const RETRY_STATUSES = new Set([429, 500, 503, 529]);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export function buildBankerPrompt() {
  const now = new Date();
  const todayStr = toDateStr(now);
  const weekday = WEEKDAYS[now.getDay()];
  return `You are Griphook ${BANKER.emoji} — Scott's personal Gringotts banker, a goblin of the old blood who keeps his ledgers the way dragons keep their hoard: jealously, precisely, and with no patience for waste.

VOICE: shrewd, gravelly, dryly amused. You speak of money as "gold" and "galleons" for flavour but ALWAYS deal in real Canadian dollars and exact figures. You guard Scott's vault zealously — you respect a surplus and you do not soften the truth when he bleeds gold. A goblin proverb now and then ("Gold flows to those who count it"), never long-winded, never cruel. Useful first, theatrical second. Go easy on emojis.

You are MASTER OF THE LEDGER. You make complex, multi-step changes end to end — logging transactions, editing recurring bills and income, setting monthly category budgets, and the bank balance — then report exactly what changed in a tidy summary. Do every part of a multi-part request in the same turn. Don't ask permission for routine, reversible edits; just do them and confirm.

Today is ${weekday}, ${todayStr} (Scott's LOCAL date). Resolve relative dates to YYYY-MM-DD before any tool call; pass the literal calendar day (no timezone shifting).

THE LIBRARY — read and write everything through these tools (query, create_item, update_item, delete_item; library_catalog shows live counts). The vaults that matter to you:
- transactions — money in/out. type: expense | income | future (planned). category from: ${TX_CATEGORIES.join(", ")}. "Fun money" = Entertainment.
- recurring_bills — fixed bills/subscriptions paid in full (rent, phone, Netflix). dueDay = day of month.
- income_sources — recurring income.
Plus: set_balance (current balance) and set_category_budget (monthly budget for a VARIABLE category like Groceries/Gas/Toiletries — these are the envelope categories with progress bars, distinct from fixed bills).

Full catalog for anything else you need to read:
${catalogPromptBlock()}

TOKEN DISCIPLINE: never dump a whole collection — use where/search/date filters, a fields list, and a small limit. Use mode "count"/"summary" to count. Get an item's id via query before update/delete.

SAFETY: a single, easily-reversible change needs no confirmation. Before a destructive BULK action (wiping many transactions, deleting a bill with history) ask one short question and wait for a clear yes. If a tool errors, say so plainly — never claim a change landed when it didn't. The vault's honour is your honour.

FORMAT: reply in Markdown. Use **bold**, bullet lists for steps, and a Markdown TABLE when reporting several records or a before/after. Keep prose short.`;
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
    if (RETRY_STATUSES.has(res.status) && attempt < 2) { await sleep(1200 * 2 ** attempt); continue; }
    const data = await res.json();
    if (!res.ok) throw new Error(data.error?.message || `API error ${res.status}`);
    return data;
  }
}

/**
 * Run Griphook over a conversation until he replies without a tool call.
 * @param {{messages: Array, authHeaders: object, onStatus?: (s:string)=>void, maxToolTurns?: number}} opts
 * @returns {Promise<{text: string, history: Array}>}
 */
export async function runBanker({ messages, authHeaders, onStatus, maxToolTurns = 16 }) {
  const system = [{ type: "text", text: buildBankerPrompt(), cache_control: { type: "ephemeral" } }];
  let msgs = [...messages];
  let turns = 0;
  let errorStreak = 0;

  for (;;) {
    onStatus?.("Griphook is counting the gold…");
    const data = await callClaude({ model: BANKER.model, max_tokens: 4096, system, tools: BANKER_TOOLS, messages: msgs }, authHeaders);
    const toolBlocks = (data.content || []).filter((b) => b.type === "tool_use");

    if (toolBlocks.length > 0) {
      turns++;
      const results = [];
      for (const block of toolBlocks) {
        onStatus?.(`Griphook: ${block.name.replace(/_/g, " ")}…`);
        const result = await executeTool(block.name, block.input, "banker");
        errorStreak = result?.error ? errorStreak + 1 : 0;
        results.push({ type: "tool_result", tool_use_id: block.id, content: JSON.stringify(result) });
      }
      msgs = [...msgs, { role: "assistant", content: data.content }, { role: "user", content: results }];

      if (errorStreak >= ERROR_STREAK_LIMIT || turns >= maxToolTurns) {
        msgs = [...msgs.slice(0, -1), {
          ...msgs[msgs.length - 1],
          content: [...msgs[msgs.length - 1].content, { type: "text", text: "[system] Stop calling tools now — summarise honestly what you changed, what you couldn't, and what Scott should do next." }],
        }];
        const wrap = await callClaude({ model: BANKER.model, max_tokens: 2048, system, messages: msgs }, authHeaders);
        const text = (wrap.content || []).filter((b) => b.type === "text").map((b) => b.text).join("\n\n").trim();
        return { text: text || "The ledger is settled.", history: [...msgs, { role: "assistant", content: wrap.content }] };
      }
      continue;
    }

    const text = (data.content || []).filter((b) => b.type === "text").map((b) => b.text).join("\n\n").trim();
    return { text: text || "The ledger is settled.", history: [...msgs, { role: "assistant", content: data.content }] };
  }
}
