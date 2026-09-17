import express from 'express'
import Anthropic from '@anthropic-ai/sdk'
import * as store from '../store.js'
import * as repo from '../repo.js'
import { aiStatus, getClient, HISTORY_TURNS, MAX_TOOL_ROUNDS, MODEL, OWNER } from './config.js'

// First-person claims of a save in this reply ("I've logged", "saved that", "added her").
export const CLAIMS_SAVE = /\b(i'?ve|i have|i)\s+(just\s+)?(logged|saved|added|noted|updated|recorded|flagged|set)\b|^\s*(logged|saved|added|noted|updated|recorded)\b|\b(logged|saved|added|updated) (that|those|it|them|her|him)\b/im
import { loadPrompt } from './prompts.js'
import { hasSubstance, personContext, rosterText } from './context.js'
import { checkPicture, checkQuestions, checkSayHi, stripEmoji } from './checks.js'
import { executeTool, TOOLS } from './tools.js'

/** Every interview exchange, for testing: data/chat-log.jsonl locally, agent_actions in the cloud. */
function logChat(entry) {
  store.appendLog('chat', { at: new Date().toISOString(), ...entry })
}

const fail = (code, message) => ({ ok: false, code, message })

/** Turns SDK errors into a message the user can act on. */
function explain(e) {
  if (e instanceof Anthropic.AuthenticationError) return 'The Anthropic key was rejected. Check ANTHROPIC_API_KEY in .env.'
  if (e instanceof Anthropic.PermissionDeniedError) return "This key can't use that model."
  if (e instanceof Anthropic.NotFoundError) return `Model ${MODEL} wasn't found. Check ANTHROPIC_MODEL in .env.`
  if (e instanceof Anthropic.RateLimitError) return 'Rate limited by Anthropic. Try again in a minute.'
  if (e instanceof Anthropic.APIConnectionError) return "Couldn't reach Anthropic. Check your connection."
  if (e instanceof Anthropic.APIError) return `Anthropic returned an error (${e.status}).`
  return 'Something went wrong talking to Claude.'
}

const textOf = (msg) => msg.content.filter((b) => b.type === 'text').map((b) => b.text).join('').trim()

async function ask({ prompt, context, retryNote, format, effort = 'medium', signal }) {
  const messages = [{ role: 'user', content: `Notes about this person:\n\n${context}${retryNote ? `\n\n${retryNote}` : ''}` }]
  const msg = await getClient().messages.create(
    {
      model: MODEL,
      max_tokens: 16000,
      system: prompt.text,
      output_config: { effort, ...(format ? { format } : {}) },
      messages,
    },
    { signal },
  )
  if (msg.stop_reason === 'refusal') throw Object.assign(new Error('refused'), { refusal: true })
  return msg
}

/**
 * One grounded generation with a check. A failed check gets exactly one retry that names the
 * problem; a second failure is reported, never saved.
 */
async function generate(personId, promptName, { parse, check, format, effort, audience = 'owner' }) {
  const prompt = loadPrompt(promptName)
  const context = personContext(personId, { audience })
  let retryNote = null
  for (let attempt = 0; attempt < 2; attempt++) {
    const msg = await ask({ prompt, context, retryNote, format, effort })
    const result = check(parse(msg))
    if (result.ok) return { ok: true, value: result.value, prompt }
    console.warn(`[ai] ${promptName} failed its check (${result.problem})`)
    retryNote = `Your last answer ${result.problem}. Follow the instructions exactly this time.`
  }
  return fail('ai_failed', `Claude's answer didn't pass the checks twice, so nothing was saved. Try again.`)
}

const QUESTIONS_FORMAT = {
  type: 'json_schema',
  schema: {
    type: 'object',
    properties: { questions: { type: 'array', items: { type: 'string' } } },
    required: ['questions'],
    additionalProperties: false,
  },
}

export function aiRouter() {
  const r = express.Router()

  r.use((req, res, next) => {
    if (!aiStatus(store.get('settings')).available) return res.status(503).json(fail('ai_off', 'AI is switched off.'))
    next()
  })

  // Wraps a person-scoped generator: checks the person exists and there's something to go on.
  const personRoute = (handler) => async (req, res) => {
    const id = req.body?.personId
    if (!store.get('people')[id]) return res.status(404).json(fail('not_found', 'Person not found.'))
    if (!hasSubstance(id)) {
      return res.status(422).json(fail('no_data', 'There is nothing saved about them yet. Add some info first.'))
    }
    try {
      const out = await handler(id)
      res.status(out.ok ? 200 : 502).json(out)
    } catch (e) {
      if (e.refusal) return res.status(502).json(fail('ai_failed', 'Claude declined this request.'))
      console.error('[ai]', e)
      res.status(502).json(fail('ai_failed', explain(e)))
    }
  }

  const stamp = (prompt) => ({ at: new Date().toISOString(), model: MODEL, prompt: `${prompt.name}@${prompt.version}` })

  r.post(
    '/picture',
    personRoute(async (id) => {
      const out = await generate(id, 'picture', { parse: textOf, check: checkPicture })
      if (!out.ok) return out
      const p = store.get('people')[id]
      const meta = stamp(out.prompt)
      const saved = repo.savePerson(id, { ...p, summary: out.value, summaryAt: meta.at, summaryMeta: meta })
      return saved.ok ? { ok: true, summary: out.value } : saved
    }),
  )

  r.post(
    '/questions',
    personRoute(async (id) => {
      const out = await generate(id, 'questions', {
        audience: 'them',
        format: QUESTIONS_FORMAT,
        parse: (msg) => {
          try {
            return JSON.parse(textOf(msg))
          } catch {
            return null
          }
        },
        check: checkQuestions,
      })
      if (!out.ok) return out
      const p = store.get('people')[id]
      const meta = stamp(out.prompt)
      const saved = repo.savePerson(id, { ...p, questions: out.value, questionsAt: meta.at, questionsMeta: meta })
      return saved.ok ? { ok: true, questions: out.value } : saved
    }),
  )

  // Say-hi drafts are shown for editing, not saved.
  r.post(
    '/sayhi',
    personRoute(async (id) => {
      const out = await generate(id, 'sayhi', { parse: textOf, check: checkSayHi, effort: 'low', audience: 'them' })
      return out.ok ? { ok: true, message: out.value } : out
    }),
  )

  r.post('/interview', async (req, res) => {
    const history = sanitizeHistory(req.body?.messages)
    if (!history.length || history.at(-1).role !== 'user') {
      return res.status(400).json(fail('invalid', 'Send the conversation ending with your message.'))
    }
    const controller = new AbortController()
    res.on('close', () => {
      if (!res.writableFinished) controller.abort()
    })
    const base = { session: String(req.body?.session || '').slice(0, 64), prompt: `interview@${loadPrompt('interview').version}`, model: MODEL, user: history.at(-1).content }
    try {
      const out = await interview(history, controller.signal)
      logChat({ ...base, reply: out.reply, saved: out.lines, tools: out.toolLog })
      res.json({ ok: true, reply: out.reply, lines: out.lines, wrote: out.wrote })
    } catch (e) {
      if (controller.signal.aborted) return logChat({ ...base, stopped: true })
      logChat({ ...base, error: e.message })
      console.error('[ai] interview', e)
      res.status(502).json(fail('ai_failed', e.refusal ? 'Claude declined to continue.' : explain(e)))
    }
  })

  return r
}

/** Keep only well-formed text turns, the last HISTORY_TURNS of them, starting on a user turn. */
export function sanitizeHistory(messages) {
  if (!Array.isArray(messages)) return []
  const turns = messages
    .filter((m) => (m?.role === 'user' || m?.role === 'assistant') && typeof m.content === 'string' && m.content.trim())
    .map((m) => ({ role: m.role, content: m.content.slice(0, 8000) }))
    .slice(-HISTORY_TURNS)
  while (turns.length && turns[0].role !== 'user') turns.shift()
  return turns
}

/** Manual tool loop: runs until Claude answers in words or the round cap is hit. */
async function interview(history, signal) {
  const prompt = loadPrompt('interview')
  // Stable instructions + tools are cached; the roster changes every turn, so it comes after.
  const system = [
    { type: 'text', text: prompt.text, cache_control: { type: 'ephemeral' } },
    { type: 'text', text: rosterText() },
  ]
  const messages = history.map((m) => ({ ...m }))
  const lines = []
  const toolLog = []
  let wrote = false
  let nudged = false

  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    const msg = await getClient().messages.create(
      { model: MODEL, max_tokens: 16000, system, tools: TOOLS, output_config: { effort: 'medium' }, messages },
      { signal },
    )
    if (msg.stop_reason === 'refusal') throw Object.assign(new Error('refused'), { refusal: true })
    const calls = msg.content.filter((b) => b.type === 'tool_use')
    if (msg.stop_reason !== 'tool_use' || !calls.length) {
      const reply = stripEmoji(textOf(msg)) || 'Okay.'
      // A reply that says it saved something when nothing was saved this turn gets one chance to
      // actually save it; otherwise the user is told plainly.
      if (!wrote && CLAIMS_SAVE.test(reply) && !nudged) {
        nudged = true
        messages.push({ role: 'assistant', content: msg.content })
        messages.push({
          role: 'user',
          content: `[Orbit check] Your reply says something was saved or logged, but no tool saved anything this turn. If ${OWNER} gave you something to save, call the tool now. If it was already saved earlier, say that. Then reply again.`,
        })
        continue
      }
      if (!wrote && CLAIMS_SAVE.test(reply) && nudged) {
        return { reply: `${reply}\n\n(Orbit check: nothing was saved in this reply.)`, lines, wrote, toolLog, nudged }
      }
      return { reply, lines, wrote, toolLog, nudged }
    }
    messages.push({ role: 'assistant', content: msg.content })
    const results = calls.map((call) => {
      const result = executeTool(call.name, call.input)
      toolLog.push({ tool: call.name, input: call.input, ok: result.ok, message: result.message })
      if (result.line) {
        lines.push(result.line)
        wrote = true
      }
      return { type: 'tool_result', tool_use_id: call.id, content: result.message, ...(result.ok ? {} : { is_error: true }) }
    })
    messages.push({ role: 'user', content: results })
    if (signal.aborted) break
  }
  return {
    reply: "I've saved what I could, but I had to stop there. Tell me what to pick up next.",
    lines,
    wrote,
    toolLog,
  }
}
