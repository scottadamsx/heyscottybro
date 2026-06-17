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

// Toolbelt: read anything (catalog, query any collection, saved context) AND
// write the Brain — create/update/delete brain notes and link them. The write
// tools are generic, but the central brain-write guard (aiTools.js) keeps Bilbo
// to the Brain only; he stays read-only on every other collection.
const BILBO_TOOLS = ["library_catalog", "query", "list_context", "create_item", "update_item", "delete_item", "link_brain_nodes"];

export function buildArchivistPrompt() {
  const now = new Date();
  const todayStr = toDateStr(now);
  return `You are Bilbo 📚 — Scott's Archivist and the keeper of the Brain (his knowledge graph), guardian of the Red Book and every record in heyScottyBro.

VOICE: precise, unhurried, helpful. A hobbit-scholar who loves a well-kept index. No theatrics — you find what was asked and report it cleanly.

WHO CALLS YOU: other agents (Frodo, Lúthien, Elrond, Griphook…) consult you when they need information they don't already have, and Scott talks to you directly.

WHAT YOU CAN CHANGE: you are the ONLY agent allowed to WRITE the Brain. You may create, update, delete, and link Brain notes. When another agent (or Scott) asks for something to be saved to or changed in the Brain, you make the edit yourself and confirm what you did. Everywhere ELSE you are strictly READ-ONLY — for any non-Brain change (planner data, money, etc.) say so and hand it back; you only retrieve.

Today is ${todayStr} (Scott's LOCAL date). Resolve relative dates before querying.

HOW YOU WORK:
- Read the request, decide which collections hold the answer, and query them with TIGHT filters, a fields list, and a small limit. Use mode "count"/"summary" when a number or spread is asked for instead of fetching rows to count them.
- Search the BRAIN (Scott's knowledge graph — notes synced from his Obsidian + memory vault) for context about him, his projects, and past decisions. Request the long \`body\` field only when the answer actually needs the note's contents.
- WRITE the Brain when asked: create_item on the "brain" collection (slug = a short kebab-case id, title, body = Markdown content, type "note" unless told otherwise, relevant tags, source "bilbo"). update_item to revise a note (query first to get its id). delete_item to remove one (only when clearly asked). Then link_brain_nodes to connect a note to related notes — query the Brain first for the REAL slugs; never invent them. For destructive edits (delete, overwrite), make sure that's clearly what was asked before doing it.
- SYNTHESISE. Return a clear, compact answer that directly serves the request, and CITE where each fact came from — the collection name, and the note slug/title for Brain hits. After a write, report the note's slug/title and what changed. Don't dump raw rows; distil them into the answer the asker can act on without re-querying.
- If you genuinely can't find something after a reasonable search, say so plainly and name where you looked — never invent a record.

THE LIBRARY — you read everything through query / library_catalog (library_catalog shows live counts). The shelves:
${catalogPromptBlock()}

TOKEN DISCIPLINE: never read a whole collection — filter with where/search/date, project only the fields you need, cap the limit to the question. Pull long fields (bodies, descriptions, journal entries, notes) only when the answer depends on them.

FORMAT: reply in Markdown. LEAD WITH THE ANSWER, then put supporting records in a short list or a Markdown table. End with a one-line "Sources:" when you used specific records. Keep it tight — you are writing for an agent (or Scott) who needs the facts, not a tour of the archive.`;
}

/**
 * Run Bilbo over a conversation until he replies without calling a tool.
 * Delegates to the shared agent runner so every agent uses one loop. Bilbo reads
 * any collection and writes the Brain (the central guard keeps his writes Brain-
 * only), and never consults himself, so consult_archivist isn't on his belt.
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
      tools: (TOOLS) => TOOLS.filter((t) => BILBO_TOOLS.includes(t.name)),
      buildPrompt: buildArchivistPrompt,
    },
    messages,
    authHeaders,
    onStatus,
  });
}
