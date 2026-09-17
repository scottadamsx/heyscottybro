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

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
// ORBIT_DATA_DIR / ORBIT_SEED_DIR let tests run against a throwaway folder.
export const DATA_DIR = path.resolve(process.env.ORBIT_DATA_DIR || path.join(ROOT, 'data'))
export const SEED_DIR = path.resolve(process.env.ORBIT_SEED_DIR || path.join(ROOT, 'seed'))
export const BACKUP_DIR = path.join(DATA_DIR, 'backups')
const META = path.join(DATA_DIR, 'meta.json')

export const SCHEMA_VERSION = 1
export const COLLECTIONS = ['people', 'events', 'settings']
const DEBOUNCE_MS = 250
const BACKUP_EVERY_MS = 60_000
const BACKUPS_KEPT = 50

export const DEFAULT_SETTINGS = { budget: { xmas: [0, 0, 0, 0], bday: [0, 0, 0, 0] } }
const EMPTY = { people: {}, events: {}, settings: DEFAULT_SETTINGS }

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
}

export function get(name) {
  const scope = currentScope()
  return scope ? scope.get(name) : cache[name]
}

export function putItem(name, id, doc) {
  const scope = currentScope()
  if (scope) return scope.putItem(name, id, doc)
  cache[name] = { ...cache[name], [id]: doc }
  schedule(name)
}

export function removeItem(name, id) {
  const scope = currentScope()
  if (scope) return scope.removeItem(name, id)
  if (!(id in cache[name])) return false
  const { [id]: _, ...rest } = cache[name]
  cache[name] = rest
  schedule(name)
  return true
}

export function putSettings(doc) {
  const scope = currentScope()
  if (scope) return scope.putSettings(doc)
  cache.settings = doc
  schedule('settings')
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
