import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { toDateStr } from "../utils/plannerUtils";
import { loadAccountability, updateAccountability } from "../api/accountabilityApi";
import { onDataChange } from "../utils/dataEvents";
import { useToast } from "../contexts/ToastContext";

function genId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return `a-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}
function addDays(str, n) { const d = new Date(str + "T00:00:00"); d.setDate(d.getDate() + n); return toDateStr(d); }

export default function AccountabilitySummary() {
  const navigate = useNavigate();
  const { addToast } = useToast();
  // Source of truth is Supabase (accountability_state) — the SAME store the
  // Habits page reads, through the same versioned write path. This card never
  // auto-saves a snapshot: each tap is one updateAccountability() mutation
  // against the fresh blob, and both surfaces re-load on any write.
  const [data, setData] = useState({ trackers: [], logs: [] });
  const [ready, setReady] = useState(false);
  const [loadError, setLoadError] = useState(null);
  const mounted = useRef(true);
  useEffect(() => () => { mounted.current = false; }, []);

  const load = useCallback(() => {
    return loadAccountability()
      .then((d) => { if (mounted.current) { setData(d); setLoadError(null); setReady(true); } })
      .catch((err) => { if (mounted.current) { setLoadError(err?.message || "Couldn't load accountability."); setReady(true); } });
  }, []);
  useEffect(() => { load(); return onDataChange("accountability", load); }, [load]);

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
  // Check trackers toggle: turning OFF removes every same-day log. Decided
  // against the fresh blob inside the mutator, not this card's snapshot.
  const logToday = async (t) => {
    try {
      const next = await updateAccountability((d) => {
        const sameDay = (l) => l.trackerId === t.id && l.date === todayStr;
        if (t.mode === "check" && d.logs.some(sameDay)) { d.logs = d.logs.filter((l) => !sameDay(l)); return; }
        d.logs.push({ id: genId(), trackerId: t.id, date: todayStr, at: Date.now() });
      });
      if (mounted.current) setData(next);
    } catch (err) {
      addToast(err?.message || "Couldn't save accountability.", "error");
    }
  };

  return (
    <div className="db-card col-6">
      <div className="db-card-header">
        <h3 className="db-card-title">Accountability</h3>
        <Link to="/admin/accountability" className="ai-briefing-date" style={{ color: "var(--accent)" }}>View all ›</Link>
      </div>

      {!ready ? (
        <p className="no-entries">Loading…</p>
      ) : loadError ? (
        <div className="load-error" role="alert">
          <p className="load-error-msg">{loadError}</p>
          <button type="button" className="btn-sm" onClick={() => { setReady(false); load(); }}>Retry</button>
        </div>
      ) : trackers.length === 0 ? (
        <p className="no-entries">No trackers yet. <Link to="/admin/accountability" style={{ color: "var(--accent)" }}>Add one</Link> to track gym days, habits or tallies.</p>
      ) : (
        <div className="db-list" style={{ marginTop: "0.4rem" }}>
          {trackers.map((t) => {
            const c = countOn(t.id, todayStr);
            const done = t.mode === "check" && c > 0;
            return (
              <div className="db-list-item" key={t.id}>
                <div className="db-list-item--clickable" role="button" tabIndex={0} style={{ display: "flex", alignItems: "center", gap: "0.6rem", minWidth: 0, flex: 1, cursor: "pointer" }} onClick={() => navigate(`/admin/life?tab=habits&id=${t.id}`)} onKeyDown={(ev) => { if (ev.key === "Enter") navigate(`/admin/life?tab=habits&id=${t.id}`); }}>
                                    <div className="db-list-item-content">
                    <div className="db-list-item-title">{t.name}</div>
                    <div className="db-list-item-subtitle">{streakOf(t.id)} day streak{t.mode === "count" && c > 0 ? ` · ${c} today` : ""}</div>
                  </div>
                </div>
                <button
                  className={`btn-sm ${done ? "btn-complete" : ""}`}
                  style={done ? {} : { background: "var(--bg-raised)", color: "var(--text-primary)" }}
                  onClick={() => logToday(t)}
                >
                  {t.mode === "check" ? (done ? "Done" : "Mark done") : "+ Log"}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
