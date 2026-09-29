import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';

test('Vercel Hobby function entries stay within the twelve-function limit', () => {
  const entries = readdirSync(new URL('../api/', import.meta.url))
    .filter(name => name.endsWith('.js') && !name.startsWith('_'))
    .sort();

  assert.ok(entries.length <= 12, `Expected at most 12 deployable API functions, found ${entries.length}: ${entries.join(', ')}`);
});

test('the public Kiwi tasks path rewrites to the shared fetch function', () => {
  const config = JSON.parse(readFileSync(new URL('../vercel.json', import.meta.url), 'utf8'));
  const rewrite = config.rewrites.find(entry => entry.source === '/api/kiwi-tasks');

  assert.deepEqual(rewrite, {
    source: '/api/kiwi-tasks',
    destination: '/api/fetch?__hsp_route=kiwi-tasks',
  });
});
