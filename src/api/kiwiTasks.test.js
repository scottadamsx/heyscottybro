import test from 'node:test';
import assert from 'node:assert/strict';
import { createHandler, todayInStJohns, taskInput } from '../../api/kiwi-tasks.js';
const env = { SUPABASE_URL: 'https://example.supabase.co', SUPABASE_ANON_KEY: 'sb_publishable_test' };
const requestId = '12345678-1234-4123-8123-123456789012';
const rows = [];
const fetchImpl = async (address, options) => {
  const url = new URL(address);
  const user = options.headers.Authorization?.replace('Bearer ', '');
  if (url.pathname === '/auth/v1/user') return Response.json(user === 'expired' ? {} : { id: user }, { status: user === 'expired' ? 401 : 200 });
  if (options.method === 'POST') {
    const row = JSON.parse(options.body);
    assert.equal(row.user_id, user);
    if (rows.some(r => r.id === row.id)) return Response.json({}, { status: 409 });
    rows.push(row); return Response.json([row], { status: 201 });
  }
  assert.equal(url.searchParams.get('user_id'), `eq.${user}`);
  return Response.json(rows.filter(r => r.user_id === user && (!url.searchParams.has('id') || `eq.${r.id}` === url.searchParams.get('id'))));
};
const handler = createHandler({ env, fetchImpl, now: () => new Date('2026-09-13T01:00:00Z') });
async function call(method, user, body, query) {
  const res = { setHeader() {}, status(n) { this.code = n; return this; }, json(data) { this.data = data; return this; } };
  return handler({ method, headers: { authorization: user ? `Bearer ${user}` : undefined }, body, query }, res);
}
test('St Johns day differs from UTC around midnight, including winter', () => {
  assert.equal(todayInStJohns(new Date('2026-09-13T01:00:00Z')), '2026-09-12');
  assert.equal(todayInStJohns(new Date('2026-01-13T03:00:00Z')), '2026-01-12');
});
test('missing and expired sessions cannot access tasks', async () => {
  assert.equal((await call('GET')).code, 401);
  assert.equal((await call('POST', 'expired', { name: 'x', requestId })).code, 401);
});
test('create is scoped, visible to same user, and duplicate delivery returns same row', async () => {
  const body = { name: 'Synthetic task', requestId };
  const first = await call('POST', 'user-a', body);
  const again = await call('POST', 'user-a', body);
  assert.equal(first.code, 201); assert.equal(again.code, 200);
  assert.equal(first.data.task.id, again.data.task.id);
  assert.equal((await call('GET', 'user-a')).data.tasks.length, 1);
  assert.equal((await call('GET', 'user-b')).data.tasks.length, 0);
  const second = await call('POST', 'user-b', body);
  assert.notEqual(second.data.task.id, first.data.task.id);
  assert.equal((await call('POST', 'user-a', { ...body, name: 'different' })).code, 409);
});
test('rejects claimed user identity, invalid dates and oversized names', () => {
  assert.throws(() => taskInput({ name: 'x', requestId, user_id: 'other' }, '2026-09-12'));
  assert.throws(() => taskInput({ name: 'x', requestId, date: '2026-02-30' }, '2026-09-12'));
  assert.throws(() => taskInput({ name: 'x'.repeat(301), requestId }, '2026-09-12'));
});
test('privileged key is never exposed as connection config', async () => {
  const fn = createHandler({ env: { ...env, SUPABASE_ANON_KEY: 'sb_secret_bad' }, fetchImpl });
  const res = { setHeader() {}, status(n) { this.code = n; return this; }, json(data) { this.data = data; return this; } };
  await fn({ method: 'GET', query: { config: '1' }, headers: {} }, res);
  assert.equal(res.code, 503); assert.equal(res.data.key, undefined);
});
test('today includes recurring occurrences and reports truncation honestly', async () => {
  const fixture = Array.from({ length: 101 }, (_, index) => ({ id: String(index), name: `Task ${index}`, date: '2026-09-05', recurrence: 'weekly', completed: false }));
  const fn = createHandler({ env, now: () => new Date('2026-09-12T14:00:00Z'), fetchImpl: async (url, options) => {
    if (url.includes('/auth/v1/')) return Response.json({ id: 'a' });
    assert.equal(new URL(url).searchParams.get('limit'), '501');
    assert.equal(options.headers.Authorization, 'Bearer a');
    return Response.json(fixture);
  } });
  const res = { setHeader() {}, status(n) { this.code = n; return this; }, json(data) { this.data = data; return this; } };
  await fn({ method: 'GET', headers: { authorization: 'Bearer a' } }, res);
  assert.equal(res.data.tasks.length, 100); assert.equal(res.data.truncated, true);
  fixture.push(...Array.from({ length: 400 }, () => fixture[0]));
  await fn({ method: 'GET', headers: { authorization: 'Bearer a' } }, res);
  assert.equal(res.code, 422);
});
test('canonical Today also returns undated tasks under Anytime', async () => {
  const fn = createHandler({ env, fetchImpl: async url => {
    if (url.includes('/auth/v1/')) return Response.json({ id: 'a' });
    assert.match(new URL(url).searchParams.get('or'), /date.is.null/);
    return Response.json([{ id: 'undated', name: 'Buy shampoo', date: null, completed: false }]);
  } });
  const res = { setHeader() {}, status(n) { this.code = n; return this; }, json(data) { this.data = data; return this; } };
  await fn({ method: 'GET', headers: { authorization: 'Bearer a' } }, res);
  assert.equal(res.data.tasks.length, 0);
  assert.equal(res.data.anytime[0].name, 'Buy shampoo');
});
