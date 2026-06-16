/**
 * The agent roster. Each entry is a self-contained "agent" — its own name +
 * title, model (connector), toolbelt, and system prompt (logic). API agents run
 * through runAgent() over the /api/chat proxy; the local coding agent (Aulë)
 * runs in the on-Mac agent-server and is bridged into the Command Center.
 *
 * Everything here is just config, so adding/renaming an agent is a one-object
 * change.
 */
import { TIERS, buildSystemPrompt } from "../api/aiTiers";
import { BANKER, buildBankerPrompt } from "../api/banker";
import { ARCHIVIST, buildArchivistPrompt } from "../api/archivist";
import { overseerAgent } from "./overseer";

// Toolbelt helper: keep only the named tools from the shared TOOLS registry.
const only = (...names) => (TOOLS) => TOOLS.filter((t) => names.includes(t.name));

// ── Research agent (Elrond) ──────────────────────────────────────────────────
function buildResearchPrompt() {
  return `You are Elrond, Scott's Research Agent — master of lore in heyScottyBro, keeper of the Brain (his knowledge graph).

VOICE: measured, scholarly, plain-spoken. You cite what you found and where.

WHAT YOU DO:
- RESEARCH from the live web with the web_fetch tool — read the pages Scott names or that answer his question, and synthesise (don't just dump text).
- FILE findings into the Brain: call create_item on the "brain" collection (slug = a short kebab-case topic id, title, body = your synthesis in Markdown with source URLs, type "note", tags, source "elrond"). Then connect it: link_brain_nodes from the new note to related existing notes (query the brain first to find real slugs — never invent them).
- ANSWER from the Brain: when Scott asks what he already knows, query the "brain" collection (and others) before reaching for the web.
- TEND the graph: when asked, find near-duplicate notes and propose merges, and add missing links/tags — but make destructive changes only after Scott agrees.

Be token-disciplined: tight query filters, small limits, request long fields only when needed. Reply in Markdown.`;
}

// ── Marketing agent (Lúthien) ────────────────────────────────────────────────
function buildMarketingPrompt() {
  return `You are Lúthien, Scott's Marketing Agent — the enchanter whose words move an audience, working inside heyScottyBro.

VOICE: vivid, persuasive, on-brand. Punchy when it's a post, considered when it's a strategy.

WHAT YOU DO:
- KNOW the products before you write: query the "brain", "projects" and related collections for context on Scott's ventures (NEVER86 — restaurant platform for independents; St. John's Hike Club — community; heyScottyBro — his portfolio). Don't make up facts about them.
- RESEARCH the market with web_fetch — competitors, trends, references Scott shares — and fold real findings into your copy/strategy.
- PRODUCE marketing work: social posts, landing copy, email/launch announcements, positioning, content calendars. Offer a couple of distinct options when it helps.
- SAVE the good stuff into the Brain: create_item on "brain" (type "note", tags include "marketing", source "luthien") so campaigns and angles are remembered, and link_brain_nodes to the product they belong to.

Be concrete and ready-to-use. Reply in Markdown; use short sections and bullet lists.`;
}

export const AGENTS = [
  overseerAgent,
  {
    id: "elrond", name: "Elrond", title: "Research Agent", emoji: "📜", icon: "fa-book-open",
    color: "#22d3ee", kind: "api", model: "claude-sonnet-4-6", maxToolTurns: 16,
    tagline: "Researches the web → files into the Brain",
    thinking: "Elrond consults the archives…",
    tools: only("library_catalog", "query", "web_fetch", "create_item", "update_item", "link_brain_nodes", "save_context", "list_context"),
    buildPrompt: buildResearchPrompt,
  },
  {
    id: ARCHIVIST.id, name: ARCHIVIST.name, title: "Archivist", emoji: ARCHIVIST.emoji, icon: ARCHIVIST.icon,
    color: "#94a3b8", kind: "api", model: ARCHIVIST.model, maxToolTurns: 12,
    tagline: "Finds anything across your data + Brain — the other agents' lookup service",
    thinking: "Bilbo searches the archives…",
    tools: only("library_catalog", "query", "list_context"),
    buildPrompt: buildArchivistPrompt,
  },
  {
    id: "luthien", name: "Lúthien", title: "Marketing Agent", emoji: "✨", icon: "fa-bullhorn",
    color: "#ec4899", kind: "api", model: "claude-sonnet-4-6", maxToolTurns: 14,
    tagline: "Copy, campaigns & positioning for your products",
    thinking: "Lúthien weaves the words…",
    tools: only("library_catalog", "query", "web_fetch", "create_item", "link_brain_nodes", "save_context", "list_context", "consult_archivist"),
    buildPrompt: buildMarketingPrompt,
  },
  {
    id: "aule", name: "Aulë", title: "Coding Agent", emoji: "🔨", icon: "fa-hammer",
    color: "#f59e0b", kind: "local", model: "Claude Code (Max plan)",
    tagline: "Real Claude Code in your terminal — needs the agent server",
  },
  {
    id: "frodo", name: "Frodo", title: "Personal Assistant", emoji: "💍", icon: "fa-ring",
    color: "#4ade80", kind: "api", model: TIERS[0].model, maxToolTurns: TIERS[0].maxToolTurns,
    tagline: "Your everyday planner assistant",
    thinking: "Frodo is on it…",
    tools: (TOOLS) => TOOLS,
    buildPrompt: () => buildSystemPrompt(TIERS[0]),
  },
  {
    id: "banker", name: BANKER.name, title: "Finance Agent", emoji: BANKER.emoji, icon: BANKER.icon,
    color: "#fbbf24", kind: "api", model: BANKER.model, maxToolTurns: 16,
    tagline: BANKER.tagline,
    thinking: "Griphook is counting the gold…",
    tools: (TOOLS) => TOOLS.filter((t) => t.name !== "consult_banker"),
    buildPrompt: buildBankerPrompt,
  },
];

export const getAgent = (id) => AGENTS.find((a) => a.id === id) || null;
export const API_AGENTS = AGENTS.filter((a) => a.kind === "api");
