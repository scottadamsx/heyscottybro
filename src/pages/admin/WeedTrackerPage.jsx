import { useState, useEffect, useRef } from "react";
import { freshState } from "../../utils/weedCalc";
import { loadWeedState, saveWeedState } from "../../api/weedApi";
import ScottyView from "../../components/weed/ScottyView";
import MariaView from "../../components/weed/MariaView";

export default function WeedTrackerPage() {
  const [state, setState] = useState(freshState);
  const [ready, setReady] = useState(false);

  // Load from Supabase (with localStorage fallback) on mount.
  useEffect(() => {
    let alive = true;
    loadWeedState().then((s) => { if (alive) { setState(s); setReady(true); } });
    return () => { alive = false; };
  }, []);

  // Debounced save so rapid hits collapse into one write.
  const saveTimer = useRef(null);
  useEffect(() => {
    if (!ready) return;
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => { saveWeedState(state); }, 500);
    return () => clearTimeout(saveTimer.current);
  }, [state, ready]);

  const onUpdate = (fn) => {
    setState(prev => {
      const next = JSON.parse(JSON.stringify(prev));
      fn(next);
      return next;
    });
  };

  const { activeProfile } = state;

  if (!ready) return <div style={{ padding: "2rem", textAlign: "center", color: "var(--text-muted)", fontSize: 14 }}>Loading…</div>;

  return (
    <div className="module-page">
      <div className="module-header" style={{ flexWrap: "wrap", gap: "0.75rem" }}>
        <h1>🌿 Wind Down</h1>
        <div className="wt-profile-switcher">
          <button
            className={`wt-profile-btn scott${activeProfile === "scott" ? " active" : ""}`}
            onClick={() => onUpdate(d => { d.activeProfile = "scott"; })}
          >
            <span className="wt-profile-dot" />
            Scott
          </button>
          <button
            className={`wt-profile-btn maria${activeProfile === "maria" ? " active" : ""}`}
            onClick={() => onUpdate(d => { d.activeProfile = "maria"; })}
          >
            <span className="wt-profile-dot" />
            Maria
          </button>
        </div>
      </div>

      {activeProfile === "scott" && <ScottyView state={state} onUpdate={onUpdate} />}
      {activeProfile === "maria" && <MariaView state={state} onUpdate={onUpdate} />}
    </div>
  );
}
