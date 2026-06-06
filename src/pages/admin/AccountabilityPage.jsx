import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { toDateStr, formatDisplayDate } from "../../utils/plannerUtils";
import DatePicker from "../../components/DatePicker";

const KEY = "accountability";
const EMOJIS = ["🔥", "🏋️", "🏃", "🧘", "📚", "💧", "🥗", "💸", "🛌", "🧹", "🎸", "💖", "☕", "🚭", "✍️", "🙏"];
const COLORS = ["#4f7cff", "#22d3ee", "#34d399", "#f59e0b", "#f87171", "#a78bfa", "#fb923c", "#ec4899"];
const DOW = ["S", "M", "T", "W", "T", "F", "S"];

function genId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return `a-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}
function loadData() {
  try {
    const d = JSON.parse(localStorage.getItem(KEY));
    if (d && Array.isArray(d.trackers) && Array.isArray(d.logs)) return d;
  } catch { /* ignore */ }
  return { trackers: [], logs: [] };
}
function addDays(str, n) {
  const d = new Date(str + "T00:00:00");
  d.setDate(d.getDate() + n);
  return toDateStr(d);
}

export default function AccountabilityPage() {
  const [params] = useSearchParams();
  const [data, setData] = useState(loadData);
  const { trackers, logs } = data;

  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ name: "", emoji: "🔥", color: "#4f7cff" });

  const todayStr = toDateStr(new Date());

  useEffect(() => { localStorage.setItem(KEY, JSON.stringify(data)); }, [data]);

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
    update((d) => { d.trackers.push({ id: genId(), name: form.name.trim(), emoji: form.emoji, color: form.color, created: todayStr }); return d; });
    setForm({ name: "", emoji: "🔥", color: "#4f7cff" });
    setShowAdd(false);
  };
  const deleteTracker = (id) => {
    if (!confirm("Delete this tracker and its history?")) return;
    update((d) => { d.trackers = d.trackers.filter((t) => t.id !== id); d.logs = d.logs.filter((l) => l.trackerId !== id); return d; });
  };
  const logOn = (trackerId, date) => update((d) => { d.logs.push({ id: genId(), trackerId, date, at: Date.now() }); return d; });
  const deleteLog = (id) => update((d) => { d.logs = d.logs.filter((l) => l.id !== id); return d; });

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
    // last 7 days strip
    const week = [];
    for (let i = 6; i >= 0; i--) { const ds = addDays(todayStr, -i); week.push({ ds, on: dateSet.has(ds), dow: DOW[new Date(ds + "T00:00:00").getDay()] }); }
    const weekCount = tl.filter((l) => l.date >= addDays(todayStr, -6)).length;
    return { total: tl.length, streak: s, week, weekCount, recent: tl.slice(0, 6), lastDate: tl[0]?.date };
  };

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
              <div className="acc-card-top">
                <span className="acc-emoji">{t.emoji}</span>
                <div className="acc-card-name">{t.name}</div>
                <button className="icon-x sm" onClick={() => deleteTracker(t.id)} aria-label="Delete tracker"><i className="fa-solid fa-xmark" /></button>
              </div>

              <div className="acc-stats">
                <div className="acc-big"><b>{st.total}</b><span>total</span></div>
                <div className="acc-sub"><b>{st.weekCount}</b><span>this week</span></div>
                <div className="acc-sub"><b>{st.streak}🔥</b><span>streak</span></div>
              </div>

              <div className="acc-week">
                {st.week.map((w, i) => (
                  <div key={i} className="acc-day">
                    <span className={`acc-dot ${w.on ? "on" : ""} ${w.ds === todayStr ? "today" : ""}`} />
                    <span className="acc-day-lbl">{w.dow}</span>
                  </div>
                ))}
              </div>

              <div className="acc-actions">
                <button className="btn" onClick={() => logOn(t.id, todayStr)} disabled={false}>
                  <i className="fa-solid fa-plus" /> Log today
                </button>
                <DatePicker value="" onChange={(v) => v && logOn(t.id, v)} placeholder="Log a past day" />
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
