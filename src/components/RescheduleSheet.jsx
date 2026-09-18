import { useEffect, useMemo, useRef, useState } from "react";
import { updateReminder, updateEvent } from "../api/plannerApi";
import { expandReminders, expandEvents, formatTime12 } from "../utils/plannerUtils";
import {
  reschedulePatch, suggestDays, addDays, dayBlocks, overlapsWith, firstFreeSlot, itemDuration,
  toMinutes, fromMinutes, snap, DAY_START, DAY_END, SNAP,
} from "../utils/reschedule";
import { useToast } from "../contexts/ToastContext";
import "./reschedule.css";

const SPAN = 14;
const PX_PER_MIN = 1;                 // 60px per hour
const DURATIONS = [15, 30, 45, 60, 90, 120, 180];
const asDate = (ds) => new Date(ds + "T00:00:00");
const dow = (ds) => asDate(ds).toLocaleDateString(undefined, { weekday: "short" });
const dayNum = (ds) => asDate(ds).getDate();
const longDay = (ds) => asDate(ds).toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" });
const hm = (m) => formatTime12(fromMinutes(m));
const durLabel = (m) => (m < 60 ? `${m} min` : m % 60 ? `${Math.floor(m / 60)} h ${m % 60}` : `${m / 60} h`);
const nowMinutes = () => { const d = new Date(); return d.getHours() * 60 + d.getMinutes(); };
const clampStart = (m, dur) => Math.min(Math.max(m, DAY_START), DAY_END - dur);

/** First free slot on `day` for `dur` minutes, at/after `prefer` (or 9 AM), never before now today. */
function placeOn(day, dur, reminders, events, today, prefer) {
  const b = dayBlocks(day, expandReminders(reminders, day, day), expandEvents(events, day, day));
  const floor = day === today ? Math.max(DAY_START, nowMinutes()) : DAY_START;
  const from = Math.max(floor, prefer ?? 9 * 60);
  return firstFreeSlot(dur, b.timed, from) ?? firstFreeSlot(dur, b.timed, floor) ?? clampStart(from, dur);
}

/**
 * "Fit it in" — schedule a task (or a one-off event) into a real slot.
 *  1. Day: today + the next 13 days, busiest-vs-lightest at a glance. Drag the
 *     item onto a day or click one.
 *  2. How long: quick durations or custom minutes (saved as duration_min).
 *  3. Time: the day as an hour timeline (like Google Calendar) with what's
 *     already booked. The item is a block — drag it, click an empty slot, or
 *     use ↑/↓ (15 min) and PgUp/PgDn (1 h). Overlaps are called out by name.
 * Saves through the normal update APIs and reports the real result.
 *
 * props: item, kind ("task" | "event"), reminders, events, today, onClose, onMoved(patch),
 *        initialDate? — open with this day already picked (e.g. dropped on a calendar day)
 */
