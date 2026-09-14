import test, { beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { loadDraft, saveDraft, clearDraft, DRAFT_SCHEMA, JOURNAL_NEW_DRAFT, journalEditDraft } from './drafts.js';

const mem = new Map();
globalThis.localStorage = {
  getItem: (k) => (mem.has(k) ? mem.get(k) : null),
  setItem: (k, v) => { mem.set(k, String(v)); },
  removeItem: (k) => { mem.delete(k); },
};
beforeEach(() => mem.clear());

test('a saved draft round-trips', () => {
  assert.equal(saveDraft(JOURNAL_NEW_DRAFT, { title: 'Mon', entry: 'long thoughts' }), true);
  const d = loadDraft(JOURNAL_NEW_DRAFT);
  assert.deepEqual(d.fields, { title: 'Mon', entry: 'long thoughts' });
  assert.ok(!Number.isNaN(Date.parse(d.savedAt)));
});

test('blank drafts are removed, not stored', () => {
  saveDraft(JOURNAL_NEW_DRAFT, { title: 'x', entry: 'y' });
  saveDraft(JOURNAL_NEW_DRAFT, { title: '  ', entry: '' });
  assert.equal(loadDraft(JOURNAL_NEW_DRAFT), null);
});

test('clearDraft removes only its own key', () => {
  saveDraft(JOURNAL_NEW_DRAFT, { entry: 'new' });
  saveDraft(journalEditDraft(7), { entry: 'edit' });
  clearDraft(JOURNAL_NEW_DRAFT);
  assert.equal(loadDraft(JOURNAL_NEW_DRAFT), null);
  assert.equal(loadDraft(journalEditDraft(7)).fields.entry, 'edit');
});

test('an unreadable draft is moved aside, never silently dropped', () => {
  const orig = console.error; console.error = () => {};
  try {
    mem.set('draft:journal:new', '{not json');
    assert.equal(loadDraft(JOURNAL_NEW_DRAFT), null);
    assert.equal(mem.get('draft:journal:new:unreadable'), '{not json');
    mem.set('draft:journal:new', JSON.stringify({ schema: DRAFT_SCHEMA + 1, fields: { entry: 'future' } }));
    assert.equal(loadDraft(JOURNAL_NEW_DRAFT), null);
    assert.match(mem.get('draft:journal:new:unreadable'), /future/);
  } finally { console.error = orig; }
});

test('a storage failure reports false instead of pretending', () => {
  const orig = console.error; console.error = () => {};
  const set = globalThis.localStorage.setItem;
  globalThis.localStorage.setItem = () => { throw new Error('QuotaExceededError'); };
  try { assert.equal(saveDraft(JOURNAL_NEW_DRAFT, { entry: 'x' }), false); }
  finally { globalThis.localStorage.setItem = set; console.error = orig; }
});
