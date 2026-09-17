// The one place the model and AI switches are decided (housestyle-ai AI-2).
import Anthropic from '@anthropic-ai/sdk'

export const MODEL = process.env.ANTHROPIC_MODEL || 'claude-sonnet-5'
export const OWNER = process.env.ORBIT_OWNER_NAME || 'Scotty'
export const MAX_TOOL_ROUNDS = 8
export const HISTORY_TURNS = 20

const hasKey = () => Boolean(process.env.ANTHROPIC_API_KEY)

/** AI is on only with a key AND the Anthropic connector switched on in settings. */
export function aiStatus(settings) {
  const enabled = settings?.ai?.enabled !== false
  return { available: hasKey() && enabled, hasKey: hasKey(), enabled, model: MODEL }
}

let client = null
export function getClient() {
  if (!client) client = new Anthropic()
  return client
}
