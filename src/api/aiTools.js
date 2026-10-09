/**
 * Agent tool belt — shared by every tier (Frodo/Sam/Gandalf).
 *
 * Data access goes through the generic library tools (see aiLibrary.js) so the
 * agent can touch every collection with four schemas instead of thirty — far
 * fewer prompt tokens, and validation is centralised in one place. Only
 * genuinely special flows (habits, context memory, balance, bulk hiker
 * wipe) keep bespoke tools. The pass_to_* escalation tools are appended per
 * tier by useAIAgent, not listed here.
 */
import {
  COLLECTION_NAMES,
  libraryCatalog, libraryQuery, libraryGlobalSearch, libraryCreate, libraryUpdate, libraryDelete,
} from "./aiLibrary";
import { loadContext, addContextEntry, deleteContextEntry, replaceContext } from "./contextApi";
import { linkNodes as linkBrainNodes } from "./brainApi";
import { completeReminder, loadBudgetConfig, saveBudgetConfig } from "./plannerApi";
import { clearAllMembers } from "./hikerApi";
import { loadAccountability, logHabitDone, unlogHabitDone, logHabitMissed, unlogHabitMissed } from "./accountabilityApi";
import { toDateStr } from "../utils/dates";
import { loadProfile as loadHealthProfile, addFood, saveWeight as saveHealthWeight, MEALS } from "./healthApi";
import { supabase, getAuthHeaders } from "../utils/supabase";
import { lazyImport } from "../lib/lazyImport";
import { uid } from "./_base";
import { captureEstablishedOwnerId, runOwnerBoundOperation } from "../utils/authIdentityBoundary";

// ── Brain write policy ───────────────────────────────────────────────────────
// The Brain is single-writer by design: Bilbo (the Archivist) is its keeper and
// editor. The general assistant tiers (Frodo/Sam/Gandalf) and any other caller
// read the Brain but must hand changes to Bilbo via consult_archivist. The
// dedicated authoring specialists (Elrond research, Lúthien marketing) keep
// filing their own findings. Bilbo, in turn, only writes the Brain — he stays
// read-only on every other collection.
const BRAIN_WRITE_TOOLS = new Set(["create_item", "update_item", "delete_item"]);
const BRAIN_WRITERS = new Set(["bilbo", "elrond", "luthien", "galadriel"]);

function brainWriteDenial(name, input, caller) {
  const targetsBrain = input?.collection === "brain";
  const isBrainWrite = name === "link_brain_nodes" || (BRAIN_WRITE_TOOLS.has(name) && targetsBrain);

  // Only the Brain's authors may change it; everyone else asks Bilbo.
  if (isBrainWrite && !BRAIN_WRITERS.has(caller)) {
    return { error: "The Brain is write-protected — only Bilbo edits it. Use the consult_archivist tool and tell Bilbo exactly what to create, update, delete, or link in the Brain, and he'll do it." };
  }
  // Bilbo is a Brain-only editor: read-only everywhere else.
  if (caller === "bilbo" && BRAIN_WRITE_TOOLS.has(name) && !targetsBrain) {
    return { error: `Bilbo only writes to the Brain — the "${input?.collection || "that"}" collection is read-only for him.` };
  }
  return null;
}


async function logAction({ agentId, tool, input, result, ownerId }) {
  try {
    const userId = await uid(ownerId);
    const status = result?.error ? "error" : "ok";
    const itemId = result?.id || input?.id || null;
    const collection = input?.collection || null;
    await supabase.from("agent_actions").insert({
      user_id: userId,
      agent_id: agentId,
      tool,
      collection,
      item_id: itemId ? String(itemId) : null,
      args: input || {},
      status,
      error: result?.error || null,
    });
  } catch { /* never let logging break tool execution */ }
}

