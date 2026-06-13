import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { toDateStr, formatDisplayDate } from "../../utils/plannerUtils";
import { loadAccountability, saveAccountability } from "../../api/accountabilityApi";
import DatePicker from "../../components/DatePicker";

const EMOJIS = ["🔥", "🏋️", "🏃", "🧘", "📚", "💧", "🥗", "💸", "🛌", "🧹", "🎸", "💖", "☕", "🚭", "✍️", "🙏"];
const COLORS = ["#4f7cff", "#22d3ee", "#34d399", "#f59e0b", "#f87171", "#a78bfa", "#fb923c", "#ec4899"];
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

export default function AccountabilityPage() {
  const [params] = useSearchParams();
  const [data, setData] = useState({ trackers: [], logs: [] });
  const [ready, setReady] = useState(false);
  const { trackers, logs } = data;

  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ name: "", emoji: "🔥", color: "#4f7cff", mode: "count" });
  const [detailId, setDetailId] = useState(null);

  const todayStr = toDateStr(new Date());

  // Load from Supabase (with localStorage fallback) on mount.
  useEffect(() => {
    let alive = true;
    loadAccountability().then((d) => { if (alive) { setData(d); setReady(true); } });
    return () => { alive = false; };
  }, []);

  // Debounced save so rapid logging collapses into one write.
  const saveTimer = useRef(null);
  useEffect(() => {
    if (!ready) return;
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => { saveAccountability(data); }, 500);
    return () => clearTimeout(saveTimer.current);
  }, [data, ready]);

  useEffect(() => {
    const f = params.get("focus");
    if (!f) return;
    const el = document.getElementById(`acc-${f}`);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [params]);

  const update = (fn) => setData((d) => fn({ trackers: d.trackers.map((t) => ({ ...t })), logs: d.logs.map((l) => ({ ...l })) }));

  const addTracker = (e) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    update((d) => { d.trackers.push({ id: genId(), name: form.name.trim(), emoji: form.emoji, color: form.color, mode: form.mode, created: todayStr }); return d; });
    setForm({ name: "", emoji: "🔥", color: "#4f7cff", mode: form.mode });
    setShowAdd(false);
  };
  const deleteTracker = (id) => {
    if (!confirm("Delete this tracker and its history?")) return;
    update((d) => { d.trackers = d.trackers.filter((t) => t.id !== id); d.logs = d.logs.filter((l) => l.trackerId !== id); return d; });
  };
  const logOn = (trackerId, date) => update((d) => { d.logs.push({ id: genId(), trackerId, date, at: Date.now() }); return d; });
  const deleteLog = (id) => update((d) => { d.logs = d.logs.filter((l) => l.id !== id); return d; });

  const countOn = (t, date) => (logsByTracker[t.id] || []).filter((l) => l.date === date).length;
  // Checkbox trackers = once/day (toggle). Counter trackers = increment each tap.
  const logToday = (t) => {
    if (t.mode === "check") {
      const todays = (logsByTracker[t.id] || []).filter((l) => l.date === todayStr);
      if (todays.length) { deleteLog(todays[0].id); return; }
    }
    logOn(t.id, todayStr);
  };
  const logPast = (t, date) => {
    if (!date) return;
    if (t.mode === "check" && (logsByTracker[t.id] || []).some((l) => l.date === date)) return;
    logOn(t.id, date);
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
            <button className="btn btn-sm btn-secondary-sm" onClick={() => setDetailId(null)}>
              <i className="fa-solid fa-arrow-left" /> Back
            </button>
            <span style={{ fontSize: "1.5rem" }}>{t.emoji}</span>
            <h2 style={{ margin: 0 }}>{t.name}</h2>
          </div>
        </div>

        <div className="acc-detail-stats">
          <div className="acc-stat-pill"><b>{st.total}</b><span>total</span></div>
          <div className="acc-stat-pill"><b>{st.weekCount}</b><span>this week</span></div>
          <div className="acc-stat-pill"><b>{st.streak}🔥</b><span>streak</span></div>
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
                      title={`${ds}${on ? ` · ${cnt > 1 ? cnt + "×" : "✓"}` : ""}`}
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
            <DatePicker value="" onChange={(v) => logPast(t, v)} placeholder="Log a past day" />
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

  if (detailId) {
    const t = trackers.find((x) => x.id === detailId);
    if (t) return renderDetail(t);
  }

  return (
    <div className="module-page">
      <div className="module-header">
        <h1>🔥 Accountability</h1>
        <button className="btn" onClick={() => setShowAdd((s) => !s)}>
          <i className={`fa-solid ${showAdd ? "fa-xmark" : "fa-plus"}`} /> {showAdd ? "Close" : "New Tracker"}
        </button>
      </div>

      {showAdd && (
        <form className="form-card" onSubmit={addTracker} style={{ maxWidth: 520 }}>
          <div className="form-row">
            <select className="emoji-select" value={form.emoji} onChange={(e) => setForm({ ...form, emoji: e.target.value })} aria-label="Emoji">
              {EMOJIS.map((em) => <option key={em} value={em}>{em}</option>)}
            </select>
            <input className="field-grow" placeholder="Track what? (e.g. Gym, Saw Maria)" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} autoFocus required />
          </div>
          <div className="color-picker">
            {COLORS.map((c) => (
              <button key={c} type="button" className={`color-swatch ${form.color === c ? "selected" : ""}`} style={{ background: c }} onClick={() => setForm({ ...form, color: c })} />
            ))}
          </div>
          <div className="day-seg" style={{ maxWidth: 320 }}>
            <button type="button" className={form.mode === "count" ? "active" : ""} onClick={() => setForm({ ...form, mode: "count" })}>
              <i className="fa-solid fa-hashtag" /> Counter
            </button>
            <button type="button" className={form.mode === "check" ? "active" : ""} onClick={() => setForm({ ...form, mode: "check" })}>
              <i className="fa-solid fa-check" /> Once a day
            </button>
          </div>
          <p style={{ fontSize: "0.75rem", color: "var(--text-muted)", margin: 0 }}>
            {form.mode === "count" ? "Log multiple times a day — shows the daily count." : "One check per day — done or not done."}
          </p>
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
                <span className="acc-emoji">{t.emoji}</span>
                <div className="acc-card-name">{t.name}</div>
                <button className="icon-x sm" onClick={(e) => { e.stopPropagation(); deleteTracker(t.id); }} aria-label="Delete tracker"><i className="fa-solid fa-xmark" /></button>
              </div>

              <div className="acc-stats">
                <div className="acc-big"><b>{st.total}</b><span>total</span></div>
                <div className="acc-sub"><b>{st.weekCount}</b><span>this week</span></div>
                <div className="acc-sub"><b>{st.streak}🔥</b><span>streak</span></div>
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
                <DatePicker value="" onChange={(v) => logPast(t, v)} placeholder="Log a past day" />
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
