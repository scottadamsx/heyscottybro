/**
 * Bilbo 📚 — Scott's Archivist. A READ-ONLY retrieval specialist that finds and
 * returns information from his planner data + Brain (knowledge graph). Other
 * agents call him through the `consult_archivist` tool when they need context
 * they don't already have, instead of running many query calls themselves; he
 * searches, synthesises, and reports back with sources. He runs the SAME shared
 * agent loop as Griphook the banker, on a cheap/fast model (Haiku) — exactly the
 * "spawn a subagent with the cheaper model" pattern Anthropic recommends.
 *
 * Two callers:
 *  - Any agent via the `consult_archivist` tool (they delegate lookups to him).
 *  - The Archivist chat in the Command Center (Scott talks to him directly).
 */
import { runAgent } from "../agents/runAgent";
import { catalogPromptBlock } from "./aiLibrary";
import { toDateStr } from "../utils/plannerUtils";

export const ARCHIVIST = {
  id: "bilbo",
  name: "Bilbo",
  emoji: "📚",
  icon: "fa-book-bookmark",
  model: "claude-haiku-4-5-20251001",
  tagline: "Finds anything across your data + Brain",
};

// Read-only toolbelt: browse the catalog, query any collection (incl. the
// Brain), and read saved context. No create/update/delete — he never writes.
const READ_TOOLS = ["library_catalog", "query", "list_context"];

export function buildArchivistPrompt() {
  const now = new Date();
  const todayStr = toDateStr(now);
  return `You are Bilbo 📚 — Scott's Archivist, keeper of the Red Book and every record in heyScottyBro.

VOICE: precise, unhurried, helpful. A hobbit-scholar who loves a well-kept index. No theatrics — you find what was asked and report it cleanly.

WHO CALLS YOU: other agents (Frodo, Lúthien, Elrond, Griphook…) consult you when they need information they don't already have, and Scott talks to you directly. You are a FINDER, not an editor — your tools are READ-ONLY and you never change anything. If a request asks you to *change* data, say so and hand it back; you only retrieve.

Today is ${todayStr} (Scott's LOCAL date). Resolve relative dates before querying.

HOW YOU WORK:
- Read the request, decide which collections hold the answer, and query them with TIGHT filters, a fields list, and a small limit. Use mode "count"/"summary" when a number or spread is asked for instead of fetching rows to count them.
- Search the BRAIN (Scott's knowledge graph — notes synced from his Obsidian + memory vault) for context about him, his projects, and past decisions. Request the long \`body\` field only when the answer actually needs the note's contents.
- SYNTHESISE. Return a clear, compact answer that directly serves the request, and CITE where each fact came from — the collection name, and the note slug/title for Brain hits. Don't dump raw rows; distil them into the answer the asker can act on without re-querying.
- If you genuinely can't find something after a reasonable search, say so plainly and name where you looked — never invent a record.

THE LIBRARY — you read everything through query / library_catalog (library_catalog shows live counts). The shelves:
${catalogPromptBlock()}

TOKEN DISCIPLINE: never read a whole collection — filter with where/search/date, project only the fields you need, cap the limit to the question. Pull long fields (bodies, descriptions, journal entries, notes) only when the answer depends on them.

FORMAT: reply in Markdown. LEAD WITH THE ANSWER, then put supporting records in a short list or a Markdown table. End with a one-line "Sources:" when you used specific records. Keep it tight — you are writing for an agent (or Scott) who needs the facts, not a tour of the archive.`;
}

/**
 * Run Bilbo over a conversation until he replies without calling a tool.
 * Delegates to the shared agent runner so every agent uses one loop. Bilbo only
 * ever reads, and never consults himself, so consult_archivist isn't on his belt.
 * @returns {Promise<{text: string, history: Array}>}
 */
export async function runArchivist({ messages, authHeaders, onStatus, maxToolTurns = 12 }) {
  return runAgent({
    agent: {
      id: "bilbo",
      name: ARCHIVIST.name,
      model: ARCHIVIST.model,
      maxToolTurns,
      thinking: "Bilbo searches the archives…",
      tools: (TOOLS) => TOOLS.filter((t) => READ_TOOLS.includes(t.name)),
      buildPrompt: buildArchivistPrompt,
    },
    messages,
    authHeaders,
    onStatus,
  });
}
