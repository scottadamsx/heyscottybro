import { readFileSync } from "node:fs";
import { AI_MODELS } from "../src/config/aiModels.js";
import { parseBody, verifySupabaseUser } from "./_utils.js";

export const JOURNAL_CLEANUP_LIMIT = 12000;
export const JOURNAL_CLEANUP_FEATURE = "journal_cleanup";
export const MAX_CLEANUP_ROUNDS = 2;

const rawPrompt = readFileSync(new URL("../prompts/journal-cleanup.md", import.meta.url), "utf8");
const promptMatch = rawPrompt.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
if (!promptMatch) throw new Error("journal cleanup prompt front matter is invalid");

const frontMatter = Object.fromEntries(
  promptMatch[1].split("\n").map((line) => line.split(/:\s*/, 2)).filter((pair) => pair.length === 2),
);
export const JOURNAL_CLEANUP_PROMPT = Object.freeze({
  name: frontMatter.name,
  version: Number(frontMatter.version),
  text: promptMatch[2].trim(),
});

const emojiPattern = /\p{Extended_Pictographic}/u;
const placeholderPattern = /<<JOURNAL_EMOJI_\d{4}>>/g;

export function countGraphemes(value) {
  const text = String(value || "");
  if (typeof Intl?.Segmenter === "function") {
    return [...new Intl.Segmenter(undefined, { granularity: "grapheme" }).segment(text)].length;
  }
  return Array.from(text).length;
}

export function maskJournalEmoji(value) {
  const text = String(value || "");
  if (text.includes("<<JOURNAL_EMOJI_")) throw new Error("The entry contains reserved cleanup text.");
  const segments = typeof Intl?.Segmenter === "function"
    ? [...new Intl.Segmenter(undefined, { granularity: "grapheme" }).segment(text)].map((part) => part.segment)
    : Array.from(text);
  const emoji = [];
  const maskedText = segments.map((segment) => {
    if (!emojiPattern.test(segment)) return segment;
    const token = `<<JOURNAL_EMOJI_${String(emoji.length).padStart(4, "0")}>>`;
    emoji.push({ token, value: segment });
    return token;
  }).join("");
  return { maskedText, emoji };
}

export function validateAndRestoreCleanup(input, emoji) {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error("invalid structured result");
  if (Object.keys(input).some((key) => key !== "cleaned_text")) throw new Error("unexpected result fields");
  if (typeof input.cleaned_text !== "string" || !input.cleaned_text.trim()) throw new Error("empty cleaned text");
  if (input.cleaned_text.length > 200_000) throw new Error("cleaned text is too long");
  if (emojiPattern.test(input.cleaned_text)) throw new Error("generated emoji is not allowed");

  const returned = input.cleaned_text.match(placeholderPattern) || [];
  const expected = emoji.map(({ token }) => token);
  if (returned.length !== expected.length || returned.some((token, index) => token !== expected[index])) {
    throw new Error("emoji placeholders changed");
  }
  let restored = input.cleaned_text;
  for (const { token, value } of emoji) restored = restored.replace(token, value);
  if (countGraphemes(restored) > JOURNAL_CLEANUP_LIMIT) throw new Error("cleaned text is too long");
  return restored;
}

export function journalCleanupStatus(env = process.env) {
  return { available: Boolean(env.ANTHROPIC_API_KEY) && env.JOURNAL_CLEANUP_ENABLED === "1" };
}

const CLEANUP_TOOL = Object.freeze({
  name: "return_cleaned_journal",
  description: "Return the corrected journal text.",
  input_schema: {
    type: "object",
    additionalProperties: false,
    properties: { cleaned_text: { type: "string" } },
    required: ["cleaned_text"],
  },
});

function requestBody(maskedText, retryReason = "") {
  return {
    model: AI_MODELS.smart,
    max_tokens: 4096,
    system: retryReason
      ? `${JOURNAL_CLEANUP_PROMPT.text}\n\nThe previous result failed validation: ${retryReason}. Correct that problem.`
      : JOURNAL_CLEANUP_PROMPT.text,
    tools: [CLEANUP_TOOL],
    tool_choice: { type: "tool", name: CLEANUP_TOOL.name },
    messages: [{ role: "user", content: maskedText }],
  };
}

async function callAnthropic(maskedText, apiKey, retryReason, request = fetch) {
  const response = await request("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify(requestBody(maskedText, retryReason)),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = data?.error?.message || `Anthropic request failed (${response.status})`;
    const error = new Error(message);
    error.status = response.status;
    throw error;
  }
  return data;
}

export async function handleJournalCleanup(req, res, { env = process.env, request = fetch, verify = verifySupabaseUser } = {}) {
  if (!(await verify(req))) return res.status(401).json({ error: "Not authenticated" });
  if (!journalCleanupStatus(env).available) return res.status(503).json({ error: "Journal cleanup is unavailable" });

  let body;
  try { body = parseBody(req); }
  catch { return res.status(400).json({ error: "Invalid request body" }); }
  const text = body?.text;
  if (typeof text !== "string" || !text.trim()) return res.status(400).json({ error: "Entry text is required" });
  if (countGraphemes(text) > JOURNAL_CLEANUP_LIMIT) return res.status(400).json({ error: `Entry text must be ${JOURNAL_CLEANUP_LIMIT.toLocaleString()} characters or fewer` });

  let masked;
  try { masked = maskJournalEmoji(text); }
  catch (error) { return res.status(400).json({ error: error.message }); }

  let validationError = "";
  for (let attempt = 0; attempt < MAX_CLEANUP_ROUNDS; attempt += 1) {
    let data;
    try { data = await callAnthropic(masked.maskedText, env.ANTHROPIC_API_KEY, validationError, request); }
    catch (error) { return res.status(error.status || 502).json({ error: "Journal cleanup failed. Try again." }); }
    const tool = data.content?.find((block) => block.type === "tool_use" && block.name === CLEANUP_TOOL.name);
    try {
      const cleanedText = validateAndRestoreCleanup(tool?.input, masked.emoji);
      return res.status(200).json({
        cleanedText,
        provenance: {
          feature: JOURNAL_CLEANUP_FEATURE,
          model: AI_MODELS.smart,
          prompt: JOURNAL_CLEANUP_PROMPT.name,
          promptVersion: JOURNAL_CLEANUP_PROMPT.version,
          generatedAt: new Date().toISOString(),
        },
      });
    } catch (error) {
      validationError = error.message;
    }
  }
  return res.status(502).json({ error: "Journal cleanup returned an invalid result. Try again." });
}
