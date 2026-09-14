import React from "react";

/** A projection of habit logs, never a second set of reminder records. */
export default function DueHabitReminders({ rows, busyId, onDone, onEdit }) {
  return (
    <section className="db-card" aria-label="Due habits">
      <div className="db-card-header"><h3 className="db-card-title">Habits due ({rows.length})</h3></div>
      {rows.length === 0 && <p className="no-entries">No unfinished habits due today.</p>}
      {rows.length > 0 && (
        <div className="db-list task-list">
          {rows.map(({ tracker, dueDate, overdue }) => (
            <div className="db-list-item task-row" key={tracker.id}>
              <div className="db-list-item-content">
                <span className="db-list-item-title task-row-title">{tracker.emoji ? `${tracker.emoji} ` : ""}{tracker.name}</span>
                <span className="db-list-item-subtitle">
                  <span className={overdue ? "task-overdue" : undefined}>{overdue ? "Overdue" : "Due today"}</span> · {dueDate}
                </span>
              </div>
              <div className="task-row-actions">
                <button type="button" className="btn-mini" onClick={() => onEdit(tracker.id)}>Schedule</button>
                <button type="button" className="btn-sm btn-complete" disabled={Boolean(busyId)}
                  aria-label={`Mark ${tracker.name} done today`} onClick={() => onDone(tracker)}>
                  {busyId === tracker.id ? "Saving…" : "Done"}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
