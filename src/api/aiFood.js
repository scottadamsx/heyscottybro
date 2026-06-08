// src/api/aiFood.js
// AI helpers for the nutrition + recipe features. All calls go through the
// existing Vercel proxy (/api/chat) which forwards to the Anthropic API, so no
// API key is exposed client-side. We force tool use to get strict JSON back.
const MODEL = "claude-haiku-4-5-20251001";

async function callClaude(body) {
  const res = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model: MODEL, ...body }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error?.message || data.error || `AI error ${res.status}`);
  return data;
}

/** Run a single forced-tool call and return the tool input object. */
async function toolCall({ system, content, tool, maxTokens = 1024 }) {
  const data = await callClaude({
    max_tokens: maxTokens,
    system,
    tools: [tool],
    tool_choice: { type: "tool", name: tool.name },
    messages: [{ role: "user", content }],
  });
  const block = data.content?.find((b) => b.type === "tool_use");
  if (!block) throw new Error("The AI did not return structured data. Try again.");
  return block.input;
}

const ITEM_SCHEMA = {
  type: "object",
  properties: {
    name: { type: "string" },
    quantity: { type: "string", description: "Human-readable portion, e.g. '1 cup', '2 slices'" },
    calories: { type: "number" },
    protein_g: { type: "number" },
    carbs_g: { type: "number" },
    fat_g: { type: "number" },
  },
  required: ["name", "calories", "protein_g", "carbs_g", "fat_g"],
};

const MEAL_TOOL = {
  name: "log_meal",
  description: "Record an estimated nutritional breakdown for a meal.",
  input_schema: {
    type: "object",
    properties: {
      name: { type: "string", description: "Short overall name for the meal" },
      meal_type: { type: "string", enum: ["breakfast", "lunch", "dinner", "snack"] },
      items: { type: "array", items: ITEM_SCHEMA, description: "Each distinct food/drink in the meal" },
      calories: { type: "number", description: "Total calories for the whole meal" },
      protein_g: { type: "number" },
      carbs_g: { type: "number" },
      fat_g: { type: "number" },
      confidence: { type: "string", enum: ["low", "medium", "high"] },
      assumptions: { type: "string", description: "Brief note on portion assumptions made" },
    },
    required: ["name", "items", "calories", "protein_g", "carbs_g", "fat_g"],
  },
};

const MEAL_SYSTEM =
  "You are a nutrition estimation assistant. Estimate calories and macronutrients (protein, carbs, fat in grams) " +
  "for the described or pictured meal. Break it into individual items, then give a sensible total. " +
  "Assume typical restaurant/home portion sizes unless told otherwise, and state your assumptions briefly. " +
  "Round calories to the nearest 5 and macros to the nearest gram. Always call the log_meal tool.";

/** Estimate macros from a free-text meal description. */
export async function estimateMealFromText(description) {
  return toolCall({
    system: MEAL_SYSTEM,
    content: [{ type: "text", text: `Estimate the nutrition for this meal:\n\n${description}` }],
    tool: MEAL_TOOL,
  });
}

/**
 * Estimate macros from a meal photo.
 * @param {string} base64 - raw base64 (no data: prefix)
 * @param {string} mediaType - e.g. "image/jpeg"
 * @param {string} [hint] - optional text the user added
 */
export async function estimateMealFromImage(base64, mediaType, hint = "") {
  const content = [
    { type: "image", source: { type: "base64", media_type: mediaType, data: base64 } },
    {
      type: "text",
      text: `Estimate the nutrition for the meal in this photo.${hint ? ` Extra context: ${hint}` : ""}`,
    },
  ];
  return toolCall({ system: MEAL_SYSTEM, content, tool: MEAL_TOOL, maxTokens: 1200 });
}

const RECIPE_TOOL = {
  name: "create_recipe",
  description: "Produce a complete, cookable recipe with per-serving nutrition.",
  input_schema: {
    type: "object",
    properties: {
      title: { type: "string" },
      description: { type: "string", description: "One or two appetising sentences" },
      servings: { type: "number" },
      prep_minutes: { type: "number" },
      cook_minutes: { type: "number" },
      ingredients: {
        type: "array",
        items: {
          type: "object",
          properties: { item: { type: "string" }, quantity: { type: "string" } },
          required: ["item", "quantity"],
        },
      },
      steps: { type: "array", items: { type: "string" }, description: "Ordered method steps" },
      calories_per_serving: { type: "number" },
      protein_g: { type: "number", description: "Per serving" },
      carbs_g: { type: "number", description: "Per serving" },
      fat_g: { type: "number", description: "Per serving" },
      tags: { type: "array", items: { type: "string" }, description: "e.g. high-protein, vegetarian, quick" },
    },
    required: ["title", "servings", "ingredients", "steps", "calories_per_serving", "protein_g", "carbs_g", "fat_g"],
  },
};

/**
 * Generate a recipe from a prompt and optional constraints.
 * @param {{ prompt: string, servings?: number, constraints?: string }} opts
 */
export async function generateRecipe({ prompt, servings, constraints }) {
  const parts = [`Create a recipe for: ${prompt}.`];
  if (servings) parts.push(`Make it for ${servings} serving(s).`);
  if (constraints) parts.push(`Constraints/preferences: ${constraints}.`);
  parts.push("Provide accurate per-serving nutrition.");
  return toolCall({
    system:
      "You are a practical home-cooking chef and nutritionist. Create realistic, tasty recipes with clear steps " +
      "and accurate per-serving calorie and macro estimates. Always call the create_recipe tool.",
    content: [{ type: "text", text: parts.join(" ") }],
    tool: RECIPE_TOOL,
    maxTokens: 2000,
  });
}

/**
 * Plain-language insights about a profile's weight + calorie trend.
 * @returns {Promise<string>} markdown text
 */
export async function generateInsights({ profileName, goal, weights, avgCalories, targetCalories }) {
  const series = weights
    .map((w) => `${w.date}: ${w.weight_kg}kg`)
    .join("\n") || "No weigh-ins yet.";
  const prompt =
    `Profile: ${profileName}. Goal: ${goal}. ` +
    `Average daily calories over the logged period: ${avgCalories || "unknown"}.` +
    (targetCalories ? ` Daily calorie target: ${targetCalories}.` : "") +
    `\n\nWeight history:\n${series}\n\n` +
    "In 3-5 short sentences of friendly, practical prose (no bullet lists), tell me whether my weight is trending " +
    "up, down, or flat, how that lines up with my goal and calorie intake, and one concrete, encouraging suggestion. " +
    "Be honest but supportive. If there isn't enough data yet, say so and suggest what to track.";

  const data = await callClaude({
    max_tokens: 350,
    messages: [{ role: "user", content: prompt }],
  });
  return data.content?.find((b) => b.type === "text")?.text ?? "Not enough data for insights yet.";
}
