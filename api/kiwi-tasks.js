import { createHash } from 'node:crypto';
import { remindersForDay, undatedReminders } from '../src/utils/plannerUtils.js';

const FIELDS = 'id,name,date,time,description,recurrence,recur_until,recur_times,completed,completed_date,show_on_calendar';
export function todayInStJohns(now = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/St_Johns', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
}
function publicConfig(env) {
  const url = env.SUPABASE_URL || env.VITE_SUPABASE_URL;
  const key = env.SUPABASE_ANON_KEY || env.VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY || env.VITE_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error('Shared tasks are not configured.');
  // Never publish a mistakenly assigned privileged JWT.
  if (key.startsWith('sb_secret_')) throw new Error('A public Supabase key is required.');
  if (key.split('.').length === 3) {
    const claims = JSON.parse(Buffer.from(key.split('.')[1], 'base64url').toString());
    if (claims.role !== 'anon') throw new Error('A public Supabase key is required.');
  }
  return { url: url.replace(/\/$/, ''), key };
}
export function taskId(userId, requestId) {
  const h = createHash('sha256').update(`${userId}:${requestId}`).digest('hex');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-8${h.slice(17, 20)}-${h.slice(20, 32)}`;
}
export function taskInput(body, today) {
  if (!body || Object.keys(body).some(k => !['name', 'date', 'requestId'].includes(k))) throw new Error('Only name, date and requestId are accepted.');
  if (typeof body.name !== 'string' || !body.name.trim() || body.name.length > 300) throw new Error('Task name must contain 1–300 characters.');
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(body.requestId || '')) throw new Error('A request UUID is required.');
  const date = body.date || today;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(Date.parse(date)) || new Date(date).toISOString().slice(0, 10) !== date) throw new Error('Use a valid YYYY-MM-DD date.');
  return { name: body.name.trim(), date, recurrence: 'none', completed: false, show_on_calendar: true };
}
export function createHandler({ env = process.env, fetchImpl = fetch, now = () => new Date() } = {}) {
  return async (req, res) => {
    res.setHeader('Cache-Control', 'private, no-store');
    if (!['GET', 'POST'].includes(req.method)) return res.status(405).json({ error: 'Method not allowed' });
    try {
      const { url, key } = publicConfig(env);
      if (req.method === 'GET' && req.query?.config === '1') return res.status(200).json({ url, key });
      const authorization = req.headers.authorization;
      if (!/^Bearer \S+$/i.test(authorization || '')) return res.status(401).json({ error: 'Sign in to Hey Scotty Bro.' });
      const headers = { apikey: key, Authorization: authorization, 'Content-Type': 'application/json' };
      const auth = await fetchImpl(`${url}/auth/v1/user`, { headers, signal: AbortSignal.timeout(15000) });
      if (!auth.ok) return res.status(401).json({ error: 'Session expired. Sign in again.' });
      const user = await auth.json();
      if (!user.id) return res.status(401).json({ error: 'Invalid session.' });
      const rest = async (query, options = {}) => fetchImpl(`${url}/rest/v1/reminders?${query}`, { ...options, headers: { ...headers, ...options.headers }, signal: AbortSignal.timeout(15000) });
      const today = todayInStJohns(now());
      const scoped = new URLSearchParams({ user_id: `eq.${user.id}`, select: FIELDS });
      if (req.method === 'GET') {
        scoped.set('completed', 'eq.false'); scoped.set('or', `(date.lte.${today},date.is.null)`);
        scoped.set('order', 'date.asc,id.asc'); scoped.set('limit', '501');
        const response = await rest(scoped);
        if (!response.ok) throw new Error('Could not load tasks. Please retry.');
        const rows = await response.json();
        if (rows.length > 500) return res.status(422).json({ error: 'Too many pending tasks for this view. Open Hey Scotty Bro to review them.' });
        const tasks = remindersForDay(rows, today);
        const anytime = undatedReminders(rows);
        return res.status(200).json({ date: today, timeZone: 'America/St_Johns', tasks: tasks.slice(0, 100), anytime: anytime.slice(0, 100), truncated: tasks.length > 100 || anytime.length > 100 });
      }
      let body;
      try {
        if (Buffer.byteLength(typeof req.body === 'string' ? req.body : JSON.stringify(req.body || {})) > 4096) throw new Error('Request too large.');
        body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
        body = { input: taskInput(body, today), requestId: body.requestId };
      } catch (error) { return res.status(400).json({ error: error.message }); }
      const id = taskId(user.id, body.requestId);
      scoped.set('id', `eq.${id}`);
      const inserted = await rest(new URLSearchParams({ select: FIELDS }), { method: 'POST', headers: { Prefer: 'return=representation' }, body: JSON.stringify({ ...body.input, id, user_id: user.id }) });
      if (inserted.ok) return res.status(201).json({ task: (await inserted.json())[0] });
      if (inserted.status !== 409) throw new Error('Save was not confirmed. Retry the same request.');
      const existing = await rest(scoped);
      if (!existing.ok) throw new Error('Save was not confirmed. Retry the same request.');
      const [task] = await existing.json();
      if (!task || task.name !== body.input.name || task.date !== body.input.date) return res.status(409).json({ error: 'This request ID was already used for a different task.' });
      return res.status(200).json({ task });
    } catch (error) { return res.status(503).json({ error: error.message || 'Shared tasks unavailable.' }); }
  };
}
export default createHandler();
