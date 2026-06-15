/**
 * Generalized agent runner — the heart of every API agent in the Command
 * Center. It's the same tool loop Griphook the banker has always used
 * (src/api/banker.js), lifted out and parameterized by an agent config so each
 * agent brings its OWN wrapper (system prompt), connector (model) and toolbelt:
 *
 *   const { text, history } = await runAgent({ agent, messages, authHeaders });
 *
 * An `agent` is a plain object: { id, name, model, buildPrompt(), tools(TOOLS), maxToolTurns?, thinking? }.
 * Actions are attributed to `agent.id` in the agent_actions audit log.
 *
 * Local agents (kind: "local", e.g. the Claude Code coding agent) do NOT run
 * here — the Command Center talks to the local agent-server instead.
 */
import { TOOLS, executeTool } from "../api/aiTools";

const RETRY_STATUSES = new Set([429, 500, 503, 529]);
const ERROR_STREAK_LIMIT = 3;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

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
    if (RETRY_STATUSES.has(res.status) && attempt < 2) { await sleep(1200 * 2 ** attempt); continue; }
    const data = await res.json();
    if (!res.ok) throw new Error(data.error?.message || `API error ${res.status}`);
    return data;
  }
}

/**
 * Run an agent over a conversation until it replies without calling a tool.
 * @returns {Promise<{text: string, history: Array}>}
 */
export async function runAgent({ agent, messages, authHeaders, onStatus, maxToolTurns }) {
  const cap = maxToolTurns || agent.maxToolTurns || 16;
  const system = [{ type: "text", text: agent.buildPrompt(), cache_control: { type: "ephemeral" } }];
  const tools = typeof agent.tools === "function" ? agent.tools(TOOLS) : (agent.tools || TOOLS);
  let msgs = [...messages];
  let turns = 0;
  let errorStreak = 0;

  for (;;) {
    onStatus?.(agent.thinking || `${agent.name} is working…`);
    const data = await callClaude({ model: agent.model, max_tokens: 4096, system, tools, messages: msgs }, authHeaders);
    const toolBlocks = (data.content || []).filter((b) => b.type === "tool_use");

    if (toolBlocks.length > 0) {
      turns++;
      const results = [];
      for (const block of toolBlocks) {
        onStatus?.(`${agent.name}: ${block.name.replace(/_/g, " ")}…`);
        const result = await executeTool(block.name, block.input, agent.id);
        errorStreak = result?.error ? errorStreak + 1 : 0;
        results.push({ type: "tool_result", tool_use_id: block.id, content: JSON.stringify(result) });
      }
      msgs = [...msgs, { role: "assistant", content: data.content }, { role: "user", content: results }];

      if (errorStreak >= ERROR_STREAK_LIMIT || turns >= cap) {
        msgs = [...msgs.slice(0, -1), {
          ...msgs[msgs.length - 1],
          content: [...msgs[msgs.length - 1].content, { type: "text", text: "[system] Stop calling tools now — summarise honestly what you did, what you couldn't, and any next step." }],
        }];
        const wrap = await callClaude({ model: agent.model, max_tokens: 2048, system, messages: msgs }, authHeaders);
        const text = (wrap.content || []).filter((b) => b.type === "text").map((b) => b.text).join("\n\n").trim();
        return { text: text || "Done.", history: [...msgs, { role: "assistant", content: wrap.content }] };
      }
      continue;
    }

    const text = (data.content || []).filter((b) => b.type === "text").map((b) => b.text).join("\n\n").trim();
    return { text: text || "Done.", history: [...msgs, { role: "assistant", content: data.content }] };
  }
}
