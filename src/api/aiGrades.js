// src/api/aiGrades.js — AI catch-up plan for the Grade Tracker.
// Analyses the user's assessments + instructor feedback, finds weak areas, and
// returns a prioritised plan. Each plan item becomes a reminder (created by the
// UI via plannerApi.newReminder). Goes through the /api/chat proxy like aiReceipt.
import { getAuthHeaders } from "../utils/supabase";

const MODEL = "claude-haiku-4-5-20251001";

const PLAN_TOOL = {
  name: "catch_up_plan",
  description: "Return a prioritised study/catch-up plan based on the student's grades and feedback.",
  input_schema: {
    type: "object",
    properties: {
      summary: { type: "string", description: "2-3 sentence read on where the student stands and what matters most." },
      weak_areas: { type: "array", items: { type: "string" }, description: "The specific topics/skills to shore up, most important first." },
      action_items: {
        type: "array",
        description: "Concrete, doable study actions, highest-impact first (max 6).",
        items: {
          type: "object",
          properties: {
            title: { type: "string", description: "Short imperative task, e.g. 'Redo exception-handling lab questions 3-5'." },
            detail: { type: "string", description: "One line on what to do / why it helps." },
            offset_days: { type: "number", description: "Suggested due date as days from today (0 = today, 1 = tomorrow…)." },
          },
          required: ["title"],
        },
      },
    },
    required: ["summary", "action_items"],
  },
};

const SYSTEM =
  "You are a sharp, encouraging academic coach. Given a student's assessments (name, grade earned vs max, weight) " +
  "and any instructor feedback, identify the weakest areas and produce a SHORT, prioritised catch-up plan of concrete " +
  "study actions. Favour high-impact, specific tasks over generic advice. Spread due dates sensibly over the next " +
  "1-2 weeks via offset_days. Always call the catch_up_plan tool.";

/**
 * @param {Array} grades  rows: { course, name, earned, max, weight, feedback }
 * @returns {Promise<{summary:string, weak_areas:string[], action_items:Array<{title,detail,offset_days}>}>}
 */
export async function generateCatchUpPlan(grades = []) {
  const lines = grades.map((g) => {
    const pct = g.earned != null && g.max ? Math.round((Number(g.earned) / Number(g.max)) * 100) : null;
    return `- ${g.course ? `[${g.course}] ` : ""}${g.name}: ${g.earned ?? "—"}/${g.max} (${pct != null ? pct + "%" : "ungraded"}), weight ${g.weight}%${g.feedback ? `\n    feedback: ${g.feedback}` : ""}`;
  }).join("\n");

  const res = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(await getAuthHeaders()) },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 1500,
      system: SYSTEM,
      tools: [PLAN_TOOL],
      tool_choice: { type: "tool", name: PLAN_TOOL.name },
      messages: [{ role: "user", content: `Here are my assessments:\n${lines || "(none yet)"}\n\nBuild my catch-up plan.` }],
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error?.message || data.error || `AI error ${res.status}`);
  const block = data.content?.find((b) => b.type === "tool_use");
  if (!block) throw new Error("Couldn't generate a plan — try again.");
  const out = block.input || {};
  return {
    summary: out.summary || "",
    weak_areas: Array.isArray(out.weak_areas) ? out.weak_areas : [],
    action_items: Array.isArray(out.action_items) ? out.action_items : [],
  };
}
