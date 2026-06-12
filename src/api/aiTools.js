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
import { getContext, addContextEntry, deleteContextEntry, replaceContext } from "./contextApi";
import { completeReminder, loadBudgetConfig, saveBudgetConfig } from "./plannerApi";
import { clearAllMembers } from "./hikerApi";
import { loadProfiles as loadNutritionProfiles, createFoodLog, loadFoodLogs, saveWeight } from "./nutritionApi";
import { todayStr as nutritionToday } from "../utils/nutrition";

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

export async function executeTool(name, input) {
  try {
    switch (name) {
      case "library_catalog": return await libraryCatalog(input || {});
      case "query": return await libraryQuery(input);
      case "create_item": return await libraryCreate(input);
      case "update_item": return await libraryUpdate(input);
      case "delete_item": return await libraryDelete(input);
      case "complete_reminder": await completeReminder(input.id); return { success: true };
      case "set_balance": { const cfg = await loadBudgetConfig(); await saveBudgetConfig({ ...cfg, startingBalance: input.balance }); return { success: true }; }
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
      case "list_context": return { items: getContext().map((c) => ({ id: c.id, text: c.text, tags: c.tags, by: c.by, why: c.why, ts: c.ts })) };
      case "save_context": { const entry = addContextEntry({ text: input.text, tags: input.tags || [], by: "frodo", why: input.why || "noted by Frodo" }); return { success: true, id: entry.id }; }
      case "delete_context": deleteContextEntry(input.id); return { success: true };
      case "reorganize_context": {
        if (!input.confirmed) return { error: "confirmed must be true — present the plan to Scott first and wait for a yes" };
        const genId = () => `ctx${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
        const stamped = (input.entries || []).map((e) => ({ id: e.id || genId(), ts: e.ts || Date.now(), text: e.text, tags: e.tags || [], by: e.by || "frodo", why: e.why || "" }));
        replaceContext(stamped);
        return { success: true, count: stamped.length };
      }
      default: return { error: `Unknown tool: ${name}` };
    }
  } catch (err) {
    return { error: err.message };
  }
}
