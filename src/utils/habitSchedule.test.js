import test from 'node:test';
import assert from 'node:assert/strict';
import { dueHabits, addHabitDays, habitScheduleLabel, habitScheduleForm, scheduleFromForm, validateHabitSchedule } from './habitSchedule.js';
const tracker = (every, unit = 'days') => ({ id: 'habit', name: 'Laundry', mode: 'check', schedule: { schema: 1, kind: 'interval', every, unit, startDate: '2026-09-01' } });
const log = date => ({ id: date, trackerId: 'habit', date });
for (const [every, unit, due] of [[5, 'days', '2026-09-06'], [1, 'weeks', '2026-09-08'], [2, 'weeks', '2026-09-15']]) {
  test(`completion rolls every ${every} ${unit}`, () => {
    const state = { trackers: [tracker(every, unit)], logs: [log('2026-09-01')] };
    assert.equal(dueHabits(state, '2026-09-02').length, 0);
    assert.equal(dueHabits(state, due)[0].dueDate, due);
    assert.equal(dueHabits(state, due)[0].overdue, false);
    const overdue = dueHabits(state, '2026-10-30');
    assert.equal(overdue.length, 1); assert.equal(overdue[0].dueDate, due); assert.equal(overdue[0].overdue, true);
    state.logs.push(log('2026-10-30'));
    assert.equal(dueHabits(state, '2026-10-30').length, 0);
    state.logs.pop();
    assert.equal(dueHabits(state, '2026-10-30')[0].dueDate, due);
  });
}
test('calendar arithmetic crosses DST, month, leap day and year boundaries', () => {
  assert.equal(addHabitDays('2026-03-07', 5), '2026-03-12');
  assert.equal(addHabitDays('2026-10-31', 7), '2026-11-07');
  assert.equal(addHabitDays('2028-02-27', 5), '2028-03-03');
  assert.equal(addHabitDays('2026-12-29', 5), '2027-01-03');
});
test('legacy checks are daily; counters default to no reminders; undo restores due', () => {
  const state = { trackers: [{ id: 'habit', mode: 'check', created: '2026-09-01' }, { id: 'counter', mode: 'count' }], logs: [] };
  assert.equal(dueHabits(state, '2026-09-02').length, 1);
  state.logs.push(log('2026-09-02'));
  assert.equal(dueHabits(state, '2026-09-02').length, 0);
  assert.equal(dueHabits(state, '2026-09-03')[0].dueDate, '2026-09-03');
  state.logs = [];
  assert.equal(dueHabits(state, '2026-09-02')[0].dueDate, '2026-09-01');
  assert.equal(habitScheduleLabel(state.trackers[1]), 'No reminder');
});
test('future logs do not hide due work; future first date stays respected', () => {
  const state = { trackers: [tracker(5)], logs: [log('2026-10-01')] };
  assert.equal(dueHabits(state, '2026-09-01').length, 1);
  state.trackers[0].schedule.startDate = '2026-09-20';
  state.logs = [log('2026-09-01')];
  assert.equal(dueHabits(state, '2026-09-10').length, 0);
  assert.equal(dueHabits(state, '2026-09-20')[0].dueDate, '2026-09-20');
});
test('form roundtrip and invalid schedules fail explicitly', () => {
  const t = tracker(2, 'weeks');
  assert.deepEqual(scheduleFromForm(habitScheduleForm(t, '2026-09-01')), t.schedule);
  assert.equal(habitScheduleLabel(t), 'Every 2 weeks');
  for (const patch of [{ schema: 2 }, { every: 0 }, { every: 1.5 }, { every: 366 }, { unit: 'hours' }, { startDate: '2026-02-30' }]) {
    assert.throws(() => validateHabitSchedule({ ...t.schedule, ...patch }));
  }
  assert.throws(() => scheduleFromForm({ reminder: 'interval', every: '', unit: 'days', startDate: '2026-09-01' }));
});

import { missedHabits } from './habitSchedule.js';
const miss = (date, trackerId = 'habit') => ({ id: `m-${date}`, trackerId, date });

test('"Missed it" takes a habit off today and rolls it on like a completion', () => {
  const state = { trackers: [tracker(1)], logs: [log('2026-09-01')], misses: [miss('2026-09-14')] };
  assert.equal(dueHabits(state, '2026-09-14').length, 0);          // crossed out today
  assert.equal(dueHabits(state, '2026-09-15')[0].dueDate, '2026-09-15'); // daily: back tomorrow
  const every5 = { trackers: [tracker(5)], logs: [], misses: [miss('2026-09-01')] };
  assert.equal(dueHabits(every5, '2026-09-05').length, 0);
  assert.equal(dueHabits(every5, '2026-09-06')[0].dueDate, '2026-09-06'); // next due counts from the miss
});

test('missedHabits lists the crossed-out trackers for a day, and only them', () => {
  const state = { trackers: [tracker(1), { ...tracker(1), id: 'other', name: 'Gym' }], logs: [], misses: [miss('2026-09-14'), miss('2026-09-13', 'other')] };
  assert.deepEqual(missedHabits(state, '2026-09-14').map((m) => m.tracker.id), ['habit']);
  assert.deepEqual(missedHabits({ trackers: [tracker(1)], logs: [] }, '2026-09-14'), []);   // schema-1 blobs have no misses
});
