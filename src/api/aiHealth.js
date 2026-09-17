// src/api/aiHealth.js — the Health space's AI (DR-018), through the /api/chat proxy.
// Each call forces one tool, so the result is structured and checked before anything is
// shown; nothing is saved until Scott presses Save.
import { getAuthHeaders } from "../utils/supabase";
import { parseJsonResponse } from "../lib/http";
import { cleanExercises } from "./healthApi";

const FAST = "claude-haiku-4-5-20251001";
const SMART = "claude-sonnet-4-6";

async function callChat(body) {
  const res = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(await getAuthHeaders()) },
    body: JSON.stringify(body),
  });
  const data = await parseJsonResponse(res);
  if (!res.ok) throw new Error(data.error?.message || data.error || `AI error ${res.status}`);
  return data;
}

/** One forced tool call — the answer comes back as structured data, never prose. */
async function toolCall({ model, system, text, tool, maxTokens = 1500 }) {
  const data = await callChat({
    model,
    max_tokens: maxTokens,
    system,
    tools: [tool],
    tool_choice: { type: "tool", name: tool.name },
    messages: [{ role: "user", content: text }],
  });
  const block = data.content?.find((b) => b.type === "tool_use");
  if (!block) throw new Error("The AI didn't return an answer in the expected shape. Try again.");
  return block.input;
}

/**
 * Like toolCall, but the model may search the web first (Anthropic runs the search) and must
 * finish by calling the tool. Returns { input, searches } — searches are the queries it ran.
 */
async function searchThenTool({ model, system, text, tool, maxTokens = 3000, maxSearches = 3 }) {
  const messages = [{ role: "user", content: text }];
  const tools = [{ type: "web_search_20250305", name: "web_search", max_uses: maxSearches }, tool];
  const searches = [];
  for (let round = 0; round < 3; round++) {
    const data = await callChat({ model, max_tokens: maxTokens, system, tools, messages });
    for (const b of data.content || []) {
      if (b.type === "server_tool_use" && b.name === "web_search") searches.push(b.input?.query);
    }
    const block = data.content?.find((b) => b.type === "tool_use" && b.name === tool.name);
    if (block) return { input: block.input, searches: searches.filter(Boolean) };
    if (data.stop_reason !== "tool_use") break;
    // Web search ran server-side; ask again so it finishes with the real tool call.
    messages.push({ role: "assistant", content: data.content });
    messages.push({ role: "user", content: `Now call ${tool.name} with your answer.` });
  }
  throw new Error("The AI didn't return an answer in the expected shape. Try again.");
}

// ── Food estimate ────────────────────────────────────────────────────────────

const FOOD_TOOL = {
  name: "estimate_meal",
  description: "Record the estimated nutrition for a meal.",
  input_schema: {
    type: "object",
    properties: {
      name: { type: "string", description: "Short name for the whole meal" },
      meal_type: { type: "string", enum: ["breakfast", "lunch", "dinner", "snack"] },
      calories: { type: "number" },
      protein_g: { type: "number" },
      carbs_g: { type: "number" },
      fat_g: { type: "number" },
      items: {
        type: "array",
        items: {
          type: "object",
          properties: { name: { type: "string" }, quantity: { type: "string" }, calories: { type: "number" } },
          required: ["name", "calories"],
        },
      },
      assumptions: { type: "string", description: "One short line on the portion sizes assumed" },
      source: { type: "string", description: "Where the numbers came from, e.g. \"McDonald's official nutrition\" or \"USDA\" — say \"estimated\" if you didn't find published values" },
      source_url: { type: "string", description: "Link to the published nutrition page you used, if any" },
    },
    required: ["name", "calories", "protein_g", "carbs_g", "fat_g"],
  },
};

/**
 * "Big Mac meal with a large coke" → checked nutrition. The model searches the web for
 * published values (chains, packaged food) before estimating, and says what it used.
 */
export async function estimateFood(description, { mealType } = {}) {
  const text = String(description || "").trim();
  if (!text) throw new Error("Describe what you ate first.");
  const { input: out, searches } = await searchThenTool({
    model: FAST,
    system:
      "You work out calories and macros (grams of protein, carbs, fat) for what someone ate.\n" +
      "FIRST search the web for published nutrition facts whenever a restaurant, chain, brand or packaged " +
      "product is named (e.g. \"Tim Hortons large iced capp nutrition\"), and prefer the official or a " +
      "reputable database value over your own guess. For plain home food, estimate from typical portions " +
      "without searching. Say in `source` where the numbers came from, with `source_url` when you used a page. " +
      "State portion assumptions in one short line. Round calories to the nearest 5 and grams to whole numbers. " +
      "Finish by calling estimate_meal.",
    text: `${mealType ? `Meal: ${mealType}. ` : ""}What I ate: ${text}`,
    tool: FOOD_TOOL,
  });
  const n = (v) => Math.max(0, Math.round(Number(v) || 0));
  if (!(n(out.calories) > 0)) throw new Error("The estimate came back empty. Add a little more detail and try again.");
  return { ...out, calories: n(out.calories), protein_g: n(out.protein_g), carbs_g: n(out.carbs_g), fat_g: n(out.fat_g), searches };
}