export default function RescheduleSheet({ item, kind, reminders = [], events = [], today, initialDate, onClose, onMoved }) {
  const { addToast } = useToast();
  const title = kind === "task" ? item.name : item.title;
  const origStart = toMinutes(kind === "task" ? item.time : item.start_time);
  const overdue = item.date && item.date < today;

  const [target, setTarget] = useState(initialDate || (overdue || !item.date ? null : item.date));
  const [duration, setDuration] = useState(() => itemDuration(item, kind));
  const [custom, setCustom] = useState("");
  const [start, setStart] = useState(() => (initialDate
    ? placeOn(initialDate, itemDuration(item, kind), reminders.filter((r) => !r.completed && r.id !== item.id), events.filter((e) => e.id !== item.id), today, origStart ?? undefined)
    : origStart));
  const [noTime, setNoTime] = useState(false);
  const [overDay, setOverDay] = useState(null);
  const [saving, setSaving] = useState(false);
  const dialogRef = useRef(null);
  const railRef = useRef(null);
  const innerRef = useRef(null);
  const drag = useRef(null);

  const days = useMemo(() => Array.from({ length: SPAN }, (_, i) => addDays(today, i)), [today]);
  const others = useMemo(() => ({
    reminders: reminders.filter((r) => !r.completed && r.id !== item.id),
    events: events.filter((e) => e.id !== item.id),
  }), [reminders, events, item.id]);
  const load = useMemo(() => {
    const m = {};
    const end = days[days.length - 1];
    for (const r of expandReminders(others.reminders, days[0], end)) m[r.date] = (m[r.date] || 0) + 1;
    for (const e of expandEvents(others.events, days[0], end)) m[e.date] = (m[e.date] || 0) + 1;
    return m;
  }, [others, days]);
  const suggested = useMemo(() => new Set(suggestDays(today, load, { span: SPAN - 1, pick: 3 }).map((d) => d.date)), [today, load]);

  const blocks = useMemo(() => (target
    ? dayBlocks(target, expandReminders(others.reminders, target, target), expandEvents(others.events, target, target))
    : { timed: [], allDay: [] }), [target, others]);
  const earliest = target === today ? Math.max(DAY_START, nowMinutes()) : DAY_START;

  // Picking a day (or changing length) lands the block in the first free slot
  // at/after the old time — or after "now" today.
  const placeFor = (day, dur, prefer) => placeOn(day, dur, others.reminders, others.events, today, prefer);
  const pickDay = (d) => { setTarget(d); setStart(placeFor(d, duration, origStart ?? undefined)); };
  const pickDuration = (m) => {
    if (!(m > 0)) return;
    setDuration(m);
    if (target && start != null) setStart(clampStart(start, m));
  };

  useEffect(() => {
    dialogRef.current?.focus();
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Keep the block in view when the day or slot changes.
  useEffect(() => {
    const rail = railRef.current;
    if (!rail || start == null) return;
    const top = (start - DAY_START) * PX_PER_MIN;
    if (top < rail.scrollTop + 24 || top + duration * PX_PER_MIN > rail.scrollTop + rail.clientHeight - 24) rail.scrollTop = Math.max(0, top - rail.clientHeight / 3);
  }, [target, start, duration]);

  const clashes = target && !noTime && start != null ? overlapsWith(start, duration, blocks.timed) : [];

  // ── Timeline interactions ──
  // Measured against the hour grid itself (already scroll-adjusted by the browser).
  const minuteAt = (clientY) => DAY_START + (clientY - innerRef.current.getBoundingClientRect().top) / PX_PER_MIN;
  const onRailClick = (e) => {
    if (e.target.closest(".tl-candidate")) return;
    setNoTime(false);
    setStart(clampStart(snap(minuteAt(e.clientY) - duration / 2), duration));
  };
  const onBlockDown = (e) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { y: e.clientY, from: start };
  };
  const onBlockMove = (e) => {
    if (!drag.current) return;
    const next = clampStart(snap(drag.current.from + (e.clientY - drag.current.y) / PX_PER_MIN), duration);
    if (next !== start) setStart(next);
  };
  const onBlockUp = () => { drag.current = null; };
  const onBlockKey = (e) => {
    const step = e.key === "ArrowUp" ? -SNAP : e.key === "ArrowDown" ? SNAP : e.key === "PageUp" ? -60 : e.key === "PageDown" ? 60 : 0;
    if (!step) return;
    e.preventDefault();
    setStart((s) => clampStart((s ?? DAY_START) + step, duration));
  };

  const save = async () => {
    if (!target || saving) return;
    const opts = noTime || start == null ? { time: "", duration } : { time: fromMinutes(start), duration };
    const patch = reschedulePatch(item, kind, target, opts);
    if (!patch) { addToast("Repeating items can't be moved here. Change them from their edit form.", "error"); return; }
    setSaving(true);
    try {
      const res = kind === "task" ? await updateReminder(item.id, patch) : await updateEvent(item.id, patch);
      const when = patch.time || patch.start_time ? ` at ${formatTime12(patch.time || patch.start_time)}` : "";
      addToast(`Scheduled “${title}” for ${longDay(target)}${when}.`, "success");
      if (res?.dropped?.includes("duration_min")) {
        addToast("The time estimate wasn't saved: the database needs one update (supabase/migrations/2026-09-14-reminder-duration.sql). The day and time were saved.", "warning", { duration: 12000 });
      }
      onMoved?.(patch);
      onClose();
    } catch (err) {
      addToast(`Couldn't schedule “${title}”: ${err?.message || "unknown error"}`, "error");
      setSaving(false);
    }
  };

  const hours = [];
  for (let m = DAY_START; m <= DAY_END; m += 60) hours.push(m);

  return (
    <div className="uik-modal-backdrop" onClick={onClose}>
      <div className="uik-modal rs" role="dialog" aria-modal="true" aria-labelledby="rs-title" tabIndex={-1} ref={dialogRef} onClick={(e) => e.stopPropagation()}>
        <div className="uik-modal-head">
          <div>
            <h3 id="rs-title">{overdue ? "Fit it in" : "Schedule"}</h3>
            <p className="rs-sub">Pick a day, say how long it takes, then place it on the day.</p>
          </div>
          <button type="button" className="uik-modal-x" onClick={onClose} aria-label="Close"><i className="fa-solid fa-xmark" aria-hidden="true" /></button>
        </div>

        <div className="uik-modal-body rs-body">
          <div className="rs-left">
          <div
            className="rs-chip"
            draggable
            onDragStart={(e) => { e.dataTransfer.setData("text/plain", String(item.id)); e.dataTransfer.effectAllowed = "move"; }}
            aria-label={`${title}, drag onto a day`}
          >
            <i className="fa-solid fa-grip-vertical rs-grip" aria-hidden="true" />
            <span className={`rs-kind kind-${kind}`} aria-hidden="true"><i className={`fa-solid ${kind === "event" ? "fa-calendar-day" : "fa-check"}`} /></span>
            <span className="rs-chip-main">
              <span className="rs-chip-title">{title}</span>
              <span className={`rs-chip-sub${overdue ? " is-overdue" : ""}`}>
                {overdue ? "Overdue · was " : "Now "}{item.date ? longDay(item.date) : "no date"}{origStart != null ? ` · ${hm(origStart)}` : ""}
              </span>
            </span>
          </div>

          <section className="rs-section" aria-labelledby="rs-day-h">
            <h4 id="rs-day-h" className="rs-h">Day</h4>
            <div className="rs-grid" role="radiogroup" aria-labelledby="rs-day-h">
              {days.map((d) => {
                const n = load[d] || 0;
                return (
                  <button
                    key={d}
                    type="button"
                    role="radio"
                    aria-checked={target === d}
                    aria-label={`${d === today ? "Today, " : ""}${longDay(d)}, ${n} already planned${suggested.has(d) ? ", light day" : ""}`}
                    className={`rs-day${target === d ? " is-picked" : ""}${overDay === d ? " is-over" : ""}${suggested.has(d) ? " is-light" : ""}${d === today ? " is-today" : ""}`}
                    onClick={() => pickDay(d)}
                    onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; setOverDay(d); }}
                    onDragLeave={() => setOverDay((o) => (o === d ? null : o))}
                    onDrop={(e) => { e.preventDefault(); setOverDay(null); pickDay(d); }}
                  >
                    <span className="rs-dow">{d === today ? "Today" : dow(d)}</span>
                    <span className="rs-num">{dayNum(d)}</span>
                    <span className="rs-load" aria-hidden="true">{Array.from({ length: Math.min(n, 4) }, (_, i) => <i key={i} />)}</span>
                  </button>
                );
              })}
            </div>
          </section>

          <section className="rs-section" aria-labelledby="rs-dur-h">
            <h4 id="rs-dur-h" className="rs-h">How long will it take?</h4>
            <div className="rs-durs">
              {DURATIONS.map((m) => (
                <button key={m} type="button" className={`chip${duration === m ? " active" : ""}`} aria-pressed={duration === m} onClick={() => { setCustom(""); pickDuration(m); }}>{durLabel(m)}</button>
              ))}
              <label className="rs-custom">
                <input type="number" min="5" max="720" step="5" placeholder="Custom" aria-label="Custom duration in minutes"
                  value={custom} onChange={(e) => { setCustom(e.target.value); pickDuration(Number(e.target.value)); }} />
                <span>min</span>
              </label>
            </div>
          </section>

          </div>

          <div className="rs-right">
          {!target && (
            <div className="empty-state rs-empty">
              <i className="fa-regular fa-calendar empty-state-icon" aria-hidden="true" />
              <div className="empty-state-title">Pick a day</div>
              <div className="empty-state-desc">Its hours show here, with everything already booked.</div>
            </div>
          )}
          {target && (
            <section className="rs-section rs-time" aria-labelledby="rs-time-h">
              <div className="rs-time-head">
                <h4 id="rs-time-h" className="rs-h">{longDay(target)}</h4>
                <label className="checkbox-inline"><input type="checkbox" checked={noTime} onChange={(e) => setNoTime(e.target.checked)} /> Any time that day</label>
              </div>

              {blocks.allDay.length > 0 && (
                <div className="tl-allday" aria-label="All day and anytime">
                  {blocks.allDay.map((b) => <span key={b.id} className={`tl-pill kind-${b.kind}`}>{b.title}</span>)}
                </div>
              )}

              <div className={`tl${noTime ? " is-off" : ""}`} ref={railRef} onClick={onRailClick}>
                <div className="tl-inner" ref={innerRef} style={{ height: `${(DAY_END - DAY_START) * PX_PER_MIN}px` }}>
                  {hours.map((m) => (
                    <div key={m} className="tl-hour" style={{ top: `${(m - DAY_START) * PX_PER_MIN}px` }}>
                      <span className="tl-hour-label">{hm(m).replace(":00", "")}</span>
                    </div>
                  ))}
                  {target === today && nowMinutes() > DAY_START && nowMinutes() < DAY_END && (
                    <div className="tl-now" style={{ top: `${(nowMinutes() - DAY_START) * PX_PER_MIN}px` }} aria-hidden="true" />
                  )}
                  {blocks.timed.map((b) => (
                    <div key={b.id} className={`tl-block kind-${b.kind}${clashes.includes(b) ? " is-clash" : ""}`}
                      style={{ top: `${(Math.max(b.start, DAY_START) - DAY_START) * PX_PER_MIN}px`, height: `${Math.max((b.end - Math.max(b.start, DAY_START)) * PX_PER_MIN, 18)}px` }}>
                      <span className="tl-block-title">{b.title}</span>
                      <span className="tl-block-time">{hm(b.start)}–{hm(b.end)}</span>
                    </div>
                  ))}
                  {!noTime && start != null && (
                    <div
                      className={`tl-candidate${clashes.length ? " is-clash" : ""}`}
                      style={{ top: `${(start - DAY_START) * PX_PER_MIN}px`, height: `${duration * PX_PER_MIN}px` }}
                      role="slider"
                      tabIndex={0}
                      aria-label={`${title} time slot`}
                      aria-valuemin={DAY_START}
                      aria-valuemax={DAY_END - duration}
                      aria-valuenow={start}
                      aria-valuetext={`${hm(start)} to ${hm(start + duration)}`}
                      onPointerDown={onBlockDown}
                      onPointerMove={onBlockMove}
                      onPointerUp={onBlockUp}
                      onPointerCancel={onBlockUp}
                      onKeyDown={onBlockKey}
                    >
                      <span className="tl-block-title">{title}</span>
                      <span className="tl-block-time">{hm(start)}–{hm(start + duration)} · {durLabel(duration)}</span>
                    </div>
                  )}
                </div>
              </div>
              <div className="rs-time-foot">
                {noTime
                  ? <span>Scheduled for the day, no set time.</span>
                  : clashes.length
                    ? <span className="rs-clash" role="status"><i className="fa-solid fa-triangle-exclamation" aria-hidden="true" /> Overlaps {clashes.map((c) => c.title).join(", ")}</span>
                    : <span>{start != null ? `${hm(start)} – ${hm(start + duration)}` : "Click a slot"}</span>}
                {!noTime && (
                  <button type="button" className="btn-mini" onClick={() => { const s = firstFreeSlot(duration, blocks.timed, earliest); if (s != null) setStart(s); else addToast("No free slot that long left that day.", "warning"); }}>
                    First free slot
                  </button>
                )}
              </div>
            </section>
          )}
          </div>
        </div>

        <div className="uik-modal-foot">
          <button type="button" className="btn-sm btn-secondary-sm" onClick={onClose}>Cancel</button>
          <button type="button" className="btn btn-sm" disabled={!target || saving} aria-busy={saving || undefined} onClick={save}>
            {saving ? "Saving…" : !target ? "Pick a day" : `Schedule ${target === today ? "today" : `${dow(target)} ${dayNum(target)}`}${!noTime && start != null ? ` · ${hm(start)}` : ""}`}
          </button>
        </div>
      </div>
    </div>
  );
}
