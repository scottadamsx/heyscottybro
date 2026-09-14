import test from 'node:test';
import assert from 'node:assert/strict';
import { journalToMarkdown, journalExportFilename } from './journalExport.js';
import { formatDisplayDate } from './plannerUtils.js';

const entries = [
  { id: 2, date: '2026-09-14', title: 'Sunday thoughts', entry: 'Second.\n\nTwo paragraphs.' },
  { id: 1, date: '2026-09-01', title: formatDisplayDate('2026-09-01'), entry: '  First.  ' },
];

test('exports every entry, oldest first, with a header', () => {
  const md = journalToMarkdown(entries, new Date(2026, 8, 14));
  assert.match(md, /^# Journal\n\nExported September 14, 2026 · 2 entries\n/);
  assert.ok(md.indexOf('First.') < md.indexOf('Second.'));
  assert.match(md, /Two paragraphs\./);
  assert.equal((md.match(/^---$/gm) || []).length, 2);
});

test('titled entries keep their title plus a full dated line', () => {
  const md = journalToMarkdown(entries);
  assert.match(md, /## Sunday thoughts\n\n\*Monday, September 14, 2026\*\n\nSecond\./);
});

test('default (date) titles become one full-date heading, not a duplicate', () => {
  const md = journalToMarkdown(entries);
  assert.match(md, /## Tuesday, September 1, 2026\n\nFirst\.\n/);
});

test('an empty journal still produces a valid document', () => {
  assert.equal(journalToMarkdown([], new Date(2026, 8, 14)), '# Journal\n\nExported September 14, 2026 · 0 entries\n');
});

test('filename is dated', () => {
  assert.equal(journalExportFilename(new Date(2026, 8, 4)), 'journal-2026-09-04.md');
});
