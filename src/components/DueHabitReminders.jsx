import React from "react";

/**
 * A projection of habit logs, never a second set of reminder records.
 * Due habits offer Done or "Missed it"; habits crossed out today stay listed,
 * struck through, with Undo — so a skipped habit is visible, not vanished.
 */
export default function DueHabitReminders({ rows, missedRows = [], busyId, onDone, onMiss, onUnmiss, onEdit }) {
  const total = rows.length + missedRows.length;
  return (
    <section className="db-card" aria-label="Due habits">
      <div className="db-card-header"><h3 className="db-card-title">Habits due ({rows.length})</h3></div>
      {total === 0 && <p className="no-entries">No unfinished habits due today.</p>}
      {total > 0 && (
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
                {onMiss && (
                  <button type="button" className="btn-mini" disabled={Boolean(busyId)}
                    aria-label={`Mark ${tracker.name} missed today`} onClick={() => onMiss(tracker)}>
                    Missed it
                  </button>
                )}
                <button type="button" className="btn-sm btn-complete" disabled={Boolean(busyId)}
                  aria-label={`Mark ${tracker.name} done today`} onClick={() => onDone(tracker)}>
                  {busyId === tracker.id ? "Saving…" : "Done"}
                </button>
              </div>
            </div>
          ))}
          {missedRows.map(({ tracker }) => (
            <div className="db-list-item task-row is-missed" key={`missed-${tracker.id}`}>
              <div className="db-list-item-content">
                <span className="db-list-item-title task-row-title">{tracker.emoji ? `${tracker.emoji} ` : ""}{tracker.name}</span>
                <span className="db-list-item-subtitle"><span className="missed-tag">Missed</span> · today</span>
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
        </div>
      )}
    </section>
  );
}
