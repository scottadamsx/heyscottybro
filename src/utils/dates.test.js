import test from 'node:test';
import assert from 'node:assert/strict';
import { formatDisplayDate, formatShortDate, formatDisplayDateTime, toDateStr } from './dates.js';

test('all shared date labels use the preferred format and keep stored years', () => {
  assert.equal(formatDisplayDate('2026-01-15'), 'Thursday, Jan 15th');
  assert.equal(formatShortDate('2026-01-15'), 'Thursday, Jan 15th');
  assert.equal(toDateStr(new Date(2026, 0, 15)), '2026-01-15');
  assert.match(formatDisplayDateTime(new Date(2026, 0, 15, 13, 5)), /^Thursday, Jan 15th · 1:05 PM$/);
  assert.equal(formatDisplayDate(''), '');
});
test('ordinals include the teen exceptions', () => {
  for (const [day, suffix] of [[1,'st'],[2,'nd'],[3,'rd'],[11,'th'],[12,'th'],[13,'th'],[21,'st'],[22,'nd'],[23,'rd'],[31,'st']]) {
    assert.ok(formatDisplayDate(`2026-01-${String(day).padStart(2,'0')}`).endsWith(`Jan ${day}${suffix}`));
  }
});

test('date format settings keep weekdays, ordinal days and omit years', () => {
  assert.equal(formatDisplayDate('2026-01-15', 'full-month'), 'Thursday, January 15th');
  assert.equal(formatDisplayDate('2026-01-15', 'unknown'), 'Thursday, Jan 15th');
});
