/**
 * Generalized agent runner — the heart of every API agent in the Command
 * Center. It's the same tool loop Banker the banker has always used
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
import {
  callClaude,
  executeToolBatchWithCheckpoints,
  trimHistory,
  withCacheMarkers,
  ERROR_STREAK_LIMIT,
} from "./loop";
import { captureEstablishedOwnerId } from "../utils/authIdentityBoundary";
import { withCheckpointProgress } from "../api/pendingScreenshots";

export { callClaude } from "./loop";

// Same budget Frodo's chat uses (useAIAgent) — one policy for every agent.
export const HISTORY_CHAR_BUDGET = 100000;

/**
 * Run an agent over a conversation until it replies without calling a tool.
 *
 * `onCommit(history, checkpoint)` is required whenever tools run. It fires
 * before each individual tool with a balanced, restart-safe write-ahead record,
 * then again after its result before the next action can begin. This preserves
 * causal history without leaving orphaned tool blocks after an interruption.
 * `buildPrompt` may be async (agents that load live context first).
 * @returns {Promise<{text: string, history: Array}>}
 */
export async function runAgent({ agent, messages, authHeaders, ownerId, resolveAuthHeaders, onStatus, onCommit, maxToolTurns }) {
  const cap = maxToolTurns || agent.maxToolTurns || 16;
  const system = [{ type: "text", text: await agent.buildPrompt(), cache_control: { type: "ephemeral" } }];
  const tools = typeof agent.tools === "function" ? agent.tools(TOOLS) : (agent.tools || TOOLS);
  let msgs = trimHistory([...messages], HISTORY_CHAR_BUDGET);
  let turns = 0;
  let errorStreak = 0;
  // Tool-local state is scoped to this run; concurrent agents never share it.
  const toolContext = { pendingScreenshots: [], ownerId: ownerId || captureEstablishedOwnerId() };

  for (;;) {
    onStatus?.(agent.thinking || `${agent.name} is working…`);
    const data = await callClaude(
      { model: agent.model, max_tokens: 4096, system, tools, messages: withCacheMarkers(msgs) },
      authHeaders,
      { resolveHeaders: resolveAuthHeaders ? () => resolveAuthHeaders(toolContext.ownerId) : undefined },
    );
    const toolBlocks = (data.content || []).filter((b) => b.type === "tool_use");

    if (toolBlocks.length > 0) {
      turns++;
      const batch = await executeToolBatchWithCheckpoints({
        baseHistory: msgs,
        assistantContent: data.content,
        toolBlocks,
        checkpoint: onCommit,
        phaseLabel: `${agent.name} tool work`,
        execute: async (block, checkpointProgress) => {
          onStatus?.(`${agent.name}: ${block.name.replace(/_/g, " ")}…`);
          const result = await executeTool(
            block.name,
            block.input,
            agent.id,
            withCheckpointProgress(toolContext, checkpointProgress),
          );
          errorStreak = result?.error ? errorStreak + 1 : 0;
          return result;
        },
      });
      msgs = batch.history;

      if (errorStreak >= ERROR_STREAK_LIMIT || turns >= cap) {
        msgs = [...msgs.slice(0, -1), {
          ...msgs[msgs.length - 1],
          content: [...msgs[msgs.length - 1].content, { type: "text", text: "[system] Stop calling tools now — summarise honestly what you did, what you couldn't, and any next step." }],
        }];
        const wrap = await callClaude(
          { model: agent.model, max_tokens: 2048, system, messages: withCacheMarkers(msgs) },
          authHeaders,
          { resolveHeaders: resolveAuthHeaders ? () => resolveAuthHeaders(toolContext.ownerId) : undefined },
        );
        const text = (wrap.content || []).filter((b) => b.type === "text").map((b) => b.text).join("\n\n").trim();
        return { text: text || "Done.", history: [...msgs, { role: "assistant", content: wrap.content }] };
      }
      continue;
    }

    const text = (data.content || []).filter((b) => b.type === "text").map((b) => b.text).join("\n\n").trim();
    return { text: text || "Done.", history: [...msgs, { role: "assistant", content: data.content }] };
  }
}