export const TOOLS = [
  {
    name: "library_catalog",
    description: "The card catalog: every collection with its fields and allowed operations. Pass include_counts only when you actually need sizes (it loads every collection).",
    input_schema: {
      type: "object",
      properties: { include_counts: { type: "boolean" } },
    },
  },
  {
    name: "query",
    description: "Read from a collection — filtered, field-projected, row-capped. Returns ids needed for update/delete. Prefer tight filters + small limits; use mode count/summary instead of fetching rows to count them.",
    input_schema: {
      type: "object",
      properties: {
        collection: { type: "string", enum: COLLECTION_NAMES },
        fields: { type: "array", items: { type: "string" }, description: "Columns to return (id always included). Omit for a sensible compact default." },
        where: { type: "object", description: "Filters: exact values, or allow-listed operators such as {\"amount\":{\"gte\":100}}, {\"date\":{\"lt\":\"2026-10-10\"}}, {\"tags\":{\"contains\":\"school\"}}, {\"id\":{\"in\":[\"...\"]}}, plus one or:[{...},{...}] group." },
        search: { type: "string", description: "Case-insensitive substring search across the collection's text fields" },
        date_from: { type: "string", description: "YYYY-MM-DD inclusive lower bound on the collection's date" },
        date_to: { type: "string", description: "YYYY-MM-DD inclusive upper bound" },
        order_by: { type: "string" },
        direction: { type: "string", enum: ["asc", "desc"] },
        limit: { type: "number", description: "Max rows (default 25, cap 100)" },
        offset: { type: "number", description: "For paging — response includes next_offset when more rows exist" },
        mode: { type: "string", enum: ["rows", "count", "summary"], description: "count = just the number; summary = count + date range + 5 sample rows" },
        expand_occurrences: { type: "boolean", description: "For reminders/events only. Requires date_from and date_to; returns generated view-only occurrences in that inclusive range with source metadata." },
      },
      required: ["collection"],
    },
  },
  {
    name: "global_search",
    description: "Read-only parallel search across Scott's safe planner and Brain collections. Returns compact, ranked, source-labelled matches. Vault snippets and the agent audit trail are excluded so a broad search cannot expose secrets; use query on an explicitly appropriate collection when needed.",
    input_schema: {
      type: "object",
      properties: {
        query: { type: "string", description: "What to find, e.g. a person, project, place, or topic." },
        collections: { type: "array", items: { type: "string", enum: COLLECTION_NAMES }, description: "Optional safe collection subset to make the search cheaper." },
        limit: { type: "number", description: "Maximum ranked matches; default 20, cap 100." },
      },
      required: ["query"],
    },
  },
  {
    name: "create_item",
    description: "Create a record in a collection. data is validated against the collection's fields (see the catalog in your instructions).",
    input_schema: {
      type: "object",
      properties: {
        collection: { type: "string", enum: COLLECTION_NAMES },
        data: { type: "object", description: "Field values for the new record" },
      },
      required: ["collection", "data"],
    },
  },
  {
    name: "update_item",
    description: "Edit any record — pass only the fields to change. Get the id from query first.",
    input_schema: {
      type: "object",
      properties: {
        collection: { type: "string", enum: COLLECTION_NAMES },
        id: { type: "string" },
        data: { type: "object", description: "Only the fields being changed" },
      },
      required: ["collection", "id", "data"],
    },
  },
  {
    name: "delete_item",
    description: "Delete a record by id. Cascading deletes (projects) require confirm: true after Scott agrees.",
    input_schema: {
      type: "object",
      properties: {
        collection: { type: "string", enum: COLLECTION_NAMES },
        id: { type: "string" },
        confirm: { type: "boolean" },
      },
      required: ["collection", "id"],
    },
  },
  { name: "complete_reminder", description: "Mark a reminder/task complete (shortcut for update_item with completed: true)", input_schema: { type: "object", properties: { id: { type: "string" } }, required: ["id"] } },
  { name: "log_habit", description: "Log a habit tracker (Life › Habits) as done for a day. Get the tracker id from query on the 'habits' collection. Checkbox trackers toggle (logging twice un-logs); count trackers add one tally. Also mirrors into that day's Work log automatically — don't create a separate work_log entry for the same habit. Pass missed: true when Scott says a habit WON'T get done that day (\"skip the gym today\"): it's crossed out, doesn't count as done, and moves the habit's next due date on; missed: false undoes that.", input_schema: { type: "object", properties: { tracker_id: { type: "string" }, date: { type: "string", description: "YYYY-MM-DD, defaults to today" }, missed: { type: "boolean", description: "true = mark 'Missed it' for the day; false = undo a miss. Omit to log it done." } }, required: ["tracker_id"] } },
  { name: "set_balance", description: "Set Scott's current bank balance", input_schema: { type: "object", properties: { balance: { type: "number" } }, required: ["balance"] } },
  { name: "set_category_budget", description: "Set or clear a monthly spending budget for a variable expense category (Groceries, Gas, Toiletries…). Pass amount 0 to remove the budget.", input_schema: { type: "object", properties: { category: { type: "string" }, amount: { type: "number" } }, required: ["category", "amount"] } },
  { name: "consult_banker", description: "Hand any budget/money task to Griphook, Scott's specialist Gringotts banker — logging transactions, editing recurring bills or income, setting category budgets or balance, or any multi-step ledger change. Griphook makes the edits and reports back. Use this instead of editing money data yourself.", input_schema: { type: "object", properties: { request: { type: "string", description: "The full budget task, with any specifics Scott gave (amounts, dates, categories)." } }, required: ["request"] } },
  { name: "consult_archivist", description: "Ask Bilbo, Scott's Archivist and keeper of the Brain. Two jobs: (1) FIND information across Scott's planner data and Brain (knowledge graph) and report it back with sources — call this when gathering context would take you several queries (e.g. \"what do we know about NEVER86?\", \"pull everything relevant to this week's hikes\"); and (2) WRITE to the Brain on your behalf — Bilbo is the ONLY agent allowed to create, update, delete, or link Brain notes, so when something should be saved to or changed in the Brain, ask him and he'll do it. For non-Brain data changes use the write tools yourself; for money use consult_banker.", input_schema: { type: "object", properties: { request: { type: "string", description: "The full request — what to find, or exactly what to create/update/delete/link in the Brain, with specifics." } }, required: ["request"] } },
  {
    name: "log_food",
    description: "Log something Scott ate to Health › Food. Estimate calories and macros from typical portions when he doesn't give them.",
    input_schema: {
      type: "object",
      properties: {
        name: { type: "string" },
        calories: { type: "number" },
        protein_g: { type: "number" },
        carbs_g: { type: "number" },
        fat_g: { type: "number" },
        meal_type: { type: "string", enum: ["breakfast", "lunch", "dinner", "snack"] },
        date: { type: "string", description: "YYYY-MM-DD, defaults to today" },
      },
      required: ["name", "calories"],
    },
  },
  {
    name: "log_weight",
    description: "Record a weigh-in in Health › Body. Scott talks in pounds. One per day — logging the same date replaces it.",
    input_schema: {
      type: "object",
      properties: { weight_lb: { type: "number" }, date: { type: "string", description: "YYYY-MM-DD, defaults to today" }, note: { type: "string" } },
      required: ["weight_lb"],
    },
  },
  { name: "clear_all_hikers", description: "Delete ALL hikers. Only after explicit confirmation.", input_schema: { type: "object", properties: { confirmed: { type: "boolean" } }, required: ["confirmed"] } },
  { name: "web_fetch", description: "Fetch a web page or API URL and return its title + readable text (truncated). Use when Scott shares a link, asks you to read/check a page, or look something current up by URL.", input_schema: { type: "object", properties: { url: { type: "string", description: "Full http(s) URL" } }, required: ["url"] } },
  { name: "link_brain_nodes", description: "Connect two existing Brain notes in the knowledge graph (directed link source → target). Use real slugs from a brain query — don't invent them. Idempotent.", input_schema: { type: "object", properties: { source_slug: { type: "string" }, target_slug: { type: "string" } }, required: ["source_slug", "target_slug"] } },
  { name: "list_context", description: "Read all saved context facts about Scott. Call this before saving to avoid duplicates.", input_schema: { type: "object", properties: {} } },
  {
    name: "save_context",
    description: "Save a fact to the persistent context store. Call automatically whenever you learn something worth remembering about Scott.",
    input_schema: {
      type: "object",
      properties: {
        text: { type: "string", description: "The cleaned-up fact to store (one sentence, first-person removed)" },
        tags: { type: "array", items: { type: "string" }, description: "Relevant tags e.g. ['Scott','Health']" },
        why: { type: "string", description: "Brief reason why this is worth keeping" },
      },
      required: ["text"],
    },
  },
  { name: "delete_context", description: "Delete a context entry by id (get ids from list_context)", input_schema: { type: "object", properties: { id: { type: "string" } }, required: ["id"] } },
  {
    name: "reorganize_context",
    description: "Replace the entire context store with a cleaned/deduplicated version. ONLY call this AFTER presenting the proposed changes to Scott and receiving explicit confirmation.",
    input_schema: {
      type: "object",
      properties: {
        entries: {
          type: "array",
          description: "The new context array. Each item must have text, tags[], by, why.",
          items: { type: "object", properties: { text: { type: "string" }, tags: { type: "array", items: { type: "string" } }, by: { type: "string" }, why: { type: "string" } }, required: ["text"] },
        },
        confirmed: { type: "boolean", description: "Must be true — confirms Scott approved the reorganisation" },
      },
      required: ["entries", "confirmed"],
    },
  },
];

