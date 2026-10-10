import { readFileSync } from "node:fs";
import { AI_MODELS } from "../src/config/aiModels.js";
import { parseBody, verifySupabaseUser } from "./_utils.js";

export const EVENT_DRAFT_FEATURE = "event_draft";
export const EVENT_DRAFT_LIMIT = 4000;
const raw = readFileSync(new URL("../prompts/event-draft.md", import.meta.url), "utf8");
const match = raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
if (!match) throw new Error("event draft prompt front matter is invalid");
const meta = Object.fromEntries(match[1].split("\n").map((line) => line.split(/:\s*/, 2)));
export const EVENT_DRAFT_PROMPT = Object.freeze({ name: meta.name, version: Number(meta.version), text: match[2].trim() });

const fields = ["title", "date", "end_date", "start_time", "end_time", "description"];
const TOOL = Object.freeze({
  name: "return_event_draft",
  description: "Return editable event-form fields; never save the event.",
  input_schema: { type: "object", additionalProperties: false, properties: Object.fromEntries(fields.map((field) => [field, { type: "string" }])), required: fields },
});

export function eventDraftStatus(env = process.env) {
  return { available: Boolean(env.ANTHROPIC_API_KEY) && env.EVENT_DRAFTING_ENABLED === "1" };
}

function validDate(value) {
  if (!value) return true;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function validateEventDraft(value) {
  if (!value || typeof value !== "object" || Array.isArray(value) || Object.keys(value).some((key) => !fields.includes(key))) throw new Error("unexpected event draft fields");
  if (fields.some((key) => typeof value[key] !== "string" || value[key].length > (key === "description" ? 10000 : 100))) throw new Error("invalid event draft values");
  if (!validDate(value.date) || !validDate(value.end_date)) throw new Error("invalid event date");
  if (value.start_time && !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value.start_time)) throw new Error("invalid start time");
  if (value.end_time && !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value.end_time)) throw new Error("invalid end time");
  if (value.date && value.end_date && value.end_date < value.date) throw new Error("event ends before it starts");
  return Object.fromEntries(fields.map((key) => [key, value[key].trim()]));
}

export async function handleEventDraft(req, res, { env = process.env, request = fetch, verify = verifySupabaseUser } = {}) {
  if (!(await verify(req))) return res.status(401).json({ error: "Not authenticated" });
  if (!eventDraftStatus(env).available) return res.status(503).json({ error: "Event drafting is unavailable" });
  let body;
  try { body = parseBody(req); } catch { return res.status(400).json({ error: "Invalid request body" }); }
  const { description, referenceDate, timezone } = body || {};
  if (typeof description !== "string" || !description.trim() || description.length > EVENT_DRAFT_LIMIT) return res.status(400).json({ error: `Description must be 1–${EVENT_DRAFT_LIMIT} characters` });
  if (!validDate(referenceDate) || !referenceDate || typeof timezone !== "string" || timezone.length > 100) return res.status(400).json({ error: "A valid local reference date and timezone are required" });

  const call = async (retry = "") => request("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({
      model: AI_MODELS.smart, max_tokens: 1200,
      system: `${EVENT_DRAFT_PROMPT.text}${retry ? `\n\nPrevious output failed validation (${retry}); correct it.` : ""}`,
      tools: [TOOL], tool_choice: { type: "tool", name: TOOL.name },
      messages: [{ role: "user", content: JSON.stringify({ description, referenceDate, timezone }) }],
    }),
  });
  try {
    const response = await call();
    const data = await response.json().catch(() => ({}));
    if (!response.ok) return res.status(response.status >= 500 ? 502 : response.status).json({ error: "Event drafting failed. Try again." });
    const tool = data.content?.find((block) => block.type === "tool_use" && block.name === TOOL.name);
    const draft = validateEventDraft(tool?.input);
    return res.status(200).json({ draft, provenance: { feature: EVENT_DRAFT_FEATURE, model: AI_MODELS.smart, prompt: EVENT_DRAFT_PROMPT.name, promptVersion: EVENT_DRAFT_PROMPT.version, generatedAt: new Date().toISOString() } });
  } catch (error) {
    return res.status(502).json({ error: error?.message?.includes("validation") || error?.message?.includes("event draft") ? "Event drafting returned invalid fields. Try again." : "Event drafting failed. Try again." });
  }
}
