/** Calendar dates, rather than elapsed hours: intervals survive DST changes. */
export function validHabitDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}
export function addHabitDays(date, days) {
  if (!validHabitDate(date) || !Number.isInteger(days)) throw new Error('Habit dates must use a valid YYYY-MM-DD date.');
  const parsed = new Date(`${date}T00:00:00Z`);
  parsed.setUTCDate(parsed.getUTCDate() + days);
  const result = parsed.toISOString().slice(0, 10);
  if (!validHabitDate(result)) throw new Error('Habit interval is outside the supported date range.');
  return result;
}
export function validateHabitSchedule(schedule) {
  if (!schedule || typeof schedule !== 'object' || Array.isArray(schedule) || schedule.schema !== 1) throw new Error('Unrecognised habit schedule. This app supports schedule schema 1.');
  if (schedule.kind === 'none') return schedule;
  if (schedule.kind !== 'interval' || !Number.isInteger(schedule.every) || schedule.every < 1 || schedule.every > 365 || !['days', 'weeks'].includes(schedule.unit)) throw new Error('Choose an interval from 1 to 365 days or weeks.');
  if (!validHabitDate(schedule.startDate)) throw new Error('Choose a valid first due date.');
  addHabitDays(schedule.startDate, schedule.every * (schedule.unit === 'weeks' ? 7 : 1));
  return schedule;
}
export function habitSchedule(tracker, today) {
  if (tracker.schedule !== undefined) return validateHabitSchedule(tracker.schedule);
  if (tracker.mode !== 'check') return { schema: 1, kind: 'none' };
  return { schema: 1, kind: 'interval', every: 1, unit: 'days', startDate: validHabitDate(tracker.created) ? tracker.created : today };
}
/**
 * The cadence of one scheduled tracker up to `today`: every day the habit was
 * due, and what happened on it. Occurrences start at the schedule's startDate
 * and step by the interval; handling the habit (a log = 'done', a "Missed it"
 * mark = 'missed') before its occurrence counts as doing that occurrence
 * early. For day intervals the cadence then re-anchors to the handled day, as
 * before (the timer restarts from the day it was done); weekly schedules keep
 * their weekday instead — the cadence steps on from the occurrence itself, so
 * a Sunday habit done early stays a Sunday habit. The
 * difference from the old model (BUG-101): an occurrence that passes with no
 * log and no miss is 'skipped' and the cadence simply moves on — the habit is
 * due ONLY on its cadence days, never carried over as "overdue" onto days it
 * was never scheduled for. A log dated before its occurrence counts as doing
 * that occurrence early (handledOn). `next` is the first cadence day after
 * `today` (null when the tracker has no schedule).
 */
export function habitOccurrences(state, tracker, today) {
  if (!validHabitDate(today)) throw new Error('Choose a valid day to find due habits.');
  const schedule = habitSchedule(tracker, today);
  if (schedule.kind === 'none') return { occurrences: [], next: null };
  const step = schedule.every * (schedule.unit === 'weeks' ? 7 : 1);
  const handled = new Map();
  for (const log of state.logs || []) {
    if (log.trackerId === tracker.id && validHabitDate(log.date) && log.date >= schedule.startDate && log.date <= today) handled.set(log.date, 'done');
  }
  for (const miss of state.misses || []) {
    if (miss.trackerId === tracker.id && validHabitDate(miss.date) && miss.date >= schedule.startDate && miss.date <= today && !handled.has(miss.date)) handled.set(miss.date, 'missed');
  }
  const occurrences = [];
  let next = schedule.startDate;
  for (const date of [...handled.keys()].sort()) {
    while (next < date) { occurrences.push({ date: next, status: 'skipped' }); next = addHabitDays(next, step); }
    if (next === date) { occurrences.push({ date, status: handled.get(date) }); next = addHabitDays(date, step); }
    else {
      occurrences.push({ date: next, status: handled.get(date), handledOn: date });
      // Handled early: day intervals restart from the handled day; weekly
      // schedules step on from the occurrence so the weekday never drifts.
      next = addHabitDays(schedule.unit === 'weeks' ? next : date, step);
    }
  }
  while (next < today) { occurrences.push({ date: next, status: 'skipped' }); next = addHabitDays(next, step); }
  if (next === today) { occurrences.push({ date: today, status: 'due' }); next = addHabitDays(today, step); }
  return { occurrences, next };
}
/**
 * Habits due on `today` — cadence days only (see habitOccurrences). A habit
 * whose day passed unhandled does not appear again until its next cadence
 * day, and never shows as overdue on a day it was not scheduled.
 */
