import { getContext, addContextEntry, deleteContextEntry, replaceContext } from "./contextApi";
import {
  loadReminders, newReminder, updateReminder, completeReminder, deleteReminder,
  loadEvents, newEvent, deleteEvent,
  loadProjects, newProject, updateProject, deleteProject,
  loadJournal, newJournalEntry,
  loadInitiatives, newInitiative,
  loadEventTypes, newEventType,
  loadTransactions, newTransaction, deleteTransaction,
  addRecurringBill, addIncomeSource, loadBudgetConfig, saveBudgetConfig,
} from "./plannerApi";
import { loadMembers, deleteMember, clearAllMembers } from "./hikerApi";
import {
  loadProfiles as loadNutritionProfiles,
  createFoodLog, loadFoodLogs, saveWeight,
} from "./nutritionApi";
import { todayStr as nutritionToday } from "../utils/nutrition";
import { toDateStr } from "../utils/plannerUtils";

const today = () => toDateStr(new Date());

export const TOOLS = [
  {
    name: "list_items",
    description: "Read Scott's current data. Returns records with their IDs (needed for update/delete). Use before making changes.",
    input_schema: {
      type: "object",
      properties: {
        type: { type: "string", enum: ["reminders", "events", "projects", "journal", "transactions", "initiatives", "event_types"], description: "Which collection to read" },
      },
      required: ["type"],
    },
  },
  {
    name: "add_reminder",
    description: "Add a reminder/task (optionally recurring, with a due date and/or project)",
    input_schema: {
      type: "object",
      properties: {
        name: { type: "string" },
        date: { type: "string", description: "Due date YYYY-MM-DD (optional)" },
        time: { type: "string", description: "HH:MM (optional)" },
        description: { type: "string" },
        recurrence: { type: "string", enum: ["none", "daily", "weekly", "monthly"] },
        project_id: { type: "string", description: "Attach to a project/sub-project (from list_items projects)" },
        show_on_calendar: { type: "boolean" },
      },
      required: ["name"],
    },
  },
  {
    name: "update_reminder",
    description: "Edit an existing reminder/task. Get the id from list_items first. Only pass the fields you want to change.",
    input_schema: {
      type: "object",
      properties: {
        id: { type: "string" },
        name: { type: "string" },
        date: { type: "string", description: "Due date YYYY-MM-DD" },
        time: { type: "string", description: "HH:MM" },
        description: { type: "string" },
        recurrence: { type: "string", enum: ["none", "daily", "weekly", "monthly"] },
        project_id: { type: "string" },
        show_on_calendar: { type: "boolean" },
      },
      required: ["id"],
    },
  },
  { name: "complete_reminder", description: "Mark a reminder/task complete", input_schema: { type: "object", properties: { id: { type: "string" } }, required: ["id"] } },
  { name: "delete_reminder", description: "Delete a reminder/task by id", input_schema: { type: "object", properties: { id: { type: "string" } }, required: ["id"] } },
  {
    name: "add_event",
    description: "Add a calendar event. If an event_type with auto-tasks is given, dependency reminders are auto-created.",
    input_schema: {
      type: "object",
      properties: {
        title: { type: "string" },
        date: { type: "string", description: "YYYY-MM-DD" },
        description: { type: "string" },
        project_id: { type: "string" },
        event_type_id: { type: "string" },
      },
      required: ["title", "date"],
    },
  },
  { name: "delete_event", description: "Delete a calendar event by id", input_schema: { type: "object", properties: { id: { type: "string" } }, required: ["id"] } },
  {
    name: "add_project",
    description: "Create a project, or a sub-project (e.g. a class) by passing parent_id",
    input_schema: {
      type: "object",
      properties: {
        name: { type: "string" },
        description: { type: "string" },
        color: { type: "string", description: "Hex colour like #4f7cff" },
        parent_id: { type: "string", description: "Parent project id to nest under (optional)" },
      },
      required: ["name"],
    },
  },
  { name: "update_project", description: "Rename or recolour a project", input_schema: { type: "object", properties: { id: { type: "string" }, name: { type: "string" }, description: { type: "string" }, color: { type: "string" } }, required: ["id"] } },
  { name: "delete_project", description: "Delete a project (and its tasks/sub-projects). Confirm first.", input_schema: { type: "object", properties: { id: { type: "string" } }, required: ["id"] } },
  {
    name: "add_event_type",
    description: "Create an event type with auto-task dependencies that fire relative to an event's date",
    input_schema: {
      type: "object",
      properties: {
        name: { type: "string" },
        color: { type: "string" },
        auto_tasks: {
          type: "array",
          description: "Dependency reminders. offset_days negative = before, 0 = day of, positive = after.",
          items: { type: "object", properties: { offset_days: { type: "number" }, name: { type: "string" } }, required: ["offset_days", "name"] },
        },
      },
      required: ["name"],
    },
  },
  { name: "add_journal_entry", description: "Add a journal entry", input_schema: { type: "object", properties: { title: { type: "string" }, entry: { type: "string" }, date: { type: "string" } }, required: ["title", "entry"] } },
  { name: "add_initiative", description: "Add a recurring initiative/commitment to a project", input_schema: { type: "object", properties: { project_id: { type: "string" }, name: { type: "string" }, description: { type: "string" }, recurrence: { type: "string", enum: ["daily", "weekly", "monthly"] } }, required: ["name"] } },
  {
    name: "add_transaction",
    description: "Log a financial transaction (expense, income, or future planned spend)",
    input_schema: {
      type: "object",
      properties: {
        description: { type: "string" },
        amount: { type: "number", description: "Positive — sign derived from type" },
        type: { type: "string", enum: ["expense", "income", "future"], description: "future = planned spend (counts against projected balance, not actuals)" },
        category: { type: "string" },
        date: { type: "string" },
        notes: { type: "string" },
      },
      required: ["description", "amount", "type", "category", "date"],
    },
  },
  { name: "delete_transaction", description: "Delete a transaction by id", input_schema: { type: "object", properties: { id: { type: "string" } }, required: ["id"] } },
  { name: "add_income_source", description: "Add a recurring income source", input_schema: { type: "object", properties: { name: { type: "string" }, amount: { type: "number" }, startDate: { type: "string" }, endDate: { type: "string" }, notes: { type: "string" } }, required: ["name", "amount"] } },
  { name: "set_balance", description: "Set Scott's current bank balance", input_schema: { type: "object", properties: { balance: { type: "number" } }, required: ["balance"] } },
  { name: "add_recurring_bill", description: "Add a recurring monthly bill or subscription", input_schema: { type: "object", properties: { name: { type: "string" }, amount: { type: "number" }, category: { type: "string" }, startDate: { type: "string" }, dueDay: { type: "number" }, notes: { type: "string" } }, required: ["name", "amount", "category"] } },
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
  { name: "search_hikers", description: "Search hikers by name or email to find IDs", input_schema: { type: "object", properties: { query: { type: "string" } }, required: ["query"] } },
  { name: "delete_hiker", description: "Delete a specific hiker by id", input_schema: { type: "object", properties: { id: { type: "string" }, name: { type: "string" } }, required: ["id", "name"] } },
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
      case "list_items": {
        const t = input.type;
        if (t === "reminders") return { items: (await loadReminders()).map((r) => ({ id: r.id, name: r.name, date: r.date, time: r.time, recurrence: r.recurrence, completed: r.completed, project_id: r.project_id })) };
        if (t === "events") return { items: (await loadEvents()).map((e) => ({ id: e.id, title: e.title, date: e.date, project_id: e.project_id })) };
        if (t === "projects") return { items: (await loadProjects()).map((p) => ({ id: p.id, name: p.name, color: p.color, parent_id: p.parent_id })) };
        if (t === "journal") return { items: (await loadJournal()).map((j) => ({ id: j.id, title: j.title, date: j.date })) };
        if (t === "transactions") return { items: (await loadTransactions()).slice(0, 40).map((x) => ({ id: x.id, description: x.description, amount: x.amount, category: x.category, date: x.date })) };
        if (t === "initiatives") return { items: (await loadInitiatives()).map((i) => ({ id: i.id, name: i.name, recurrence: i.recurrence, project_id: i.project_id })) };
        if (t === "event_types") return { items: (await loadEventTypes()).map((e) => ({ id: e.id, name: e.name, auto_tasks: e.auto_tasks })) };
        return { error: "unknown type" };
      }
      case "add_reminder":
        await newReminder({ name: input.name, date: input.date || null, time: input.time || null, description: input.description || null, recurrence: input.recurrence || "none", project_id: input.project_id || null, show_on_calendar: input.show_on_calendar });
        return { success: true };
      case "update_reminder": {
        const { id, ...fields } = input;
        await updateReminder(id, fields);
        return { success: true };
      }
      case "complete_reminder": await completeReminder(input.id); return { success: true };
      case "delete_reminder": await deleteReminder(input.id); return { success: true };
      case "add_event":
        await newEvent({ title: input.title, date: input.date, description: input.description || "", project_id: input.project_id || null, event_type_id: input.event_type_id || null });
        return { success: true };
      case "delete_event": await deleteEvent(input.id); return { success: true };
      case "add_project": { const p = await newProject({ name: input.name, description: input.description || "", color: input.color || "#4f7cff", parent_id: input.parent_id || null }); return { success: true, id: p?.id }; }
      case "update_project": { const u = {}; if (input.name != null) u.name = input.name; if (input.description != null) u.description = input.description; if (input.color != null) u.color = input.color; await updateProject(input.id, u); return { success: true }; }
      case "delete_project": await deleteProject(input.id); return { success: true };
      case "add_event_type": { const e = await newEventType({ name: input.name, color: input.color || "#22d3ee", auto_tasks: input.auto_tasks || [] }); return { success: true, id: e?.id }; }
      case "add_journal_entry": await newJournalEntry({ title: input.title, entry: input.entry, date: input.date || today() }); return { success: true };
      case "add_initiative": await newInitiative({ project_id: input.project_id || null, name: input.name, description: input.description || "", recurrence: input.recurrence || "weekly" }); return { success: true };
      case "add_transaction": await newTransaction({ description: input.description, amount: input.amount, type: input.type, category: input.category, date: input.date, notes: input.notes || "" }); return { success: true };
      case "delete_transaction": await deleteTransaction(input.id); return { success: true };
      case "add_income_source": await addIncomeSource({ name: input.name, amount: input.amount, frequency: "monthly", startDate: input.startDate || today(), endDate: input.endDate || null, notes: input.notes || "" }); return { success: true };
      case "set_balance": { const cfg = await loadBudgetConfig(); await saveBudgetConfig({ ...cfg, startingBalance: input.balance }); return { success: true }; }
      case "add_recurring_bill": await addRecurringBill({ name: input.name, amount: input.amount, category: input.category, startDate: input.startDate || today(), dueDay: input.dueDay ?? null, notes: input.notes || "" }); return { success: true };
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
      case "search_hikers": { const results = await loadMembers(input.query); return { results: results.slice(0, 10).map((m) => ({ id: m.id, name: `${m.first} ${m.last}`, email: m.email || "", attendance: m.attendance })) }; }
      case "delete_hiker": await deleteMember(input.id); return { success: true, deleted: input.name };
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
