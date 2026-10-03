// JSON file store. The in-memory copy is the source of truth while the server runs;
// writes are debounced, atomic (temp file + rename) and backed up at most once a minute.
// With ORBIT_BACKEND=supabase each request runs in a cloudStore scope instead, and the
// get/put/remove functions below read and change that scope (see cloudStore.js).
import fs from 'node:fs/promises'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { appendFileSync } from 'node:fs'
import { currentScope } from './cloudStore.js'
import { findDuplicateEvent, findDuplicatePerson } from '../src/lib/dedupe.js'
import { validJournalEntry } from '../src/lib/journal.js'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
// ORBIT_DATA_DIR / ORBIT_SEED_DIR let tests run against a throwaway folder.
export const DATA_DIR = path.resolve(process.env.ORBIT_DATA_DIR || path.join(ROOT, 'data'))
export const SEED_DIR = path.resolve(process.env.ORBIT_SEED_DIR || path.join(ROOT, 'seed'))
export const BACKUP_DIR = path.join(DATA_DIR, 'backups')
const META = path.join(DATA_DIR, 'meta.json')

export const SCHEMA_VERSION = 1
export const COLLECTIONS = ['people', 'events', 'settings', 'journal']
const DEBOUNCE_MS = 250
const BACKUP_EVERY_MS = 60_000
const BACKUPS_KEPT = 50

export const DEFAULT_SETTINGS = { budget: { xmas: [0, 0, 0, 0], bday: [0, 0, 0, 0] } }
const EMPTY = { people: {}, events: {}, settings: DEFAULT_SETTINGS, journal: {} }
const JOURNAL_WAL = path.join(DATA_DIR, 'journal-transaction.json')

const cache = {}
const timers = {}
const queues = {}
let tmpSeq = 0
const lastBackup = {}
// Collections that exist only in memory (no data file and no seed yet) are not written
// until something changes, so dropping a seed in later still seeds on the next start.
const dirty = new Set()
export const bootInfo = { seeded: [], empty: [], dataDir: DATA_DIR }

const file = (name) => path.join(DATA_DIR, `${name}.json`)

// A broken file stops the server. Carrying on with empty data would look fine and then
// overwrite the real file on the next save.
async function readJson(p) {
  const text = await fs.readFile(p, 'utf8')
  try {
    return JSON.parse(text)
  } catch (err) {
    throw new Error(`${p} is not valid JSON (${err.message}). Fix it or restore a copy from data/backups/.`)
  }
}

async function checkSchema() {
  if (!existsSync(META)) {
    await fs.writeFile(META, JSON.stringify({ schemaVersion: SCHEMA_VERSION }, null, 2) + '\n')
    return
  }
  const { schemaVersion } = await readJson(META)
  if (schemaVersion > SCHEMA_VERSION) {
    throw new Error(`data/ is schema v${schemaVersion} but this build only knows v${SCHEMA_VERSION}. Update the app.`)
  }
  // Migrations from older versions go here, one step at a time, before bumping meta.json.
}

export async function load() {
  bootInfo.seeded = []
  bootInfo.empty = []
  for (const k of Object.keys(lastBackup)) delete lastBackup[k]
  await fs.mkdir(BACKUP_DIR, { recursive: true })
  await checkSchema()
  await recoverJournalTransaction()
  journalRecoveryRequired = false
  for (const name of COLLECTIONS) {
    if (existsSync(file(name))) {
      cache[name] = await readJson(file(name))
    } else if (existsSync(path.join(SEED_DIR, `${name}.json`))) {
      cache[name] = await readJson(path.join(SEED_DIR, `${name}.json`))
      await writeNow(name)
      bootInfo.seeded.push(name)
    } else {
      cache[name] = structuredClone(EMPTY[name])
      bootInfo.empty.push(name)
    }
  }
  cache.settings = { ...DEFAULT_SETTINGS, ...cache.settings }
  if (Object.entries(cache.journal).some(([id, entry]) => id !== entry?.id || !validJournalEntry(entry))) {
    throw new Error('journal data has an unknown schema or invalid entry; restore a backup before starting')
  }
}

