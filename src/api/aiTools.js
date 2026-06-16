/**
 * Agent tool belt — shared by every tier (Frodo/Sam/Gandalf).
 *
 * Data access goes through the generic library tools (see aiLibrary.js) so the
 * agent can touch every collection with four schemas instead of thirty — far
 * fewer prompt tokens, and validation is centralised in one place. Only
 * genuinely special flows (nutrition, context memory, balance, bulk hiker
 * wipe) keep bespoke tools. The pass_to_* escalation tools are appended per
 * tier by useAIAgent, not listed here.
 */
import {
  COLLECTION_NAMES,
  libraryCatalog, libraryQuery, libraryCreate, libraryUpdate, libraryDelete,
} from "./aiLibrary";
import { loadContext, addContextEntry, deleteContextEntry, replaceContext } from "./contextApi";
import { linkNodes as linkBrainNodes } from "./brainApi";
import { completeReminder, loadBudgetConfig, saveBudgetConfig } from "./plannerApi";
import { clearAllMembers } from "./hikerApi";
import { loadProfiles as loadNutritionProfiles, createFoodLog, loadFoodLogs, saveWeight } from "./nutritionApi";
import { todayStr as nutritionToday } from "../utils/nutrition";
import { supabase, getAuthHeaders } from "../utils/supabase";

