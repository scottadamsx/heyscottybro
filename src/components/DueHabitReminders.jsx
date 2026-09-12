import React from "react";

/** A projection of habit logs, never a second set of reminder records. */
export default function DueHabitReminders({ rows, busyId, onDone, onEdit }) {
  return (
    <section className="db-card" aria-label="Due habits">
      <h3 className="db-card-title">Habits due ({rows.length})</h3>
      {rows.length === 0 && <p className="no-entries">No unfinished habits due today.</p>}
      {rows.map(({ tracker, dueDate, overdue }) => (
        <div className="completed-item" key={tracker.id}>
          <div className="task-row-main">
            <strong>{tracker.emoji ? `${tracker.emoji} ` : ""}{tracker.name}</strong>
            <p className={overdue ? "task-overdue" : "field-hint"}>
              {overdue ? "Overdue" : "Due today"} · {dueDate}
            </p>
          </div>
          <div className="header-actions">
            <button type="button" className="btn-mini" onClick={() => onEdit(tracker.id)}>Schedule</button>
            <button type="button" className="btn-sm btn-complete" disabled={Boolean(busyId)}
              aria-label={`Mark ${tracker.name} done today`} onClick={() => onDone(tracker)}>
              {busyId === tracker.id ? "Saving…" : "Done"}
            </button>
          </div>
        </div>
      ))}
    </section>
  );
}
