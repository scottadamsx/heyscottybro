// Talks to Orbit's API (server/app.js): the local server through the /api proxy, or the hosted
// copy inside heyScottyBro (see lib/runtime.js). The server decides whether data lives in files or Supabase.
import { apiHeaders, apiUrl } from '../runtime.js'

const listeners = new Set()
const statusListeners = new Set()
let pending = 0
let status = 'saved' // saved | saving | error

function setStatus(next) {
  if (next === status) return
  status = next
  statusListeners.forEach((cb) => cb(status))
}

/** Thrown for any rejected write. `code` is invalid | duplicate | not_found | bad_id | network. */
export class StorageError extends Error {
  constructor(code, message, extra = {}) {
    super(message)
    this.code = code
    Object.assign(this, extra)
  }
}

async function request(method, path, body) {
  let res
  try {
    res = await fetch(apiUrl(path), {
      method,
      headers: { ...(await apiHeaders()), ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
  } catch (err) {
    throw new StorageError('network', `Can't reach the data server (${err.message})`)
  }
  const out = await res.json().catch(() => ({}))
  if (!res.ok) throw new StorageError(out.code || 'network', out.message || `${method} ${path} failed: ${res.status}`, out)
  return out
}

async function write(method, url, body, change) {
  pending++
  setStatus('saving')
  try {
    const out = await request(method, url, body)
    pending--
    if (pending === 0) setStatus('saved')
    listeners.forEach((cb) => cb(change))
    return out
  } catch (err) {
    pending--
    setStatus('error')
    throw err
  }
}

const item = (collection, id, opts = {}) =>
  `/${collection}/${encodeURIComponent(id)}${opts.allowDuplicate ? '?allowDuplicate=1' : ''}`

export const fileAdapter = {
  name: 'file',

  listPeople: () => request('GET', '/people'),
  /** opts.allowDuplicate: save even though someone with this exact name exists (the user said so). */
  savePerson: (id, doc, opts) => write('PUT', item('people', id, opts), doc, { collection: 'people', id, op: 'save' }),
  /** Also strips them from events; events left with nobody are removed. */
  deletePerson: (id) => write('DELETE', item('people', id), undefined, { collection: 'people', id, op: 'delete' }),
  deletePersonImpact: (id) => request('GET', `${item('people', id)}/impact`),

  listEvents: () => request('GET', '/events'),
  saveEvent: (id, doc, opts) => write('PUT', item('events', id, opts), doc, { collection: 'events', id, op: 'save' }),
  deleteEvent: (id) => write('DELETE', item('events', id), undefined, { collection: 'events', id, op: 'delete' }),

  /** Fold one record into another; both lists change, so listeners reload everything. */
  mergePeople: (keep, drop) => write('POST', '/people/merge', { keep, drop }, { collection: 'all', op: 'merge' }),
  mergeEvents: (keep, drop) => write('POST', '/events/merge', { keep, drop }, { collection: 'events', op: 'merge' }),

  getSettings: () => request('GET', '/settings'),
  saveSettings: (doc) => write('PUT', '/settings', doc, { collection: 'settings', op: 'save' }),

  /** Preview (apply=false) or save an import; returns the plan summary. */
  importData: (data, apply) =>
    apply ? write('POST', '/import?apply=1', data, { collection: 'all', op: 'import' }) : request('POST', '/import', data),
  /** Possible duplicates and broken references across the whole dataset. */
  audit: () => request('GET', '/audit'),
  /** Server facts for the Settings page: data folder, backups, schema version, AI status. */
  health: () => request('GET', '/health'),
  /** Everything, as one JSON document (for the Export button). */
  exportData: () => request('GET', '/export'),

  /** cb({ collection, id, op }) after every successful write. Returns an unsubscribe fn. */
  subscribe(cb) {
    listeners.add(cb)
    return () => listeners.delete(cb)
  },

  /** cb('saved' | 'saving' | 'error') whenever the sync state changes. */
  subscribeStatus(cb) {
    statusListeners.add(cb)
    cb(status)
    return () => statusListeners.delete(cb)
  },
}