async function atomicFile(target, body) {
  const tmp = `${target}.${process.pid}.${++tmpSeq}.tmp`
  const handle = await fs.open(tmp, 'w')
  try {
    await handle.writeFile(body, 'utf8')
    await handle.sync()
  } finally {
    await handle.close()
  }
  await fs.rename(tmp, target)
}

async function recoverJournalTransaction() {
  if (!existsSync(JOURNAL_WAL)) return
  const transaction = await readJson(JOURNAL_WAL)
  if (transaction.schemaVersion !== 1 || !transaction.collections ||
      !['people', 'events', 'journal'].every((n) => transaction.collections[n] && typeof transaction.collections[n] === 'object')) {
    throw new Error('journal transaction log is invalid; restore it before starting')
  }
  for (const name of ['people', 'events', 'journal']) {
    await atomicFile(file(name), JSON.stringify(transaction.collections[name], null, 2) + '\n')
  }
  await fs.unlink(JOURNAL_WAL)
}

export function get(name) {
  const scope = currentScope()
  return scope ? scope.get(name) : cache[name]
}

export function putItem(name, id, doc, options = {}) {
  const scope = currentScope()
  if (scope) return scope.putItem(name, id, doc, options)
  if (journalBusy || journalRecoveryRequired) throw new Error('Journal storage is busy or needs recovery; retry after restart.')
  cache[name] = { ...cache[name], [id]: doc }
  schedule(name)
}

export function removeItem(name, id) {
  const scope = currentScope()
  if (scope) return scope.removeItem(name, id)
  if (journalBusy || journalRecoveryRequired) throw new Error('Journal storage is busy or needs recovery; retry after restart.')
  if (!(id in cache[name])) return false
  const { [id]: _, ...rest } = cache[name]
  cache[name] = rest
  schedule(name)
  return true
}

export function putSettings(doc) {
  const scope = currentScope()
  if (scope) return scope.putSettings(doc)
  if (journalBusy || journalRecoveryRequired) throw new Error('Journal storage is busy or needs recovery; retry after restart.')
  cache.settings = doc
  schedule('settings')
}

let journalBusy = false
let journalQueue = Promise.resolve()
let journalRecoveryRequired = false

/** Durable multi-collection journal commit. A WAL is replayed before load after an interrupted write. */
export function commitJournal(checks, ops, unique = []) {
  const run = async () => {
    if (journalRecoveryRequired) throw new Error('Journal storage needs recovery; restart Orbit.')
    journalBusy = true
    try {
      await flush()
      for (const check of checks) {
        const actual = cache[check.t]?.[check.id]
        if (check.exists === true) {
          if (!actual) return { ok: false, code: 'conflict', message: 'A referenced person changed. Retry.' }
          continue
        }
        if (JSON.stringify(actual ?? null) !== JSON.stringify(check.doc ?? null)) {
          return { ok: false, code: 'conflict', message: 'Orbit changed while this entry was processing. Retry.' }
        }
      }
      for (const item of unique) {
        const duplicate = item.t === 'people'
          ? findDuplicatePerson(cache.people, item.name, item.id)
          : findDuplicateEvent(cache.events, item.doc, item.id)
        if (duplicate?.match === 'exact') return { ok: false, code: 'conflict', message: 'A matching person or event was saved while this entry processed. Retry.' }
      }
      const next = {
        people: structuredClone(cache.people),
        events: structuredClone(cache.events),
        journal: structuredClone(cache.journal),
      }
      for (const op of ops) {
        if (!['people', 'events', 'journal'].includes(op.t) || !op.id) throw new Error('invalid journal operation')
        if (op.op === 'put') next[op.t][op.id] = op.doc
        else if (op.op === 'del') delete next[op.t][op.id]
        else throw new Error('invalid journal operation')
      }
      if (Object.values(next.events).some((event) => event.people?.some((id) => !next.people[id])) ||
          Object.entries(next.people).some(([id, person]) => person.facts?.some((fact) => fact.ref && (!next.people[fact.ref] || fact.ref === id)))) {
        return { ok: false, code: 'conflict', message: 'A person reference changed. Retry.' }
      }
      let walWritten = false
      try {
        await atomicFile(JOURNAL_WAL, JSON.stringify({ schemaVersion: 1, collections: next }) + '\n')
        walWritten = true
        for (const name of ['people', 'events', 'journal']) {
          await atomicFile(file(name), JSON.stringify(next[name], null, 2) + '\n')
        }
        await fs.unlink(JOURNAL_WAL)
      } catch (e) {
        if (walWritten || existsSync(JOURNAL_WAL)) journalRecoveryRequired = true
        throw e
      }
      Object.assign(cache, next)
      for (const name of ['people', 'events', 'journal']) {
        await backup(name, JSON.stringify(next[name], null, 2) + '\n').catch(() => {})
      }
      return { ok: true }
    } finally {
      journalBusy = false
    }
  }
  const pending = journalQueue.then(run)
  journalQueue = pending.catch(() => {})
  return pending
}

