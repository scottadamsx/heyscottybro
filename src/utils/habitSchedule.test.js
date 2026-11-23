import test from 'node:test';
import assert from 'node:assert/strict';
import { dueHabits, addHabitDays, habitScheduleLabel, habitScheduleForm, scheduleFromForm, validateHabitSchedule, habitStreak, nextHabitDueDate } from './habitSchedule.js';
const tracker = (every, unit = 'days') => ({ id: 'habit', name: 'Laundry', mode: 'check', schedule: { schema: 1, kind: 'interval', every, unit, startDate: '2026-09-01' } });
const log = date => ({ id: date, trackerId: 'habit', date });
for (const [every, unit, due, afterOct30] of [[5, 'days', '2026-09-06', '2026-10-31'], [1, 'weeks', '2026-09-08', '2026-11-03'], [2, 'weeks', '2026-09-15', '2026-11-10']]) {
  test(`completion rolls every ${every} ${unit}`, () => {
    const state = { trackers: [tracker(every, unit)], logs: [log('2026-09-01')] };
    assert.equal(dueHabits(state, '2026-09-02').length, 0);
    assert.equal(dueHabits(state, due)[0].dueDate, due);
    assert.equal(dueHabits(state, due)[0].overdue, false);
    // BUG-101: an unhandled due day does NOT carry over. Far-future days that
    // are not cadence days show nothing; the habit returns on its cadence day.
    assert.equal(dueHabits(state, '2026-10-30').length, 0);
    assert.equal(dueHabits(state, afterOct30)[0].dueDate, afterOct30);
    state.logs.push(log(afterOct30));
    assert.equal(dueHabits(state, afterOct30).length, 0);
  });
}
test('BUG-101: a Sunday-only habit skipped on Sunday stays silent until next Sunday', () => {
  const sunday = { id: 'clean', name: 'Clean The Apartment', mode: 'check', schedule: { schema: 1, kind: 'interval', every: 1, unit: 'weeks', startDate: '2026-11-01' } };
  const state = { trackers: [sunday], logs: [log('2026-11-08')].map(l => ({ ...l, trackerId: 'clean' })) };
  assert.equal(dueHabits(state, '2026-11-16').length, 0); // Monday after the skipped Sunday
  assert.equal(dueHabits(state, '2026-11-21').length, 0); // Saturday
  assert.equal(dueHabits(state, '2026-11-22')[0].tracker.id, 'clean'); // next Sunday
  assert.equal(nextHabitDueDate(state, sunday, '2026-11-16'), '2026-11-22');
});
test('BUG-101: streaks count scheduled occurrences, not calendar days', () => {
  const every4 = { id: 'habit', name: 'Laundry', mode: 'check', schedule: { schema: 1, kind: 'interval', every: 4, unit: 'days', startDate: '2026-11-03' } };
  const done = { trackers: [every4], logs: ['2026-11-03', '2026-11-07', '2026-11-11', '2026-11-15'].map(log) };
  assert.equal(habitStreak(done, every4, '2026-11-16'), 4); // perfect adherence, mostly non-due days
  assert.equal(habitStreak(done, every4, '2026-11-19'), 4); // due today, not yet done: not broken
  const skipped = { trackers: [every4], logs: ['2026-11-03', '2026-11-07', '2026-11-11'].map(log) };
  assert.equal(habitStreak(skipped, every4, '2026-11-16'), 0); // the Nov 15 occurrence was skipped
  const daily = { id: 'habit', name: 'Daily', mode: 'check', created: '2026-11-01' };
  assert.equal(habitStreak({ trackers: [daily], logs: [log('2026-11-14'), log('2026-11-15')] }, daily, '2026-11-16'), 2);
});
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
  assert.equal(dueHabits(state, '2026-09-02')[0].dueDate, '2026-09-02'); // daily: due today, dated today (BUG-101, no overdue carryover)
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

test('doing a day-interval habit early resets the timer from the day it was done', () => {
  const every4 = { id: 'habit', name: 'Laundry', mode: 'check', schedule: { schema: 1, kind: 'interval', every: 4, unit: 'days', startDate: '2026-11-21' } };
  const before = { trackers: [every4], logs: [log('2026-11-21')] };
  assert.equal(nextHabitDueDate(before, every4, '2026-11-23'), '2026-11-25'); // due in 2 days
  const after = { trackers: [every4], logs: [log('2026-11-21'), log('2026-11-23')] }; // done Mon Nov 23, 2 days early
  assert.equal(nextHabitDueDate(after, every4, '2026-11-23'), '2026-11-27'); // today + 4, not the old Nov 25
  assert.equal(dueHabits(after, '2026-11-25').length, 0); // the Nov 25 occurrence was covered early
  assert.equal(dueHabits(after, '2026-11-27')[0].dueDate, '2026-11-27');
  // Removing the early log (undo) restores the previous next due exactly.
  assert.equal(nextHabitDueDate(before, every4, '2026-11-23'), '2026-11-25');
});
test('doing a weekly habit early keeps its weekday and rolls to the following occurrence', () => {
  const sundays = { id: 'clean', name: 'Clean The Apartment', mode: 'check', schedule: { schema: 1, kind: 'interval', every: 1, unit: 'weeks', startDate: '2026-11-01' } };
  const sundayLogs = ['2026-11-01', '2026-11-08', '2026-11-15', '2026-11-22'].map(d => ({ ...log(d), trackerId: 'clean' }));
  const before = { trackers: [sundays], logs: sundayLogs };
  assert.equal(nextHabitDueDate(before, sundays, '2026-11-23'), '2026-11-29'); // next Sunday
  const after = { trackers: [sundays], logs: [...sundayLogs, { ...log('2026-11-23'), trackerId: 'clean' }] }; // done Mon Nov 23, early
  assert.equal(nextHabitDueDate(after, sundays, '2026-11-23'), '2026-12-06'); // the FOLLOWING Sunday, not Mon Nov 30
  assert.equal(dueHabits(after, '2026-11-29').length, 0); // the Nov 29 occurrence was covered early
  assert.equal(dueHabits(after, '2026-12-06')[0].tracker.id, 'clean'); // due again the Sunday after
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
