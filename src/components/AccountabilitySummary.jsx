import { useState } from "react";
import { Link } from "react-router-dom";
import { toDateStr } from "../utils/plannerUtils";

const KEY = "accountability";
const todayStr = toDateStr(new Date());

function genId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return `a-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}
function addDays(str, n) { const d = new Date(str + "T00:00:00"); d.setDate(d.getDate() + n); return toDateStr(d); }
function load() {
  try { const d = JSON.parse(localStorage.getItem(KEY)); if (Array.isArray(d?.trackers) && Array.isArray(d?.logs)) return d; } catch { /* ignore */ }
  return { trackers: [], logs: [] };
}

export default function AccountabilitySummary() {
  const [data, setData] = useState(load);
  const trackers = data.trackers || [];
  const logs = data.logs || [];

  const save = (d) => { setData(d); localStorage.setItem(KEY, JSON.stringify(d)); };
  const countOn = (tid, date) => logs.filter((l) => l.trackerId === tid && l.date === date).length;
  const streakOf = (tid) => {
    const set = new Set(logs.filter((l) => l.trackerId === tid).map((l) => l.date));
    let s = 0, d = todayStr;
    if (!set.has(d)) { const y = addDays(todayStr, -1); d = set.has(y) ? y : null; }
    while (d && set.has(d)) { s++; d = addDays(d, -1); }
    return s;
  };
  const logToday = (t) => {
    const next = { trackers: trackers.map((x) => ({ ...x })), logs: logs.map((x) => ({ ...x })) };
    if (t.mode === "check") {
      const todays = next.logs.filter((l) => l.trackerId === t.id && l.date === todayStr);
      if (todays.length) { next.logs = next.logs.filter((l) => l.id !== todays[0].id); save(next); return; }
    }
    next.logs.push({ id: genId(), trackerId: t.id, date: todayStr, at: Date.now() });
    save(next);
  };

  return (
    <div className="db-card col-6">
      <div className="db-card-header">
        <h3 className="db-card-title">Accountability</h3>
        <Link to="/admin/accountability" className="ai-briefing-date" style={{ color: "var(--accent)" }}>View all ›</Link>
      </div>

      {trackers.length === 0 ? (
        <p className="no-entries">No trackers yet. <Link to="/admin/accountability" style={{ color: "var(--accent)" }}>Add one</Link> to track gym days, habits or tallies.</p>
      ) : (
        <div className="db-list" style={{ marginTop: "0.4rem" }}>
          {trackers.map((t) => {
            const c = countOn(t.id, todayStr);
            const done = t.mode === "check" && c > 0;
            return (
              <div className="db-list-item" key={t.id}>
                <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", minWidth: 0 }}>
                  <span style={{ fontSize: "1.1rem" }}>{t.emoji}</span>
                  <div className="db-list-item-content">
                    <div className="db-list-item-title">{t.name}</div>
                    <div className="db-list-item-subtitle">🔥 {streakOf(t.id)} day streak{t.mode === "count" && c > 0 ? ` · ${c} today` : ""}</div>
                  </div>
                </div>
                <button
                  className={`btn-sm ${done ? "btn-complete" : ""}`}
                  style={done ? {} : { background: "var(--bg-raised)", color: "var(--text-primary)" }}
                  onClick={() => logToday(t)}
                >
                  {t.mode === "check" ? (done ? "✓ Done" : "Mark done") : "+ Log"}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