async function logAction({ tier, tool, input, result }) {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    const userId = session?.user?.id;
    if (!userId) return;
    const status = result?.error ? "error" : "ok";
    const itemId = result?.id || input?.id || null;
    const collection = input?.collection || null;
    await supabase.from("agent_actions").insert({
      user_id: userId,
      tier,
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
        where: { type: "object", description: "Exact-match filters, e.g. {\"project_id\": \"...\", \"completed\": false}" },
        search: { type: "string", description: "Case-insensitive substring search across the collection's text fields" },
        date_from: { type: "string", description: "YYYY-MM-DD inclusive lower bound on the collection's date" },
        date_to: { type: "string", description: "YYYY-MM-DD inclusive upper bound" },
        order_by: { type: "string" },
        direction: { type: "string", enum: ["asc", "desc"] },
        limit: { type: "number", description: "Max rows (default 25, cap 100)" },
        offset: { type: "number", description: "For paging — response includes next_offset when more rows exist" },
        mode: { type: "string", enum: ["rows", "count", "summary"], description: "count = just the number; summary = count + date range + 5 sample rows" },
      },
      required: ["collection"],
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
  { name: "set_balance", description: "Set Scott's current bank balance", input_schema: { type: "object", properties: { balance: { type: "number" } }, required: ["balance"] } },
  { name: "set_category_budget", description: "Set or clear a monthly spending budget for a variable expense category (Groceries, Gas, Toiletries…). Pass amount 0 to remove the budget.", input_schema: { type: "object", properties: { category: { type: "string" }, amount: { type: "number" } }, required: ["category", "amount"] } },
  { name: "consult_banker", description: "Hand any budget/money task to Griphook, Scott's specialist Gringotts banker — logging transactions, editing recurring bills or income, setting category budgets or balance, or any multi-step ledger change. Griphook makes the edits and reports back. Use this instead of editing money data yourself.", input_schema: { type: "object", properties: { request: { type: "string", description: "The full budget task, with any specifics Scott gave (amounts, dates, categories)." } }, required: ["request"] } },
  { name: "consult_archivist", description: "Ask Bilbo, Scott's Archivist, to FIND information across his planner data and Brain (knowledge graph) and report it back. Call this when you need context or records you don't already have AND gathering it would take several queries (e.g. \"what do we know about NEVER86?\", \"pull everything relevant to this week's hikes\", \"has Scott journalled about X?\"). Give Bilbo a clear request — what you need and why — and he searches, synthesises, and returns the answer with sources. He is READ-ONLY: for changes, use the write tools yourself, or consult_banker for money.", input_schema: { type: "object", properties: { request: { type: "string", description: "The full question / what you need to know, with any specifics." } }, required: ["request"] } },
  { name: "list_nutrition_profiles", description: "List nutrition profiles (Scott + partner) with their ids. Call before logging food or weight.", input_schema: { type: "object", properties: {} } },
  {
    name: "log_food",
    description: "Log a meal/snack to a nutrition profile. Estimate calories + macros if Scott didn't give them.",
    input_schema: {
      type: "object",
      properties: {
        profile_id: { type: "string" },
        name: { type: "string" },
        calories: { type: "number" },
        protein_g: { type: "number" },
        carbs_g: { type: "number" },
        fat_g: { type: "number" },
        meal_type: { type: "string", enum: ["breakfast", "lunch", "dinner", "snack"] },
        date: { type: "string", description: "YYYY-MM-DD (defaults to today)" },
      },
      required: ["profile_id", "name", "calories"],
    },
  },
  {
    name: "log_weight",
    description: "Record a weigh-in for a nutrition profile. Scott talks in POUNDS — convert lb to kg (lb × 0.4536) before passing weight_kg.",
    input_schema: {
      type: "object",
      properties: {
        profile_id: { type: "string" },
        weight_kg: { type: "number" },
        date: { type: "string", description: "YYYY-MM-DD (defaults to today)" },
        note: { type: "string" },
      },
      required: ["profile_id", "weight_kg"],
    },
  },
  {
    name: "list_food",
    description: "List food logged for a nutrition profile on a given date (defaults to today).",
    input_schema: {
      type: "object",
      properties: { profile_id: { type: "string" }, date: { type: "string" } },
      required: ["profile_id"],
    },
  },
  { name: "clear_all_hikers", description: "Delete ALL hikers. Only after explicit confirmation.", input_schema: { type: "object", properties: { confirmed: { type: "boolean" } }, required: ["confirmed"] } },
  { name: "export_bugs", description: "Package every bug and feature request into a downloadable .zip — a Markdown report (report.md) plus all attached screenshots. Call this when Scott asks to export, download, or send his bugs/feature requests. The download starts in his browser automatically.", input_schema: { type: "object", properties: {} } },
  {
    name: "log_bug",
    description:
      "Create a bug report or feature request AND attach any screenshots Scott just dropped into the chat. ALWAYS use this (not create_item) when Scott shares a screenshot or describes something broken / something he wants added.\n\n" +
      "A report is only useful if a developer can fix it WITHOUT coming back to ask questions, so EVERY entry must capture all five facets: the exact page, the specific element, the action Scott took, what he expected, and what actually happened. Never log something vague like \"button doesn't work\" — write it the way you'd want it written for you: \"clicking the 'Save' button on Settings doesn't persist the selected colour theme to localStorage.\"\n\n" +
      "Read any attached screenshot to fill these in accurately — name what you can see. If Scott didn't say one of the facets, infer the most likely value from the screenshot and the conversation rather than leaving it vague. For a feature request, reframe the last two: 'expected' = the behaviour Scott wants, 'actual' = how it works today.",
    input_schema: {
      type: "object",
      properties: {
        title: { type: "string", description: "Short, specific one-line summary — name the element and the problem, not just the area (e.g. \"Settings colour-theme toggle doesn't persist\", not \"Settings bug\")." },
        type: { type: "string", enum: ["bug", "feature"], description: "'bug' for a defect, 'feature' for a request. Default 'bug'." },
        page: { type: "string", description: "The exact page or area where this happens, e.g. 'Settings', 'Budget › Dashboard', 'Frodo chat'." },
        element: { type: "string", description: "The specific UI element involved, named precisely — e.g. \"the 'Save' button\", \"the colour-theme dropdown\", \"the transactions table header\"." },
        action: { type: "string", description: "The exact action Scott took, e.g. 'clicked Save', 'typed a date and pressed Enter', 'dragged a screenshot into the chat'." },
        expected: { type: "string", description: "What SHOULD have happened. For a feature request, the behaviour Scott wants." },
        actual: { type: "string", description: "What ACTUALLY happened — the broken result or any error text. For a feature request, how it works today." },
        steps: { type: "string", description: "Full numbered steps to reproduce, when there's more to it than the single action above (optional)." },
        priority: { type: "string", enum: ["low", "medium", "high", "critical"] },
      },
      required: ["title", "page", "element", "action", "expected", "actual"],
    },
  },
  { name: "web_fetch", description: "Fetch a web page or API URL and return its title + readable text (truncated). Use when Scott shares a link, asks you to read/check a page, or look something current up by URL.", input_schema: { type: "object", properties: { url: { type: "string", description: "Full http(s) URL" } }, required: ["url"] } },
  { name: "link_brain_nodes", description: "Connect two existing Brain notes in the knowledge graph (directed link source → target). Use real slugs from a brain query — don't invent them. Idempotent.", input_schema: { type: "object", properties: { source_slug: { type: "string" }, target_slug: { type: "string" } }, required: ["source_slug", "target_slug"] } },
  { name: "list_context", description: "Read all saved context facts about Scott and Maria. Call this before saving to avoid duplicates.", input_schema: { type: "object", properties: {} } },
  {
    name: "save_context",
    description: "Save a fact to the persistent context store. Call automatically whenever you learn something worth remembering about Scott or Maria.",
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

async function runTool(name, input) {
  switch (name) {
    case "library_catalog": return await libraryCatalog(input || {});
    case "query": return await libraryQuery(input);
    case "create_item": return await libraryCreate(input);
    case "update_item": return await libraryUpdate(input);
    case "delete_item": return await libraryDelete(input);
    case "complete_reminder": await completeReminder(input.id); return { success: true };
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
      const { runBanker } = await import("./banker.js");
      const { getAuthHeaders } = await import("../utils/supabase");
      const authHeaders = await getAuthHeaders();
      const { text } = await runBanker({
        messages: [{ role: "user", content: String(input.request || "") }],
        authHeaders,
      });
      return { banker: "Griphook", reply: text };
    }
    case "consult_archivist": {
      // Lazy import to avoid a static cycle (archivist.js → runAgent → aiTools).
      const { runArchivist } = await import("./archivist.js");
      const { getAuthHeaders } = await import("../utils/supabase");
      const authHeaders = await getAuthHeaders();
      const { text } = await runArchivist({
        messages: [{ role: "user", content: String(input.request || "") }],
        authHeaders,
      });
      return { archivist: "Bilbo", reply: text };
    }
    case "list_nutrition_profiles": { const ps = await loadNutritionProfiles(); return { profiles: ps.map((p) => ({ id: p.id, name: p.name, goal: p.goal, target_calories: p.target_calories })) }; }
    case "log_food": {
      await createFoodLog(input.profile_id, { name: input.name, calories: input.calories, protein_g: input.protein_g || 0, carbs_g: input.carbs_g || 0, fat_g: input.fat_g || 0, meal_type: input.meal_type || "snack", date: input.date || nutritionToday(), source: "ai" });
      return { success: true };
    }
    case "log_weight": {
      await saveWeight(input.profile_id, { weight_kg: input.weight_kg, date: input.date || nutritionToday(), note: input.note || "" });
      return { success: true };
    }
    case "list_food": {
      const d = input.date || nutritionToday();
      const logs = await loadFoodLogs(input.profile_id, { from: d, to: d });
      return { items: logs.map((l) => ({ name: l.name, calories: l.calories, meal_type: l.meal_type, protein_g: l.protein_g, carbs_g: l.carbs_g, fat_g: l.fat_g })) };
    }
    case "clear_all_hikers": if (!input.confirmed) return { error: "confirmed must be true" }; await clearAllMembers(); return { success: true };
    case "export_bugs": { const { exportBugsZip } = await import("./bugsApi"); const r = await exportBugsZip(); return { success: true, ...r }; }
    case "log_bug": {
      const { createBug, updateBug } = await import("./bugsApi");
      const { takePendingScreenshots } = await import("./pendingScreenshots");
      // Stitch the five required facets into one fix-ready description. Plain
      // labelled lines render cleanly both in the Bugs page (pre-wrap text) and
      // in the exported Markdown report.
      const isFeature = input.type === "feature";
      const description = [
        ["Element", input.element],
        ["Action", input.action],
        [isFeature ? "Wanted" : "Expected", input.expected],
        [isFeature ? "Today" : "Actual", input.actual],
        ["Notes", input.description],
      ].filter(([, v]) => v && String(v).trim())
       .map(([k, v]) => `${k}: ${String(v).trim()}`)
       .join("\n");
      const bug = await createBug({
        title: input.title, type: input.type || "bug",
        description, steps: input.steps,
        page: input.page, priority: input.priority || "medium",
      });
      const shots = takePendingScreenshots();
      if (shots.length) await updateBug(bug.id, { screenshots: shots });
      return { success: true, id: bug.id, title: bug.title, type: bug.type, screenshots: shots.length };
    }
    case "web_fetch": {
      const headers = await getAuthHeaders();
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

export async function executeTool(name, input, tier = "frodo") {
  let result;
  try {
    result = await runTool(name, input);
  } catch (err) {
    result = { error: err.message };
  }
  // Skip logging for read-only / high-frequency tools to avoid noise
  const skipLog = ["library_catalog", "query", "list_context", "list_nutrition_profiles", "list_food"].includes(name);
  if (!skipLog) logAction({ tier, tool: name, input, result });
  return result;
}
