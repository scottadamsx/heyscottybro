// src/api/aiDraft.js — generate a reply DRAFT in Scott's voice for a message.
// Pulls his saved context (tone/preferences/relationships) so the draft sounds
// like him. Goes through the /api/chat proxy like the other AI helpers.
import { getAuthHeaders } from "../utils/supabase";
import { loadContext } from "./contextApi";

const MODEL = "claude-haiku-4-5-20251001";

const DRAFT_TOOL = {
  name: "write_draft",
  description: "Write a reply draft in the user's voice.",
  input_schema: {
    type: "object",
    properties: {
      draft: { type: "string", description: "The full reply, ready to send/paste. No 'Subject:' line unless it's an email that needs one." },
      one_line_intent: { type: "string", description: "One line: what this reply does (so the user can scan it)." },
    },
    required: ["draft"],
  },
};

/**
 * @param {{channel?:string, sender?:string, subject?:string, body:string, guidance?:string}} msg
 * @returns {Promise<{draft:string, one_line_intent:string}>}
 */
export async function generateDraft(msg) {
  let toneFacts = [];
  try {
    const ctx = await loadContext();
    toneFacts = (ctx || [])
      .filter((c) => /tone|voice|writ|style|prefer|communicat/i.test(`${c.tags?.join(" ")} ${c.text}`))
      .map((c) => c.text)
      .slice(0, 8);
  } catch { /* context is optional */ }

  const system =
    "You draft message replies in Scott's voice — natural, warm, and to the point, the way he actually writes. " +
    "Match the channel's register (email a touch more formal; Slack/Discord casual). Be concise; don't over-explain. " +
    "Never invent facts or commitments he didn't make — if a detail is needed, leave a clearly bracketed [placeholder]. " +
    (toneFacts.length ? `What we know about how Scott writes / his context:\n- ${toneFacts.join("\n- ")}\n` : "") +
    "Always call the write_draft tool.";

  const lines = [
    msg.channel && msg.channel !== "manual" ? `Channel: ${msg.channel}` : null,
    msg.sender ? `From: ${msg.sender}` : null,
    msg.subject ? `Subject: ${msg.subject}` : null,
    "",
    msg.body || "",
    msg.guidance ? `\n[Scott's steer for this reply: ${msg.guidance}]` : "",
  ].filter((l) => l != null).join("\n");

  const res = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(await getAuthHeaders()) },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 1200,
      system,
      tools: [DRAFT_TOOL],
      tool_choice: { type: "tool", name: DRAFT_TOOL.name },
      messages: [{ role: "user", content: `Draft my reply to this message:\n\n${lines}` }],
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error?.message || data.error || `AI error ${res.status}`);
  const block = data.content?.find((b) => b.type === "tool_use");
  if (!block) throw new Error("Couldn't draft a reply — try again.");
  return { draft: block.input?.draft || "", one_line_intent: block.input?.one_line_intent || "" };
}
