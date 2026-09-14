import test from 'node:test';
import assert from 'node:assert/strict';
import { overdueReminders, canReschedule, reschedulePatch, suggestDays, addDays } from './reschedule.js';

const T = '2026-09-14';

test('overdue = unfinished one-off tasks due before today, oldest first', () => {
  const rs = [
    { id: 1, date: '2026-09-10', completed: false },
    { id: 2, date: '2026-09-02', completed: false, recurrence: 'none' },
    { id: 3, date: '2026-09-01', completed: true },
    { id: 4, date: '2026-09-05', completed: false, recurrence: 'weekly' },
    { id: 5, date: T, completed: false },
    { id: 6, completed: false },
  ];
  assert.deepEqual(overdueReminders(rs, T).map((r) => r.id), [2, 1]);
});

test('a task moves by date only; time only when asked', () => {
  const r = { id: 1, date: '2026-09-10', time: '09:00' };
  assert.deepEqual(reschedulePatch(r, 'task', '2026-09-16'), { date: '2026-09-16' });
  assert.deepEqual(reschedulePatch(r, 'task', '2026-09-16', { time: '14:30' }), { date: '2026-09-16', time: '14:30' });
  assert.deepEqual(reschedulePatch(r, 'task', '2026-09-16', { time: '' }), { date: '2026-09-16', time: null });
});

test('an event keeps its span and its duration', () => {
  const e = { id: 9, date: '2026-09-23', end_date: '2026-09-27', start_time: '09:00', end_time: '10:30' };
  assert.deepEqual(reschedulePatch(e, 'event', '2026-09-30'), { date: '2026-09-30', end_date: '2026-10-04' });
  assert.deepEqual(reschedulePatch(e, 'event', '2026-09-30', { time: '13:15' }), { date: '2026-09-30', end_date: '2026-10-04', start_time: '13:15', end_time: '14:45' });
});

test('repeating items and bad dates are refused', () => {
  assert.equal(canReschedule({ date: T, recurrence: 'daily' }), false);
  assert.equal(reschedulePatch({ date: T, recurrence: 'daily' }, 'task', '2026-09-20'), null);
  assert.equal(reschedulePatch({ date: T }, 'task', 'Sep 20'), null);
  assert.equal(canReschedule({ recurrence: 'none' }), false);
});

test('suggested days are the lightest upcoming days, in date order', () => {
  const load = { [addDays(T, 1)]: 3, [addDays(T, 2)]: 0, [addDays(T, 3)]: 1, [addDays(T, 4)]: 0 };
  assert.deepEqual(suggestDays(T, load, { span: 4, pick: 2 }), [{ date: '2026-09-16', load: 0 }, { date: '2026-09-18', load: 0 }]);
});

test('addDays crosses month ends', () => {
  assert.equal(addDays('2026-09-30', 1), '2026-10-01');
  assert.equal(addDays('2026-03-01', -1), '2026-02-28');
});

import { dayBlocks, overlapsWith, firstFreeSlot, itemDuration, snap, DAY_START } from './reschedule.js';

test('durations: task uses duration_min (30 default), event uses its end', () => {
  assert.equal(itemDuration({ duration_min: 45 }, 'task'), 45);
  assert.equal(itemDuration({}, 'task'), 30);
  assert.equal(itemDuration({ start_time: '09:00', end_time: '10:30' }, 'event'), 90);
  assert.equal(itemDuration({ start_time: '09:00' }, 'event'), 60);
});

test('patch carries a task duration and an event end time', () => {
  assert.deepEqual(reschedulePatch({ date: T }, 'task', '2026-09-16', { time: '10:00', duration: 45 }), { date: '2026-09-16', time: '10:00', duration_min: 45 });
  assert.deepEqual(reschedulePatch({ date: T, start_time: '09:00', end_time: '10:00' }, 'event', '2026-09-16', { time: '11:00', duration: 90 }), { date: '2026-09-16', start_time: '11:00', end_time: '12:30' });
});

test('day blocks split timed from all-day and skip the item itself', () => {
  const d = '2026-09-16';
  const { timed, allDay } = dayBlocks(d,
    [{ id: 1, name: 'Timed', time: '09:00', duration_min: 60 }, { id: 2, name: 'Anytime' }, { id: 3, name: 'Me', time: '10:00' }],
    [{ id: 7, title: 'Sync', date: d, start_time: '14:30', end_time: '15:00' }, { id: 8, title: 'Trip', date: '2026-09-15' }],
    3);
  assert.deepEqual(timed.map((b) => [b.title, b.start, b.end]), [['Timed', 540, 600], ['Sync', 870, 900]]);
  assert.deepEqual(allDay.map((b) => b.title).sort(), ['Anytime', 'Trip']);
});

test('overlap + first free slot respect existing blocks', () => {
  const timed = [{ title: 'A', start: 540, end: 600 }, { title: 'B', start: 600, end: 660 }];
  assert.deepEqual(overlapsWith(570, 30, timed).map((b) => b.title), ['A']);
  assert.equal(overlapsWith(660, 30, timed).length, 0);
  assert.equal(firstFreeSlot(30, timed, 540), 660);
  assert.equal(firstFreeSlot(45, timed, 500), 660);   // 510 would run into A
  assert.equal(firstFreeSlot(30, timed, 480), 480);   // fits before A
  assert.equal(firstFreeSlot(30, [], 0), DAY_START);  // never before the timeline starts
  assert.equal(firstFreeSlot(60 * 18, [], DAY_START), null);
  assert.equal(snap(532), 525);
  assert.equal(snap(538), 540);
});
