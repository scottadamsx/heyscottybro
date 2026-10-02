// The only source file that contains provider model IDs. Callers select a
// purpose-specific tier so upgrades stay deliberate and mechanically auditable.
export const AI_MODELS = Object.freeze({
  fast: "claude-haiku-4-5-20251001",
  smart: "claude-sonnet-4-6",
  deep: "claude-opus-4-8",
  escalation: "claude-fable-5-1",
  orbitDefault: "claude-sonnet-5",
});

export const ALLOWED_AI_MODELS = Object.freeze(Object.values(AI_MODELS));
