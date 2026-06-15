/**
 * Galadriel — the Overseer. She looks into the day's work across the whole
 * system (tasks, events, journal, money, projects, agent activity), writes a
 * concise daily summary, and files it into the Brain as a dated node so the
 * knowledge graph grows itself. Runs on demand ("Run now" in the Command
 * Center) and on a daily schedule (api/overseer-run.js via Vercel Cron).
 */
import { runAgent } from "./runAgent";
import {
  loadReminders, loadEvents, loadJournal, loadTransactions, loadProjects, loadInitiatives, loadAgentActions,
} from "../api/plannerApi";
import { toDateStr } from "../utils/plannerUtils";

export const overseerAgent = {
  id: "galadriel",
  name: "Galadriel",
  title: "Overseer",
  emoji: "🪞",
  icon: "fa-eye",
  color: "#a78bfa",
  kind: "api",
  model: "claude-sonnet-4-6",
  tagline: "Watches the whole system · daily summary → Brain",
  schedule: "daily",
  thinking: "Galadriel gazes into the Mirror…",
  maxToolTurns: 12,
  tools: (TOOLS) => TOOLS.filter((t) =>
    ["library_catalog", "query", "create_item", "update_item", "link_brain_nodes", "save_context", "list_context"].includes(t.name)),
  buildPrompt: buildOverseerPrompt,
};

export function buildOverseerPrompt() {
  return `You are Galadriel, the Overseer of heyScottyBro — Lady of the Mirror, who sees what was, what is, and what may yet be. You stand above the other agents and keep Scott's "Brain" (his knowledge graph) alive and well-tended.

VOICE: calm, clear, quietly wise. A touch of the ethereal, never flowery to the point of uselessness. You are precise and honest about what the day held.

YOUR JOB when asked to run the daily summary:
1. You are GIVEN the day's data in the user message — read it; you may also use 'query' to pull more detail on anything notable (token-disciplined: tight filters, small limits).
2. Write a concise **daily summary** in Markdown: what got done, what's still open or overdue, money in/out, anything notable in the journal, and one gentle nudge for tomorrow. Short and skimmable.
3. FILE IT INTO THE BRAIN: call create_item on the "brain" collection with:
   - slug: "daily-YYYY-MM-DD" (today's date — this upserts, so re-running just refreshes it)
   - title: "Daily Summary — YYYY-MM-DD"
   - body: the Markdown summary
   - type: "checkpoints"
   - tags: ["daily","summary", the YYYY-MM month]
   - source: "galadriel"
4. LINK what it touched: if the day clearly relates to existing brain notes/projects, call link_brain_nodes (source_slug = the daily node, target_slug = the related node) so the graph connects. Query the brain first to find real slugs; don't invent them.
5. If you learned a durable fact about Scott or Maria, call save_context (list_context first to avoid duplicates).

Be efficient — a handful of tool calls, not dozens. When done, reply with the summary you filed so it can be shown in the Command Center.`;
}

const fmtMoney = (n) => `$${Math.abs(Number(n || 0)).toFixed(2)}`;

/** Gather a compact snapshot of the day for the Overseer to summarise. */
export async function gatherDay() {
  const today = toDateStr(new Date());
  const [reminders, events, journal, txns, projects, initiatives, actions] = await Promise.all([
    loadReminders().catch(() => []),
    loadEvents().catch(() => []),
    loadJournal().catch(() => []),
    loadTransactions().catch(() => []),
    loadProjects().catch(() => []),
    loadInitiatives().catch(() => []),
    loadAgentActions(40).catch(() => []),
  ]);

  const completedToday = reminders.filter((r) => r.completed && r.completed_date === today);
  const overdue = reminders.filter((r) => !r.completed && r.date && r.date < today);
  const dueToday = reminders.filter((r) => !r.completed && r.date === today);
  const eventsToday = events.filter((e) => e.date === today);
  const journalToday = journal.filter((j) => j.date === today);
  const txToday = txns.filter((t) => t.date === today);
  const spent = txToday.filter((t) => Number(t.amount) < 0).reduce((s, t) => s + Math.abs(Number(t.amount)), 0);
  const earned = txToday.filter((t) => Number(t.amount) > 0).reduce((s, t) => s + Number(t.amount), 0);
  const actionsToday = actions.filter((a) => String(a.created_at).slice(0, 10) === today);

  const lines = [];
  lines.push(`# Day snapshot — ${today}`);
  lines.push(`Completed today (${completedToday.length}): ${completedToday.map((r) => r.name).join("; ") || "—"}`);
  lines.push(`Due today still open (${dueToday.length}): ${dueToday.map((r) => r.name).join("; ") || "—"}`);
  lines.push(`Overdue (${overdue.length}): ${overdue.slice(0, 10).map((r) => `${r.name} (${r.date})`).join("; ") || "—"}`);
  lines.push(`Events today (${eventsToday.length}): ${eventsToday.map((e) => e.title).join("; ") || "—"}`);
  lines.push(`Money today: spent ${fmtMoney(spent)}, in ${fmtMoney(earned)} — ${txToday.map((t) => `${t.category || t.description || "tx"} ${fmtMoney(t.amount)}`).join("; ") || "no transactions"}`);
  lines.push(`Journal today: ${journalToday.map((j) => `${j.title || "entry"}${j.mood ? ` (${j.mood})` : ""}: ${(j.entry || "").slice(0, 200)}`).join(" / ") || "—"}`);
  lines.push(`Active projects (${projects.length}): ${projects.map((p) => p.name).join(", ") || "—"}`);
  lines.push(`Recurring initiatives: ${initiatives.filter((i) => i.active !== false).map((i) => `${i.name} (${i.recurrence})`).join(", ") || "—"}`);
  lines.push(`Agent actions today (${actionsToday.length}): ${actionsToday.map((a) => `${a.tier}:${a.tool}`).slice(0, 20).join(", ") || "—"}`);
  return { today, text: lines.join("\n") };
}

/** Run the daily summary client-side (the Command Center "Run now" button). */
export async function runOverseer({ authHeaders, onStatus }) {
  onStatus?.("Galadriel gathers the day…");
  const { today, text } = await gatherDay();
  const messages = [{
    role: "user",
    content: `Run the daily summary for ${today}. File it into the Brain and connect it where it fits.\n\n${text}`,
  }];
  return runAgent({ agent: overseerAgent, messages, authHeaders, onStatus });
}