/** Audit trails: data/<kind>-log.jsonl locally, heyScottyBro's agent_actions in the cloud. Never throws. */
export function appendLog(kind, entry) {
  const scope = currentScope()
  if (scope) return scope.appendLog(kind, entry)
  try {
    appendFileSync(path.join(DATA_DIR, `${kind}-log.jsonl`), JSON.stringify(entry) + '\n')
  } catch (e) {
    console.warn(`[store] could not write the ${kind} log:`, e.message)
  }
}

function schedule(name) {
  dirty.add(name)
  clearTimeout(timers[name])
  timers[name] = setTimeout(() => writeNow(name).catch((e) => console.error('[store] write failed', name, e)), DEBOUNCE_MS)
}

// Writes to one file run one at a time, and each writes whatever is current when it starts,
// so the last file on disk is always the latest state.
function writeNow(name) {
  clearTimeout(timers[name])
  dirty.delete(name)
  queues[name] = (queues[name] || Promise.resolve()).catch(() => {}).then(() => writeFile(name))
  return queues[name]
}

async function writeFile(name) {
  const body = JSON.stringify(cache[name], null, 2) + '\n'
  const tmp = `${file(name)}.${process.pid}.${++tmpSeq}.tmp`
  await fs.writeFile(tmp, body, 'utf8')
  await fs.rename(tmp, file(name))
  await backup(name, body)
}

async function backup(name, body) {
  const now = Date.now()
  if (lastBackup[name] && now - lastBackup[name] < BACKUP_EVERY_MS) return
  lastBackup[name] = now
  const stamp = localStamp(new Date(now))
  await fs.writeFile(path.join(BACKUP_DIR, `${name}-${stamp}.json`), body, 'utf8')
  const mine = (await fs.readdir(BACKUP_DIR)).filter((f) => f.startsWith(`${name}-`) && f.endsWith('.json')).sort()
  for (const old of mine.slice(0, Math.max(0, mine.length - BACKUPS_KEPT))) {
    await fs.unlink(path.join(BACKUP_DIR, old)).catch(() => {})
  }
}

function localStamp(d) {
  const p = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}-${p(d.getMinutes())}-${p(d.getSeconds())}`
}

export async function flush() {
  await Promise.all([...dirty].map(writeNow))
  await Promise.all(Object.values(queues))
}

/** Backups on disk, newest first. */
export async function listBackups() {
  const files = await fs.readdir(BACKUP_DIR).catch(() => [])
  return files.filter((f) => f.endsWith('.json')).sort().reverse()
}
