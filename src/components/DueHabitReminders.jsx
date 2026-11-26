import React from "react";

/**
 * Habit rows for the Tasks & reminders page — a projection of habit logs,
 * never a second set of reminder records. The page groups rows under
 * "Due today" and "Coming up" alongside tasks; every habit row carries a
 * small "Habit" tag in its subtitle so habits and tasks stay
 * distinguishable inside the shared lists.
 * Due habits offer Done or "Missed it"; habits crossed out today stay
 * listed, struck through, with Undo — so a skipped habit is visible, not
 * vanished. Upcoming habits are display-only here (plus Schedule): a
 * future occurrence is never completed from this list.
 */
export function HabitTag() {
  return <span className="habit-tag">Habit</span>;
}

export default function DueHabitReminders({ rows, missedRows = [], busyId, onDone, onMiss, onUnmiss, onEdit }) {
  return (
    <>
      {rows.map(({ tracker, dueDate, overdue }) => (
        <div className="db-list-item task-row" key={tracker.id}>
          <div className="db-list-item-content">
            <span className="db-list-item-title task-row-title">{tracker.emoji ? `${tracker.emoji} ` : ""}{tracker.name}</span>
            <span className="db-list-item-subtitle">
              <HabitTag />{" "}
              <span className={overdue ? "task-overdue" : undefined}>{overdue ? "Overdue" : "Due today"}</span>, {dueDate}
            </span>
          </div>
          <div className="task-row-actions">
            <button type="button" className="btn-mini" onClick={() => onEdit(tracker.id)}>Schedule</button>
            {onMiss && (
              <button type="button" className="btn-mini" disabled={Boolean(busyId)}
                aria-label={`Mark ${tracker.name} missed today`} onClick={() => onMiss(tracker)}>
                Missed it
              </button>
            )}
            <span className="task-row-done-slot">
              <button type="button" className="btn-sm btn-complete" disabled={Boolean(busyId)} aria-busy={busyId === tracker.id || undefined}
                aria-label={`Mark ${tracker.name} done today`} onClick={() => onDone(tracker)}>
                {busyId === tracker.id ? "Saving…" : "Done"}
              </button>
            </span>
            <span className="task-row-x-slot" aria-hidden="true" />
          </div>
        </div>
      ))}
      {missedRows.map(({ tracker }) => (
        <div className="db-list-item task-row is-missed" key={`missed-${tracker.id}`}>
          <div className="db-list-item-content">
            <span className="db-list-item-title task-row-title">{tracker.emoji ? `${tracker.emoji} ` : ""}{tracker.name}</span>
            <span className="db-list-item-subtitle"><HabitTag /> <span className="missed-tag">Missed</span>, today</span>
          </div>
          <div className="task-row-actions">
            {onUnmiss && (
              <button type="button" className="btn-mini" disabled={Boolean(busyId)}
                aria-label={`Undo missed for ${tracker.name}`} onClick={() => onUnmiss(tracker)}>
                Undo
              </button>
            )}
          </div>
        </div>
      ))}
    </>
  );
}

export function UpcomingHabitRow({ tracker, label, onEdit }) {
  return (
    <div className="db-list-item task-row">
      <div className="db-list-item-content">
        <span className="db-list-item-title task-row-title">{tracker.emoji ? `${tracker.emoji} ` : ""}{tracker.name}</span>
        <span className="db-list-item-subtitle"><HabitTag /> {label}</span>
      </div>
      <div className="task-row-actions">
        <button type="button" className="btn-mini" onClick={() => onEdit(tracker.id)}>Schedule</button>
      </div>
    </div>
  );
}
