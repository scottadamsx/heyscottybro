import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { toDateStr } from "../utils/plannerUtils";
import { loadAccountability, saveAccountability } from "../api/accountabilityApi";

function genId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return `a-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}
function addDays(str, n) { const d = new Date(str + "T00:00:00"); d.setDate(d.getDate() + n); return toDateStr(d); }

export default function AccountabilitySummary() {
  // Source of truth is Supabase (accountability_state) — the SAME store the
  // Hearth/Accountability page reads. This card used to read localStorage only,
  // so on any device/session where the mirror was empty it showed "No trackers
  // yet" while the page (Supabase-backed) showed them. Load through the shared
  // API so the two surfaces can never disagree.
  const [data, setData] = useState({ trackers: [], logs: [] });
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let alive = true;
    loadAccountability().then((d) => { if (alive) { setData(d); setReady(true); } });
    return () => { alive = false; };
  }, []);

  // Debounced write-through so a quick "Mark done" tap persists to Supabase
  // (and the localStorage mirror) without a write per render.
  const saveTimer = useRef(null);
  useEffect(() => {
    if (!ready) return;
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => { saveAccountability(data); }, 500);
    return () => clearTimeout(saveTimer.current);
  }, [data, ready]);

  // Computed per render (not module-level) so it stays correct past midnight.
  const todayStr = toDateStr(new Date());
  const trackers = data.trackers || [];
  const logs = data.logs || [];

  const countOn = (tid, date) => logs.filter((l) => l.trackerId === tid && l.date === date).length;
  const streakOf = (tid) => {
    const set = new Set(logs.filter((l) => l.trackerId === tid).map((l) => l.date));
    let s = 0, d = todayStr;
    if (!set.has(d)) { const y = addDays(todayStr, -1); d = set.has(y) ? y : null; }
    while (d && set.has(d)) { s++; d = addDays(d, -1); }
    return s;
  };
  const logToday = (t) => {
    setData((cur) => {
      const next = { trackers: (cur.trackers || []).map((x) => ({ ...x })), logs: (cur.logs || []).map((x) => ({ ...x })) };
      if (t.mode === "check") {
        const todays = next.logs.filter((l) => l.trackerId === t.id && l.date === todayStr);
        if (todays.length) { next.logs = next.logs.filter((l) => l.id !== todays[0].id); return next; }
      }
      next.logs.push({ id: genId(), trackerId: t.id, date: todayStr, at: Date.now() });
      return next;
    });
  };

  return (
    <div className="db-card col-6">
      <div className="db-card-header">
        <h3 className="db-card-title">Accountability</h3>
        <Link to="/admin/accountability" className="ai-briefing-date" style={{ color: "var(--accent)" }}>View all ›</Link>
      </div>

      {!ready ? (
        <p className="no-entries">Loading…</p>
      ) : trackers.length === 0 ? (
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