async function runTool(name, input, toolContext) {
  switch (name) {
    case "library_catalog": return await libraryCatalog(input || {});
    case "query": return await libraryQuery(input);
    case "global_search": return await libraryGlobalSearch(input);
    case "create_item": return await libraryCreate(input);
    case "update_item": return await libraryUpdate(input);
    case "delete_item": return await libraryDelete(input);
    case "complete_reminder": await completeReminder(input.id); return { success: true };
    case "log_habit": {
      const state = await loadAccountability();
      const tracker = state.trackers.find((t) => t.id === input.tracker_id);
      if (!tracker) return { error: `no habit tracker with id ${input.tracker_id} — query the habits collection for the id` };
      const date = input.date || toDateStr();
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return { error: "date must be YYYY-MM-DD" };
      if (input.missed === true || input.missed === false) {
        await (input.missed ? logHabitMissed(tracker, date) : unlogHabitMissed(tracker, date));
        return { success: true, action: input.missed ? "marked missed" : "un-missed", tracker: tracker.name, date };
      }
      const already = state.logs.some((l) => l.trackerId === tracker.id && l.date === date);
      const willUnlog = tracker.mode === "check" && already;
      const next = willUnlog ? await unlogHabitDone(tracker, date) : await logHabitDone(tracker, date);
      return {
        success: true, action: willUnlog ? "un-logged" : "logged", tracker: tracker.name, date,
        count_that_day: next.logs.filter((l) => l.trackerId === tracker.id && l.date === date).length,
        note: willUnlog ? undefined : "Also mirrored into today's Work log.",
      };
    }
    case "set_balance": { const cfg = await loadBudgetConfig(); await saveBudgetConfig({ ...cfg, startingBalance: input.balance }); return { success: true }; }
    case "set_category_budget": {
      const cfg = await loadBudgetConfig();
      const next = { ...(cfg.categoryBudgets || {}) };
      if (!input.amount || input.amount <= 0) delete next[input.category];
      else next[input.category] = input.amount;
      await saveBudgetConfig({ ...cfg, categoryBudgets: next });
      return { success: true, category: input.category, amount: input.amount || 0 };
    }
    case "consult_banker": {
      // Lazy import to avoid a static cycle (banker.js imports this module).
      // lazyImport survives a stale-deploy chunk miss — see lib/lazyImport.js.
      const { runBanker } = await lazyImport(() => import("./banker.js"), "the banker (Griphook)");
      const authHeaders = await getAuthHeaders(toolContext?.ownerId);
      const { text } = await runBanker({
        messages: [{ role: "user", content: String(input.request || "") }],
        authHeaders,
        ownerId: toolContext?.ownerId,
        resolveAuthHeaders: getAuthHeaders,
        onCommit: async (history, checkpoint) => {
          await toolContext?.checkpointProgress?.({
            consultant: "Griphook",
            status: "in_progress",
            phase: checkpoint?.phase || "durable nested tool checkpoint",
            history,
            warning: "Some ledger work may already be complete. Inspect it before retrying this consultation.",
          });
        },
      });
      return { banker: "Griphook", reply: text };
    }
    case "consult_archivist": {
      // Lazy import to avoid a static cycle (archivist.js → runAgent → aiTools).
      // lazyImport survives a stale-deploy chunk miss — see lib/lazyImport.js.
      const { runArchivist } = await lazyImport(() => import("./archivist.js"), "the archivist (Bilbo)");
      const authHeaders = await getAuthHeaders(toolContext?.ownerId);
      const { text } = await runArchivist({
        messages: [{ role: "user", content: String(input.request || "") }],
        authHeaders,
        ownerId: toolContext?.ownerId,
        resolveAuthHeaders: getAuthHeaders,
        onCommit: async (history, checkpoint) => {
          await toolContext?.checkpointProgress?.({
            consultant: "Bilbo",
            status: "in_progress",
            phase: checkpoint?.phase || "durable nested tool checkpoint",
            history,
            warning: "Some archive work may already be complete. Inspect it before retrying this consultation.",
          });
        },
      });
      return { archivist: "Bilbo", reply: text };
    }
    case "log_food": {
      const date = input.date || toDateStr();
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return { error: "date must be YYYY-MM-DD" };
      const profile = await loadHealthProfile();
      const meal = MEALS.includes(input.meal_type) ? input.meal_type : "snack";
      await addFood(profile.id, { name: input.name, calories: input.calories, protein_g: input.protein_g || 0, carbs_g: input.carbs_g || 0, fat_g: input.fat_g || 0, meal_type: meal, date, source: "ai" });
      return { success: true, logged: { name: input.name, calories: Math.round(input.calories), meal_type: meal, date } };
    }
    case "log_weight": {
      const date = input.date || toDateStr();
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return { error: "date must be YYYY-MM-DD" };
      const profile = await loadHealthProfile();
      await saveHealthWeight(profile.id, { date, weightLb: Number(input.weight_lb), note: input.note || "" });
      return { success: true, logged: { weight_lb: Number(input.weight_lb), date } };
    }
    case "clear_all_hikers": if (!input.confirmed) return { error: "confirmed must be true" }; await clearAllMembers(); return { success: true };
    case "web_fetch": {
      const headers = await getAuthHeaders(toolContext?.ownerId);
      const res = await fetch("/api/fetch", { method: "POST", headers: { "Content-Type": "application/json", ...headers }, body: JSON.stringify({ url: input.url }) });
      const data = await res.json();
      if (!res.ok) return { error: data.error || "fetch failed" };
      return data;
    }
    case "link_brain_nodes": { await linkBrainNodes(input.source_slug, input.target_slug); return { success: true, source_slug: input.source_slug, target_slug: input.target_slug }; }
    case "list_context": { const items = await loadContext(); return { items: items.map((c) => ({ id: c.id, text: c.text, tags: c.tags, by: c.by, why: c.why, ts: c.ts })) }; }
    case "save_context": { const entry = await addContextEntry({ text: input.text, tags: input.tags || [], by: "frodo", why: input.why || "noted by Frodo" }); return { success: true, id: entry.id }; }
    case "delete_context": await deleteContextEntry(input.id); return { success: true };
    case "reorganize_context": {
      if (!input.confirmed) return { error: "confirmed must be true — present the plan to Scott first and wait for a yes" };
      const rows = await replaceContext(input.entries || []);
      return { success: true, count: rows.length };
    }
    default: return { error: `Unknown tool: ${name}` };
  }
}

export async function executeTool(name, input, agentId = "frodo", toolContext = { pendingScreenshots: [] }) {
  const ownerId = toolContext?.ownerId || captureEstablishedOwnerId();
  const denied = brainWriteDenial(name, input, agentId);
  if (denied) { logAction({ agentId, tool: name, input, result: denied, ownerId }); return denied; }
  let result;
  try {
    result = await runOwnerBoundOperation(ownerId, uid, () => runTool(name, input, toolContext));
  } catch (err) {
    // A failed durable checkpoint is a control-plane stop, not a tool result.
    // Let it abort the parent and nested loops before any later side effect.
    if (err?.code === "DURABLE_CHECKPOINT_FAILED") throw err;
    result = { error: err.message };
  }
  // Skip logging for read-only / high-frequency tools to avoid noise
  const skipLog = ["library_catalog", "query", "global_search", "list_context"].includes(name);
  if (!skipLog) logAction({ agentId, tool: name, input, result, ownerId });
  return result;
}