export function dueHabits(state, today) {
  if (!validHabitDate(today)) throw new Error('Choose a valid day to find due habits.');
  return (state.trackers || []).flatMap(tracker => {
    const { occurrences } = habitOccurrences(state, tracker, today);
    return occurrences.some(o => o.date === today && o.status === 'due') ? [{ tracker, dueDate: today, overdue: false }] : [];
  }).sort((a, b) => (a.tracker.name || '').localeCompare(b.tracker.name || ''));
}
/**
 * Consecutive handled occurrences, most recent first. Only cadence days can
 * break a streak: days the habit was never scheduled are invisible to it, and
 * today still in progress (due, not yet handled) does not break it either.
 * Trackers with no schedule keep the plain calendar-day streak.
 */
export function habitStreak(state, tracker, today) {
  if (!validHabitDate(today)) throw new Error('Choose a valid day to find a habit streak.');
  if (habitSchedule(tracker, today).kind === 'none') {
    const days = new Set((state.logs || []).filter(l => l.trackerId === tracker.id).map(l => l.date));
    let s = 0, d = days.has(today) ? today : null;
    if (!d) { const y = addHabitDays(today, -1); d = days.has(y) ? y : null; }
    while (d && days.has(d)) { s++; d = addHabitDays(d, -1); }
    return s;
  }
  const { occurrences } = habitOccurrences(state, tracker, today);
  const past = occurrences.filter(o => o.status !== 'due');
  let s = 0;
  for (let i = past.length - 1; i >= 0 && past[i].status === 'done'; i--) s++;
  return s;
}
/** The next day this tracker is due: today if it is due today, else its next cadence day, else null (no schedule). */
export function nextHabitDueDate(state, tracker, today) {
  const { occurrences, next } = habitOccurrences(state, tracker, today);
  return occurrences.some(o => o.date === today && o.status === 'due') ? today : next;
}
/** Scheduled habits crossed out ("Missed it") on `day`, for the struck-through rows. */
export function missedHabits(state, day) {
  const ids = new Set((state.misses || []).filter((m) => m.date === day).map((m) => m.trackerId));
  return (state.trackers || []).filter((t) => ids.has(t.id)).map((tracker) => ({ tracker, date: day }));
}
export function habitScheduleLabel(tracker) {
  const schedule = habitSchedule(tracker, '2000-01-01');
  if (schedule.kind === 'none') return 'No reminder';
  if (schedule.every === 1 && schedule.unit === 'days') return 'Daily';
  return `Every ${schedule.every} ${schedule.every === 1 ? schedule.unit.slice(0, -1) : schedule.unit}`;
}
export function habitScheduleForm(tracker, today) {
  const schedule = habitSchedule(tracker, today);
  return {
    reminder: schedule.kind === 'none' ? 'none' : schedule.every === 1 && schedule.unit === 'days' ? 'daily' : 'interval',
    every: schedule.every || 1,
    unit: schedule.unit || 'days',
    startDate: schedule.startDate || today,
  };
}
export function scheduleFromForm(form) {
  if (form.reminder === 'none') return { schema: 1, kind: 'none' };
  if (!['daily', 'interval'].includes(form.reminder)) throw new Error('Choose a reminder schedule.');
  const schedule = { schema: 1, kind: 'interval', every: form.reminder === 'daily' ? 1 : Number(form.every), unit: form.reminder === 'daily' ? 'days' : form.unit, startDate: form.startDate };
  return validateHabitSchedule(schedule);
}