// ── Workout builder ──────────────────────────────────────────────────────────

const WORKOUT_TOOL = {
  name: "build_workout",
  description: "A single gym session to save as a reusable workout.",
  input_schema: {
    type: "object",
    properties: {
      name: { type: "string", description: "Short name, e.g. 'Push A' or 'Leg day'" },
      notes: { type: "string", description: "One or two lines: focus, warm-up advice" },
      exercises: {
        type: "array",
        items: {
          type: "object",
          properties: {
            name: { type: "string", description: "Standard exercise name; reuse the user's existing names when it's the same movement" },
            sets: { type: "integer", minimum: 1, maximum: 10 },
            repMin: { type: "integer", minimum: 1, maximum: 50 },
            repMax: { type: "integer", minimum: 1, maximum: 50 },
            restSec: { type: "integer", minimum: 0, maximum: 600 },
            note: { type: "string", description: "Short cue, optional" },
          },
          required: ["name", "sets", "repMin", "repMax", "restSec"],
        },
      },
    },
    required: ["name", "exercises"],
  },
};

/**
 * prompt: what Scott wants ("45 min push day, dumbbells only").
 * known: [{ exercise, best, lastDate }] from his history, so names match and it can build on them.
 * Returns a plan draft { name, notes, exercises } — validated, not saved.
 */
export async function buildWorkout(prompt, { known = [], profile = {} } = {}) {
  const ask = String(prompt || "").trim();
  if (!ask) throw new Error("Say what kind of workout you want.");
  const knownText = known.length
    ? known.slice(0, 40).map((k) => `- ${k.exercise} (best est. 1RM ${k.best} lb, last ${k.lastDate})`).join("\n")
    : "(no history yet)";
  const out = await toolCall({
    model: SMART,
    system:
      "You are a strength coach writing one gym session. Choose exercises that fit the request and the equipment " +
      "mentioned, order compound lifts first, and keep total time realistic (about 2–3 minutes per set including rest). " +
      "Use rep ranges suited to the goal (strength 4–6, hypertrophy 8–12, endurance 12–20). " +
      "Reuse the exact names from the user's history when it's the same movement. Don't prescribe weights — the app " +
      "sets them from history. Always call build_workout.",
    text: `Request: ${ask}\nGoal: ${profile.goal || "not stated"}\nExercises I've done before:\n${knownText}`,
    tool: WORKOUT_TOOL,
    maxTokens: 2000,
  });
  const exercises = cleanExercises(
    (out.exercises || []).map((e) => ({ ...e, repMax: Math.max(e.repMax, e.repMin) })),
  );
  return { name: String(out.name || "Workout").slice(0, 120), notes: String(out.notes || ""), exercises };
}

// ── Coach's take ─────────────────────────────────────────────────────────────

const COACH_TOOL = {
  name: "coach_summary",
  description: "A short, grounded read of the user's recent training and nutrition.",
  input_schema: {
    type: "object",
    properties: {
      summary: { type: "string", description: "2–3 sentences, only about the numbers given" },
      actions: { type: "array", items: { type: "string" }, maxItems: 3, description: "Up to 3 specific things to do this week, each tied to a number given" },
    },
    required: ["summary", "actions"],
  },
};

/** stats: the computed insights and summaries (never raw guesses). */
export async function coachTake(stats) {
  const out = await toolCall({
    model: SMART,
    system:
      "You are a blunt, encouraging strength and nutrition coach. Use ONLY the numbers in the data you are given; " +
      "never invent lifts, weights, dates or calories. If the data is thin, say what to log next. Plain words, no emoji. " +
      "Always call coach_summary.",
    text: `My recent data (computed by the app):\n${JSON.stringify(stats, null, 1)}`,
    tool: COACH_TOOL,
    maxTokens: 700,
  });
  return { summary: String(out.summary || ""), actions: (out.actions || []).map(String).slice(0, 3) };
}
