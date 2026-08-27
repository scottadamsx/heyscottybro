/**
 * The one event form. Calendar day sheet (date fixed to the open day) and the
 * Project page (project fixed) both render this; edits pass `initial`.
 *
 * Values in/out are the events row shape: title, date, end_date, start_time,
 * end_time, description, project_id, event_type_id. Times are "HH:MM".
 */
import { useState } from "react";
import DatePicker from "./DatePicker";
import TimePicker from "./TimePicker";

const plusHour = (t) => { const [h, m] = t.split(":").map(Number); return `${String((h + 1) % 24).padStart(2, "0")}:${String(m).padStart(2, "0")}`; };
const daySpan = (a, b) => Math.round((new Date(b + "T00:00:00") - new Date(a + "T00:00:00")) / 86400000) + 1;

export default function EventForm({
  initial = {},
  fixedDate = null,          // day sheet: the date is the open day
  lockProject = null,        // project page: the project is implied
  projects = [],
  eventTypes = [],
  submitLabel = "Add event",
  onSubmit,
  onCancel,
  autoFocus = true,
}) {
  const [title, setTitle] = useState(initial.title || "");
  const [date, setDate] = useState(fixedDate || initial.date || "");
  const [endDate, setEndDate] = useState(initial.end_date || "");
  const [startTime, setStartTime] = useState(initial.start_time ? String(initial.start_time).slice(0, 5) : "");
  const [endTime, setEndTime] = useState(initial.end_time ? String(initial.end_time).slice(0, 5) : "");
  const [endAuto, setEndAuto] = useState(!initial.end_time);
  const [description, setDescription] = useState(initial.description || "");
  const [projectId, setProjectId] = useState(lockProject || initial.project_id || "");
  const [eventTypeId, setEventTypeId] = useState(initial.event_type_id || "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const theDate = fixedDate || date;
  const submit = async (e) => {
    e?.preventDefault?.();
    if (!title.trim() || !theDate) { setError(!theDate ? "Pick a date." : "Give it a title."); return; }
    setBusy(true); setError("");
    try {
      await onSubmit({ title, date: theDate, end_date: endDate, start_time: startTime, end_time: endTime, description, project_id: projectId || null, event_type_id: eventTypeId || null });
      if (!initial.id) { setTitle(""); setDescription(""); setStartTime(""); setEndTime(""); setEndDate(""); setEndAuto(true); setEventTypeId(""); }
    } catch (err) { setError(err.message || "Couldn't save the event."); }
    finally { setBusy(false); }
  };

  return (
    <form className="day-add-form event-form" onSubmit={submit}>
      <input placeholder="Event title" value={title} onChange={(e) => setTitle(e.target.value)} autoFocus={autoFocus} aria-label="Event title" />
      {!fixedDate && (
        <div className="day-time-row">
          <label>Date</label>
          <DatePicker value={date} onChange={(v) => { setDate(v); if (endDate && v && endDate < v) setEndDate(""); }} />
        </div>
      )}
      <div className="day-time-row">
        <label>Start</label>
        <TimePicker value={startTime} onChange={(v) => { setStartTime(v); if (v && endAuto) setEndTime(plusHour(v)); }} placeholder="Start" />
        <label>End</label>
        <TimePicker value={endTime} onChange={(v) => { setEndTime(v); setEndAuto(false); }} placeholder="End" />
        {startTime && <button type="button" className="btn-mini" onClick={() => { setStartTime(""); setEndTime(""); setEndAuto(true); }}>All day</button>}
      </div>
      <div className="day-time-row">
        <label>Ends on</label>
        <DatePicker value={endDate || theDate} onChange={(v) => setEndDate(v)} min={theDate || undefined} />
        <span className="day-span-note">{endDate && theDate && endDate > theDate ? `${daySpan(theDate, endDate)} days` : "Same day — pick a later date for a multi-day event"}</span>
      </div>
      <textarea placeholder="Description (optional)" value={description} onChange={(e) => setDescription(e.target.value)} rows={2} aria-label="Description" />
      {eventTypes.length > 0 && (
        <select value={eventTypeId} onChange={(e) => setEventTypeId(e.target.value)} aria-label="Event type">
          <option value="">No event type</option>
          {eventTypes.map((et) => <option key={et.id} value={et.id}>{et.name}</option>)}
        </select>
      )}
      {!lockProject && projects.length > 0 && (
        <select value={projectId} onChange={(e) => setProjectId(e.target.value)} aria-label="Project">
          <option value="">No project</option>
          {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      )}
      {error && <p className="error-message">{error}</p>}
      <div className="event-form-actions">
        {onCancel && <button type="button" className="btn btn-sm btn-secondary-sm" onClick={onCancel}>Cancel</button>}
        <button type="submit" className="btn" disabled={busy}>{busy ? "Saving…" : <><i className="fa-solid fa-plus" /> {submitLabel}</>}</button>
      </div>
    </form>
  );
}
