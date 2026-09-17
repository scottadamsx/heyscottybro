// Supabase backend for the store (DR-103). Each API request gets its own copy of the data, loaded at
// the start; repo.js changes that copy exactly as it changes the file cache, and every change the
// request made is saved in one database call before the response goes out. If the save fails, the
// caller gets the error instead of the result, so nothing looks saved when it isn't.
//
// Rows are per person / per event, so two requests that touch different records never collide;
// the same record changed twice at once keeps the later write.
import { AsyncLocalStorage } from 'node:async_hooks'

const als = new AsyncLocalStorage()
const PAGE = 1000

/** The request scope repo.js is working in, or null when running on the local files. */
export const currentScope = () => als.getStore() || null

export function createScope(state, defaults) {
  const data = {
    people: { ...state.people },
    events: { ...state.events },
    settings: { ...defaults, ...(state.settings || {}) },
  }
  const scope = {
    ops: [],
    logs: [],
    get: (name) => data[name],
    putItem(name, id, doc) {
      data[name] = { ...data[name], [id]: doc }
      scope.ops.push({ t: name, op: 'put', id, doc })
    },
    removeItem(name, id) {
      if (!(id in data[name])) return false
      const { [id]: _, ...rest } = data[name]
      data[name] = rest
      scope.ops.push({ t: name, op: 'del', id })
      return true
    },
    putSettings(doc) {
      data.settings = doc
      scope.ops.push({ t: 'settings', op: 'put', doc })
    },
    appendLog(kind, entry) {
      scope.logs.push({ kind, entry })
    },
  }
  return scope
}

/** Run fn inside a scope (tests and scripts; the HTTP path uses cloudMiddleware). */
export function runInScope(scope, fn) {
  return als.run(scope, fn)
}

/**
 * Express middleware. getClient(req) returns a client for the signed-in user or throws an error
 * carrying { status, code }. The response is held until this request's changes are saved.
 */
export function cloudMiddleware(getClient, defaults) {
  return async (req, res, next) => {
    let client
    try {
      client = await getClient(req)
    } catch (e) {
      return res.status(e.status || 401).json({ ok: false, code: e.code || 'unauthorized', message: e.message })
    }
    let state
    try {
      state = await client.load()
    } catch (e) {
      return res.status(503).json({ ok: false, code: 'network', message: `Couldn't load your Orbit data: ${e.message}` })
    }
    const scope = createScope(state, defaults)
    const send = res.json.bind(res)
    let finishing = false
    res.json = (body) => {
      if (finishing) return send(body)
      finishing = true
      finish(scope, client, body, res, send).catch((e) => {
        console.error('[cloud] finish failed', e)
        if (!res.headersSent) res.status(500).end()
      })
      return res
    }
    als.run(scope, next)
  }
}

async function finish(scope, client, body, res, send) {
  if (scope.ops.length) {
    try {
      await client.apply(scope.ops)
    } catch (e) {
      console.error('[cloud] save failed', e)
      res.status(500)
      return send({ ok: false, code: 'save_failed', message: `Not saved: ${e.message}` })
    }
  }
  if (scope.logs.length) {
    await client.log(scope.logs).catch((e) => console.warn('[cloud] could not write the audit log:', e.message))
  }
  send(body)
}

// ── Supabase REST clients ─────────────────────────────────────────────────────

async function rest(url, { method = 'GET', headers, body }) {
  let res
  try {
    res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json', ...headers },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(15000),
    })
  } catch (e) {
    throw new Error(`can't reach Supabase (${e.message})`)
  }
  const text = await res.text()
  const out = text ? JSON.parse(text) : null
  if (!res.ok) throw new Error(out?.message || `Supabase returned ${res.status}`)
  return out
}

function makeClient({ url, apiKey, bearer, userId, applyPath, applyBody }) {
  const headers = { apikey: apiKey, Authorization: `Bearer ${bearer}` }
  const uid = encodeURIComponent(userId)

  async function all(table) {
    const out = {}
    for (let offset = 0; ; offset += PAGE) {
      const rows = await rest(
        `${url}/rest/v1/${table}?select=id,doc&user_id=eq.${uid}&order=id&limit=${PAGE}&offset=${offset}`,
        { headers },
      )
      for (const r of rows) out[r.id] = r.doc
      if (rows.length < PAGE) return out
    }
  }

  return {
    userId,
    async load() {
      const [people, events, settings] = await Promise.all([
        all('orbit_people'),
        all('orbit_events'),
        rest(`${url}/rest/v1/orbit_settings?select=doc&user_id=eq.${uid}`, { headers }),
      ])
      return { people, events, settings: settings[0]?.doc || null }
    },
    apply: (ops) => rest(`${url}/rest/v1/rpc/${applyPath}`, { method: 'POST', headers, body: applyBody(ops) }),
    /** Audit rows go to heyScottyBro's agent_actions, like every other agent's. */
    log: (entries) =>
      rest(`${url}/rest/v1/agent_actions`, {
        method: 'POST',
        headers: { ...headers, Prefer: 'return=minimal' },
        body: entries.map(({ kind, entry }) => toAction(userId, kind, entry)),
      }),
  }
}

function toAction(userId, kind, entry) {
  if (kind === 'agent') {
    return {
      user_id: userId,
      agent_id: 'orbit',
      tool: entry.tool,
      collection: 'people',
      args: entry.input ?? null,
      status: entry.ok ? 'ok' : 'error',
      error: entry.ok ? null : entry.message,
    }
  }
  const { at: _at, ...rest } = entry
  return {
    user_id: userId,
    agent_id: 'orbit',
    tool: 'interview_turn',
    collection: 'people',
    args: rest,
    status: entry.error ? 'error' : 'ok',
    error: entry.error || null,
  }
}

/** Local server: the service key acts for one configured user. Keep the key in .env only. */
export function serviceClient({ url, serviceKey, userId }) {
  return makeClient({
    url,
    apiKey: serviceKey,
    bearer: serviceKey,
    userId,
    applyPath: 'orbit_apply_ops',
    applyBody: (ops) => ({ p_user: userId, ops }),
  })
}

/** Hosted: the caller's own session, so database row security applies to every read and write. */
export function userClient({ url, publicKey, token, userId }) {
  return makeClient({
    url,
    apiKey: publicKey,
    bearer: token,
    userId,
    applyPath: 'orbit_apply',
    applyBody: (ops) => ({ ops }),
  })
}

/** Checks a Supabase access token and returns the user's id. Throws { status: 401 } otherwise. */
export async function verifyUser({ url, publicKey, token }) {
  const unauthorized = (message) => Object.assign(new Error(message), { status: 401, code: 'unauthorized' })
  if (!token) throw unauthorized('Sign in to use Orbit.')
  let res
  try {
    res = await fetch(`${url}/auth/v1/user`, {
      headers: { apikey: publicKey, Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(10000),
    })
  } catch (e) {
    throw Object.assign(new Error(`can't reach Supabase (${e.message})`), { status: 503, code: 'network' })
  }
  if (!res.ok) throw unauthorized('Your session has expired. Sign in again.')
  const user = await res.json()
  if (!user?.id) throw unauthorized('Your session has expired. Sign in again.')
  return user.id
}
