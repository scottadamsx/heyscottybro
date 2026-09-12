import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { toDateStr, formatDisplayDate } from "../../utils/plannerUtils";
import { loadAccountability, updateAccountability, logHabitDone, unlogHabitDone } from "../../api/accountabilityApi";
import { habitScheduleForm, scheduleFromForm, habitScheduleLabel } from "../../utils/habitSchedule";
import { onDataChange } from "../../utils/dataEvents";
import DatePicker from "../../components/DatePicker";
import { useConfirm } from "../../hooks/useConfirm";
import { useToast } from "../../contexts/ToastContext";

const COLORS = ["#4f7cff", "#22d3ee", "#34d399", "var(--orange)", "#f87171", "#a78bfa", "var(--cyan)", "#ec4899"];
const DOW = ["S", "M", "T", "W", "T", "F", "S"];

function genId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return `a-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}
function addDays(str, n) {
  const d = new Date(str + "T00:00:00");
  d.setDate(d.getDate() + n);
  return toDateStr(d);
}

const WEEKS_BACK = 16; // how many weeks of history to show in dot grid

// Build a grid of WEEKS_BACK weeks ending today, aligned to Sun-Sat rows
function buildGrid(todayStr) {
  const today = new Date(todayStr + "T00:00:00");
  // Find the Saturday on or after today to end the grid
  const endDow = today.getDay(); // 0=Sun…6=Sat
  const daysToSat = endDow === 6 ? 0 : 6 - endDow;
  const gridEnd = new Date(today);
  gridEnd.setDate(today.getDate() + daysToSat);
  const gridStart = new Date(gridEnd);
  gridStart.setDate(gridEnd.getDate() - WEEKS_BACK * 7 + 1);
  const weeks = [];
  let cur = new Date(gridStart);
  for (let w = 0; w < WEEKS_BACK; w++) {
    const week = [];
    for (let d = 0; d < 7; d++) {
      week.push(toDateStr(cur));
      cur.setDate(cur.getDate() + 1);
    }
    weeks.push(week);
  }
  return weeks; // array of 16 arrays of 7 date strings
}

// Month labels for grid: find where the month changes
function monthLabels(weeks) {
  const labels = new Array(weeks.length).fill(null);
  let lastMonth = -1;
  weeks.forEach((week, i) => {
    const m = new Date(week[0] + "T00:00:00").getMonth();
    if (m !== lastMonth) { labels[i] = new Date(week[0] + "T00:00:00").toLocaleDateString(undefined, { month: "short" }); lastMonth = m; }
  });
  return labels;
}


function ScheduleFields({ value, onChange }) {
  return <fieldset className="form-card">
    <legend>Reminder schedule</legend>
    <div className="form-row">
      <label>Repeat
        <select value={value.reminder} onChange={(e) => onChange({ ...value, reminder: e.target.value })}>
          <option value="none">No reminder</option>
          <option value="daily">Daily</option>
          <option value="interval">Custom interval</option>
        </select>
      </label>
      {value.reminder === "interval" && <>
        <label>Every <input type="number" min="1" max="365" step="1" required value={value.every} onChange={(e) => onChange({ ...value, every: e.target.value })} /></label>
        <label>Unit <select value={value.unit} onChange={(e) => onChange({ ...value, unit: e.target.value })}><option value="days">Days</option><option value="weeks">Weeks</option></select></label>
      </>}
      {value.reminder !== "none" && <label>First due date <input type="date" required value={value.startDate} onChange={(e) => onChange({ ...value, startDate: e.target.value })} /></label>}
    </div>
    <p className="acc-hist-note">When due, this habit appears in Reminders until done. Each completion starts the next interval. Missed days stay as one reminder.</p>
  </fieldset>;
}

export default function AccountabilityPage() {
  const [params] = useSearchParams();
  const [data, setData] = useState({ trackers: [], logs: [] });
  const [ready, setReady] = useState(false);
  const [loadError, setLoadError] = useState(null);
  const { trackers, logs } = data;
  const { addToast } = useToast();
  const { confirm, dialog } = useConfirm();

  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState(() => ({ name: "", emoji: "", color: "#4f7cff", mode: "count", ...habitScheduleForm({ mode: "count" }, toDateStr(new Date())) })); // theme-fixed: user colour (default tracker colour)
  const [detailId, setDetailId] = useState(null);
  const [trackerEdit, setTrackerEdit] = useState(null); // { name, mode, color } for the tracker open in detail view
  // Deep link from Today: /admin/life?tab=habits&id=<tracker> opens that tracker.
  useEffect(() => { const id = params.get("id"); if (id) setDetailId(id); }, [params]);

  // "Today" is state, refreshed when the tab comes back into view, so a page
  // left open overnight doesn't keep logging against yesterday.
  const [todayStr, setTodayStr] = useState(() => toDateStr(new Date()));
  useEffect(() => {
    const refresh = () => { if (document.visibilityState === "visible") setTodayStr(toDateStr(new Date())); };
    document.addEventListener("visibilitychange", refresh);
    return () => document.removeEventListener("visibilitychange", refresh);
  }, []);

  // Load from Supabase; re-load whenever any surface (Today card, an agent)
  // writes the blob. Nothing is ever auto-saved from here — every user action
  // is its own versioned write via updateAccountability().
  const mounted = useRef(true);
  useEffect(() => () => { mounted.current = false; }, []);
  const load = useCallback(() => {
    return loadAccountability()
      .then((d) => { if (mounted.current) { setData(d); setLoadError(null); setReady(true); } })
      .catch((err) => { if (mounted.current) { setLoadError(err?.message || "Couldn't load habits"); setReady(true); } });
  }, []);
  useEffect(() => { load(); return onDataChange("accountability", load); }, [load]);

  useEffect(() => {
    const f = params.get("focus");
    if (!f) return;
    const el = document.getElementById(`acc-${f}`);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [params]);

  // One versioned write per user action. The mutator runs against the FRESH
  // blob (not this page's snapshot), so a log added from the Today card or by an
  // agent a second ago is never overwritten. Errors surface; nothing is retried
  // silently.
  const mutate = async (fn) => {
    try {
      const next = await updateAccountability(fn);
      if (mounted.current) setData(next);
      return true;
    } catch (err) {
      addToast(err?.message || "Couldn't save habits", "error");
      return false;
    }
  };

  const addTracker = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    let schedule;
    try { schedule = scheduleFromForm(form); }
    catch (err) { addToast(err.message, "error"); return; }
    const tracker = { schedule, id: genId(), name: form.name.trim(), emoji: form.emoji, color: form.color, mode: form.mode, created: todayStr };
    if (!await mutate((d) => { d.trackers.push(tracker); })) return;
    setForm({ name: "", emoji: "", color: "#4f7cff", mode: form.mode, ...habitScheduleForm({ mode: form.mode }, todayStr) }); // theme-fixed: user colour (default tracker colour)
    setShowAdd(false);
  };
  const deleteTracker = async (id) => {
    if (!await confirm("Delete this tracker and its history?", { title: "Delete tracker", confirmLabel: "Delete" })) return;
    if (!await mutate((d) => { d.trackers = d.trackers.filter((t) => t.id !== id); d.logs = d.logs.filter((l) => l.trackerId !== id); })) return;
    if (detailId === id) { setDetailId(null); setTrackerEdit(null); }
  };
  const logOn = async (trackerId, date) => {
    const t = data.trackers.find((x) => x.id === trackerId);
    if (!t) return;
    try { const next = await logHabitDone(t, date); if (mounted.current) setData(next); }
    catch (err) { addToast(err?.message || "Couldn't save habits", "error"); }
  };
  const deleteLog = (id) => mutate((d) => { d.logs = d.logs.filter((l) => l.id !== id); });
  const saveTrackerEdit = async (e, id) => {
    e.preventDefault();
    if (!trackerEdit?.name.trim()) return;
    let schedule;
    try { schedule = scheduleFromForm(trackerEdit); }
    catch (err) { addToast(err.message, "error"); return; }
    const patch = { schedule, name: trackerEdit.name.trim(), mode: trackerEdit.mode, color: trackerEdit.color };
    if (!await mutate((d) => { d.trackers = d.trackers.map((t) => t.id === id ? { ...t, ...patch } : t); })) return;
    setTrackerEdit(null);
  };

  const countOn = (t, date) => (logsByTracker[t.id] || []).filter((l) => l.date === date).length;
  // Checkbox trackers = once/day: toggling OFF removes every log for that day
  // (a check tracker that was converted from a counter can hold several).
  // Counter trackers increment each tap. Decided against the fresh blob.
  const logToday = async (t) => {
    const already = (logsByTracker[t.id] || []).some((l) => l.date === todayStr);
    try {
      const next = t.mode === "check" && already ? await unlogHabitDone(t, todayStr) : await logHabitDone(t, todayStr);
      if (mounted.current) setData(next);
    } catch (err) { addToast(err?.message || "Couldn't save habits", "error"); }
  };
  const logPast = async (t, date) => {
    if (!date || date > todayStr) return;
    // Matches the old behaviour: a check-mode tracker already logged that
    // past day is a no-op here (logToday is the only toggle-off path).
    if (t.mode === "check" && (logsByTracker[t.id] || []).some((l) => l.date === date)) return;
    try {
      const next = await logHabitDone(t, date);
      if (mounted.current) setData(next);
    } catch (err) { addToast(err?.message || "Couldn't save habits", "error"); }
  };

  const logsByTracker = useMemo(() => {
    const map = {};
    logs.forEach((l) => { (map[l.trackerId] = map[l.trackerId] || []).push(l); });
    return map;
  }, [logs]);

  const stats = (tid) => {
    const tl = (logsByTracker[tid] || []).slice().sort((a, b) => b.date.localeCompare(a.date) || b.at - a.at);
    const dateSet = new Set(tl.map((l) => l.date));
    // streak
    let s = 0;
    let d = todayStr;
    if (!dateSet.has(d)) { const y = addDays(todayStr, -1); if (dateSet.has(y)) d = y; else d = null; }
    while (d && dateSet.has(d)) { s++; d = addDays(d, -1); }
    // per-day counts + last 7 days strip
    const counts = {};
    tl.forEach((l) => { counts[l.date] = (counts[l.date] || 0) + 1; });
    const week = [];
    for (let i = 6; i >= 0; i--) { const ds = addDays(todayStr, -i); week.push({ ds, count: counts[ds] || 0, on: dateSet.has(ds), dow: DOW[new Date(ds + "T00:00:00").getDay()] }); }
    const weekCount = tl.filter((l) => l.date >= addDays(todayStr, -6)).length;
    return { total: tl.length, streak: s, week, weekCount, recent: tl.slice(0, 6), lastDate: tl[0]?.date };
  };

  // Detail view for a single tracker
  const renderDetail = (t) => {
    const st = stats(t.id);
    const tl = (logsByTracker[t.id] || []);
    const dateSet = new Set(tl.map((l) => l.date));
    const counts = {};
    tl.forEach((l) => { counts[l.date] = (counts[l.date] || 0) + 1; });
    const weeks = buildGrid(todayStr);
    const mLabels = monthLabels(weeks);
    const maxCount = Math.max(1, ...Object.values(counts));

    return (
      <div className="module-page" style={{ paddingTop: 0 }}>
        <div className="module-header" style={{ marginBottom: "1rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
            <button className="btn btn-sm btn-secondary-sm" onClick={() => { setDetailId(null); setTrackerEdit(null); }}>
              <i className="fa-solid fa-arrow-left" /> Back
            </button>
            
            <h2 style={{ margin: 0 }}>{t.name}</h2>
          </div>
          {!trackerEdit && (
            <div className="header-actions">
              <button type="button" className="btn-mini" onClick={() => setTrackerEdit({ name: t.name || "", mode: t.mode || "count", color: t.color || COLORS[0], ...habitScheduleForm(t, todayStr) })} title="Edit tracker">
                <i className="fa-solid fa-pen" /> Edit
              </button>
              <button type="button" className="icon-x sm" onClick={() => { deleteTracker(t.id); }} aria-label="Delete tracker"><i className="fa-solid fa-xmark" /></button>
            </div>
          )}
        </div>

        {trackerEdit && (
          <form className="form-card" onSubmit={(e) => saveTrackerEdit(e, t.id)}>
            <div className="form-panel-head">
              <h3>Edit tracker</h3>
              <button type="button" className="icon-x" onClick={() => setTrackerEdit(null)} aria-label="Cancel"><i className="fa-solid fa-xmark" /></button>
            </div>
            <div className="form-row">
              <input className="field-grow" placeholder="Tracker name" value={trackerEdit.name} onChange={(e) => setTrackerEdit({ ...trackerEdit, name: e.target.value })} required autoFocus />
            </div>
            <div className="color-picker">
              {COLORS.map((c) => (
                <button key={c} type="button" className={`color-swatch ${trackerEdit.color === c ? "selected" : ""}`} style={{ background: c }} onClick={() => setTrackerEdit({ ...trackerEdit, color: c })} aria-label={`Colour ${c}`} />
              ))}
            </div>
            <div className="day-seg" style={{ maxWidth: 320 }}>
              <button type="button" className={trackerEdit.mode === "count" ? "active" : ""} onClick={() => setTrackerEdit({ ...trackerEdit, mode: "count" })}>
                <i className="fa-solid fa-hashtag" /> Counter
              </button>
              <button type="button" className={trackerEdit.mode === "check" ? "active" : ""} onClick={() => setTrackerEdit({ ...trackerEdit, mode: "check" })}>
                <i className="fa-solid fa-check" /> Once a day
              </button>
            </div>
            <p style={{ fontSize: "0.75rem", color: "var(--text-muted)", margin: 0 }}>
              {trackerEdit.mode === "count" ? "Log multiple times a day — shows the daily count." : "One check per day — done or not done. Existing extra logs on a day are kept."}
            </p>
            <ScheduleFields value={trackerEdit} onChange={setTrackerEdit} />
            <div className="form-actions">
              <button className="btn" type="submit">Save changes</button>
              <button className="btn btn-secondary-sm" type="button" onClick={() => setTrackerEdit(null)}>Cancel</button>
            </div>
          </form>
        )}

        <p className="acc-hist-note">{habitScheduleLabel(t)}</p>
        <div className="acc-detail-stats">
          <div className="acc-stat-pill"><b>{st.total}</b><span>total</span></div>
          <div className="acc-stat-pill"><b>{st.weekCount}</b><span>this week</span></div>
          <div className="acc-stat-pill"><b>{st.streak}</b><span>day streak</span></div>
        </div>

        <div className="db-card" style={{ "--acc-color": t.color, marginBottom: "1rem" }}>
          <h3 className="db-card-title" style={{ marginBottom: "0.75rem" }}>Past {WEEKS_BACK} weeks</h3>

          {/* Month labels row */}
          <div className="acc-hist-grid">
            <div className="acc-hist-dow-col">
              {["S","M","T","W","T","F","S"].map((d, i) => (
                <div key={i} className="acc-hist-dow">{d}</div>
              ))}
            </div>
            {weeks.map((week, wi) => (
              <div key={wi} className="acc-hist-week-col">
                <div className="acc-hist-month-lbl">{mLabels[wi] || ""}</div>
                {week.map((ds) => {
                  const on = dateSet.has(ds);
                  const cnt = counts[ds] || 0;
                  const future = ds > todayStr;
                  const isToday = ds === todayStr;
                  const opacity = on ? (t.mode === "count" ? 0.3 + 0.7 * (cnt / maxCount) : 1) : 0;
                  return (
                    <div
                      key={ds}
                      className={`acc-hist-dot${isToday ? " today" : ""}${future ? " future" : ""}`}
                      style={{ background: on ? t.color : undefined, opacity: future ? 0.2 : on ? opacity : undefined }}
                      title={`${ds}${on ? ` · ${cnt > 1 ? cnt + "x" : "done"}` : ""}`}
                    />
                  );
                })}
              </div>
            ))}
          </div>
          {t.mode === "count" && <p className="acc-hist-note">Darker = more logs that day</p>}
        </div>

        {/* Log actions */}
        <div className="db-card" style={{ "--acc-color": t.color }}>
          <h3 className="db-card-title" style={{ marginBottom: "0.75rem" }}>Log</h3>
          <div className="acc-actions">
            {(() => {
              const done = t.mode === "check" && countOn(t, todayStr) > 0;
              return (
                <button className={`btn ${done ? "acc-done" : ""}`} onClick={() => logToday(t)}>
                  {t.mode === "check"
                    ? (done ? <><i className="fa-solid fa-check" /> Done today</> : <><i className="fa-solid fa-plus" /> Mark done</>)
                    : <><i className="fa-solid fa-plus" /> Log{countOn(t, todayStr) > 0 ? ` (${countOn(t, todayStr)} today)` : ""}</>}
                </button>
              );
            })()}
            <DatePicker value="" onChange={(v) => logPast(t, v)} placeholder="Log a past day" max={todayStr} />
          </div>
          {st.recent.length > 0 && (
            <div className="acc-recent" style={{ marginTop: "0.75rem" }}>
              {st.recent.map((l) => (
                <div className="acc-log" key={l.id}>
                  <span>{l.date === todayStr ? "Today" : formatDisplayDate(l.date)}</span>
                  <button className="icon-x sm" onClick={() => deleteLog(l.id)} aria-label="Remove"><i className="fa-solid fa-xmark" /></button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  };

  if (!ready) return <div style={{ padding: "2rem", textAlign: "center", color: "var(--text-muted)", fontSize: 14 }}>Loading…</div>;

  // A failed load is an error, not "no trackers" — never render an empty state
  // (or accept new writes) over data we couldn't read.
  if (loadError) {
    return (
      <div className="module-page">
        <div className="module-header"><h1>Accountability</h1></div>
        <div className="load-error" role="alert">
          <p className="load-error-msg">{loadError}</p>
          <button type="button" className="btn btn-sm" onClick={() => { setReady(false); load(); }}>Retry</button>
        </div>
      </div>
    );
  }

  if (detailId) {
    const t = trackers.find((x) => x.id === detailId);
    if (t) return renderDetail(t);
  }

  return (
    <div className="module-page">
      {dialog}
      <div className="module-header">
        <h1>Accountability</h1>
        <button className="btn" onClick={() => setShowAdd((s) => !s)}>
          <i className={`fa-solid ${showAdd ? "fa-xmark" : "fa-plus"}`} /> {showAdd ? "Close" : "New Tracker"}
        </button>
      </div>

      {showAdd && (
        <form className="form-card" onSubmit={addTracker} style={{ maxWidth: 520 }}>
          <div className="form-row">
            <input className="field-grow" placeholder="Track what? (e.g. Gym, Read, Journal)" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} autoFocus required />
          </div>
          <div className="color-picker">
            {COLORS.map((c) => (
              <button key={c} type="button" className={`color-swatch ${form.color === c ? "selected" : ""}`} style={{ background: c }} onClick={() => setForm({ ...form, color: c })} />
            ))}
          </div>
          <div className="day-seg" style={{ maxWidth: 320 }}>
            <button type="button" className={form.mode === "count" ? "active" : ""} onClick={() => setForm({ ...form, mode: "count", ...(form.reminder === "interval" ? {} : { reminder: "none" }) })}>
              <i className="fa-solid fa-hashtag" /> Counter
            </button>
            <button type="button" className={form.mode === "check" ? "active" : ""} onClick={() => setForm({ ...form, mode: "check", ...(form.reminder === "interval" ? {} : { reminder: "daily" }) })}>
              <i className="fa-solid fa-check" /> Once a day
            </button>
          </div>
          <p style={{ fontSize: "0.75rem", color: "var(--text-muted)", margin: 0 }}>
            {form.mode === "count" ? "Log multiple times a day — shows the daily count." : "One check per day — done or not done."}
          </p>
          <ScheduleFields value={form} onChange={setForm} />
          <button className="btn" type="submit" style={{ width: "fit-content" }}>Create tracker</button>
        </form>
      )}

      {trackers.length === 0 && !showAdd && (
        <p className="no-entries">No trackers yet. Add one to start logging gym days, habits, or running tallies.</p>
      )}

      <div className="acc-grid">
        {trackers.map((t) => {
          const st = stats(t.id);
          return (
            <div className="acc-card" id={`acc-${t.id}`} key={t.id} style={{ "--acc-color": t.color }}>
              <div className="acc-card-top" style={{ cursor: "pointer" }} onClick={() => setDetailId(t.id)} role="button" tabIndex={0} onKeyDown={(e) => e.key === "Enter" && setDetailId(t.id)}>
                
                <div className="acc-card-name">{t.name}</div>
                <button className="icon-x sm" onClick={(e) => { e.stopPropagation(); deleteTracker(t.id); }} aria-label="Delete tracker"><i className="fa-solid fa-xmark" /></button>
              </div>

              <p className="acc-hist-note">{habitScheduleLabel(t)}</p>
              <div className="acc-stats">
                <div className="acc-big"><b>{st.total}</b><span>total</span></div>
                <div className="acc-sub"><b>{st.weekCount}</b><span>this week</span></div>
                <div className="acc-sub"><b>{st.streak}</b><span>day streak</span></div>
              </div>

              <div className="acc-week">
                {st.week.map((w, i) => (
                  <div key={i} className="acc-day">
                    <span className={`acc-dot ${w.on ? "on" : ""} ${w.ds === todayStr ? "today" : ""}`}>
                      {t.mode === "count" && w.count > 0 ? w.count : ""}
                    </span>
                    <span className="acc-day-lbl">{w.dow}</span>
                  </div>
                ))}
              </div>

              <div className="acc-actions">
                {(() => {
                  const done = t.mode === "check" && countOn(t, todayStr) > 0;
                  return (
                    <button className={`btn ${done ? "acc-done" : ""}`} onClick={() => logToday(t)}>
                      {t.mode === "check"
                        ? (done ? <><i className="fa-solid fa-check" /> Done today</> : <><i className="fa-solid fa-plus" /> Mark done</>)
                        : <><i className="fa-solid fa-plus" /> Log{countOn(t, todayStr) > 0 ? ` (${countOn(t, todayStr)} today)` : ""}</>}
                    </button>
                  );
                })()}
                <DatePicker value="" onChange={(v) => logPast(t, v)} placeholder="Log a past day" max={todayStr} />
              </div>

              {st.recent.length > 0 && (
                <div className="acc-recent">
                  {st.recent.map((l) => (
                    <div className="acc-log" key={l.id}>
                      <span>{l.date === todayStr ? "Today" : formatDisplayDate(l.date)}</span>
                      <button className="icon-x sm" onClick={() => deleteLog(l.id)} aria-label="Remove"><i className="fa-solid fa-xmark" /></button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
