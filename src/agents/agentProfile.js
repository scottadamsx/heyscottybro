/**
 * Read-only "what is this agent" helpers for the Command Center profile view.
 * Everything is derived from the registry config + the shared TOOLS belt and
 * the known runAgent() loop, so it always matches how the agent actually runs.
 */
import { TOOLS } from "../api/aiTools";

const MODEL_LABELS = [
  [/haiku/i,  "Haiku 4.5"],
  [/sonnet/i, "Sonnet 4.6"],
  [/opus/i,   "Opus 4.8"],
];

/** Friendly model name (falls back to the raw string, e.g. "Claude Code (Max plan)"). */
export function modelLabel(model) {
  if (!model) return "—";
  for (const [re, label] of MODEL_LABELS) if (re.test(model)) return label;
  return model;
}

/** The agent's actual toolbelt, resolved against the shared TOOLS registry. */
export function resolveTools(agent) {
  if (!agent || agent.kind === "local") return [];
  const list = typeof agent.tools === "function" ? agent.tools(TOOLS) : (agent.tools || []);
  return list.map((t) => ({ name: t.name, description: t.description }));
}

/** How the agent connects — model + transport. */
export function agentConnector(agent) {
  if (agent.kind === "local") {
    return {
      modelLabel: agent.model,
      model: agent.model,
      transport: "Local agent server",
      note: "Runs real Claude Code on your Mac (Max plan), bridged into the Command Center. Needs the local agent server running.",
    };
  }
  return {
    modelLabel: modelLabel(agent.model),
    model: agent.model,
    transport: "Anthropic API · /api/chat",
    note: "Runs on your Anthropic API key through the app's serverless chat proxy.",
  };
}

/** The run protocol — facts true of every API agent via runAgent(), plus per-agent specifics. */
export function agentProtocol(agent) {
  if (agent.kind === "local") {
    return [
      { label: "Run mode", value: "Local Claude Code session" },
      { label: "Tools",    value: "Full file-system & shell (not the app toolbelt)" },
      { label: "Status",   value: "Requires the local agent server" },
    ];
  }
  const facts = [
    { label: "Run mode",      value: "Agentic tool-use loop" },
    { label: "Max tool turns", value: String(agent.maxToolTurns || 16) },
    { label: "Retries",       value: "429/500/503/529 · ×3 backoff" },
    { label: "Safety",        value: "Stops after 3 tool errors in a row, then summarises" },
    { label: "Prompt cache",  value: "Ephemeral system-prompt caching" },
    { label: "Audit",         value: "Write actions logged to agent_actions" },
  ];
  if (agent.schedule) {
    facts.splice(1, 0, { label: "Schedule", value: `Runs ${agent.schedule} (cron) + on demand` });
  }
  return facts;
}
