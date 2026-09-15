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
 * Habits due on `today`. The next due date counts from the latest day the habit
 * was handled — done (a log) or crossed out ("Missed it", state.misses) — so a
 * skipped habit leaves today's list and comes round again on schedule instead
 * of sitting overdue forever. A miss never counts as done anywhere else.
 */
export function dueHabits(state, today) {
  if (!validHabitDate(today)) throw new Error('Choose a valid day to find due habits.');
  const latest = new Map();
  for (const log of [...(state.logs || []), ...(state.misses || [])]) {
    if (validHabitDate(log.date) && log.date <= today && (!latest.has(log.trackerId) || log.date > latest.get(log.trackerId))) latest.set(log.trackerId, log.date);
  }
  return (state.trackers || []).flatMap(tracker => {
    const schedule = habitSchedule(tracker, today);
    if (schedule.kind === 'none') return [];
    const last = latest.get(tracker.id);
    const next = last ? addHabitDays(last, schedule.every * (schedule.unit === 'weeks' ? 7 : 1)) : schedule.startDate;
    const dueDate = next > schedule.startDate ? next : schedule.startDate;
    return dueDate <= today ? [{ tracker, dueDate, overdue: dueDate < today }] : [];
  }).sort((a, b) => a.dueDate.localeCompare(b.dueDate) || (a.tracker.name || '').localeCompare(b.tracker.name || ''));
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
