import express from 'express'
import * as store from './store.js'
import * as repo from './repo.js'
import { auditData } from '../src/lib/dedupe.js'
import { aiRouter } from './ai/routes.js'
import { aiStatus } from './ai/config.js'
import { applyImport, planImport } from './importer.js'
import { cloudMiddleware } from './cloudStore.js'

const STATUS = { invalid: 400, bad_id: 400, duplicate: 409, not_found: 404, no_data: 422, ai_off: 503, ai_failed: 502 }

export const send = (res, out) => res.status(out.ok ? 200 : STATUS[out.code] || 400).json(out)
const allowDuplicate = (req) => req.query.allowDuplicate === '1'

/**
 * base: where the API is mounted ('/api' locally, '/api/orbit' inside heyScottyBro).
 * localOnly: refuse anything that isn't from this machine (the local server).
 * cloud: { getClient(req) } to run every request against Supabase instead of data/ (cloudStore.js).
 */
export function createApp({ base = '/api', localOnly = true, cloud = null } = {}) {
  const app = express()
  app.disable('x-powered-by')
  app.use(express.json({ limit: '5mb' }))

  // Only this machine may use the API. The Host check stops DNS-rebinding pages from reading your data;
  // the Origin check stops other sites from posting into it while the server is running.
  const LOCAL = /^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/
  if (localOnly) app.use(base, (req, res, next) => {
    if (!LOCAL.test(req.get('host') || '')) {
      return res.status(403).json({ ok: false, code: 'forbidden', message: 'local requests only' })
    }
    const origin = req.get('origin')
    if (req.method !== 'GET' && origin && !/^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/.test(origin)) {
      return res.status(403).json({ ok: false, code: 'forbidden', message: 'cross-origin write refused' })
    }
    next()
  })
  if (cloud) app.use(base, cloudMiddleware(cloud.getClient, store.DEFAULT_SETTINGS))

  const api = express.Router()
  app.use(base, api)

  api.get('/health', async (_req, res) => {
    res.json({
      ok: true,
      ai: aiStatus(store.get('settings')),
      seeded: store.bootInfo.seeded,
      empty: store.bootInfo.empty,
      storage: cloud ? 'supabase' : 'file',
      dataDir: cloud ? 'Supabase (orbit_people, orbit_events, orbit_settings)' : store.bootInfo.dataDir,
      backups: cloud ? null : (await store.listBackups()).length,
      schemaVersion: store.SCHEMA_VERSION,
    })
  })

  api.get('/audit', (_req, res) => res.json(auditData(store.get('people'), store.get('events'))))
  api.get('/export', (_req, res) => {
    const stamp = new Date().toISOString().slice(0, 10)
    res.setHeader('Content-Disposition', `attachment; filename="orbit-export-${stamp}.json"`)
    res.json({
      schemaVersion: store.SCHEMA_VERSION,
      exportedAt: new Date().toISOString(),
      people: store.get('people'),
      events: store.get('events'),
      settings: store.get('settings'),
    })
  })

  api.get('/people', (_req, res) => res.json(store.get('people')))
  api.put('/people/:id', (req, res) => send(res, repo.savePerson(req.params.id, req.body, { allowDuplicate: allowDuplicate(req) })))
  api.get('/people/:id/impact', (req, res) => res.json(repo.deletePersonImpact(req.params.id)))
  api.delete('/people/:id', (req, res) => send(res, repo.deletePerson(req.params.id)))
  api.post('/people/merge', (req, res) => send(res, repo.mergePeople(req.body?.keep, req.body?.drop)))

  api.get('/events', (_req, res) => res.json(store.get('events')))
  api.put('/events/:id', (req, res) => send(res, repo.saveEvent(req.params.id, req.body, { allowDuplicate: allowDuplicate(req) })))
  api.delete('/events/:id', (req, res) => send(res, repo.deleteEvent(req.params.id)))
  api.post('/events/merge', (req, res) => send(res, repo.mergeEvents(req.body?.keep, req.body?.drop)))

  api.get('/settings', (_req, res) => res.json(store.get('settings')))
  api.put('/settings', (req, res) => send(res, repo.saveSettings(req.body)))

  // Import: always plans; saves only with ?apply=1 (the plan is rebuilt at apply time, never trusted from the client).
  api.post('/import', (req, res) => {
    const { plan, questions } = planImport(req.body)
    const summary = {
      create: plan.create.map((c) => c.name),
      update: plan.update.map((u) => ({ name: u.name, changes: u.changes })),
      unchanged: plan.unchanged,
      hold: plan.hold,
      events: { create: plan.events.create.map((e) => `${e.date} ${e.title}`), update: plan.events.update.map((e) => e.title), skip: plan.events.skip },
      questions,
    }
    if (req.query.apply !== '1') return res.json({ ok: true, applied: false, ...summary })
    const result = applyImport(plan)
    res.json({ ok: result.failed.length === 0, applied: true, ...summary, result })
  })

  api.use('/ai', aiRouter())

  api.use((_req, res) => res.status(404).json({ ok: false, code: 'not_found', message: 'not found' }))
  // Malformed JSON bodies and anything unexpected come back in the same error shape.
  app.use((err, _req, res, _next) => {
    const bad = err.type === 'entity.parse.failed'
    if (!bad) console.error('[api]', err)
    res.status(bad ? 400 : 500).json({ ok: false, code: bad ? 'invalid' : 'server', message: bad ? 'body is not valid JSON' : 'server error' })
  })
  return app
}
