import { useState, useEffect, useRef } from "react";
import { Navigate } from "react-router-dom";
import { freshState } from "../../utils/weedCalc";
import { loadWeedState, saveWeedState } from "../../api/weedApi";
import ScottyView from "../../components/weed/ScottyView";
import { HIDE_SMOKE_TRACKER, useSetting } from "../../utils/settings";

export default function WeedTrackerPage() {
  const hideSmoke = useSetting(HIDE_SMOKE_TRACKER);
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

  // Hidden via Settings → keep the page unreachable even by direct URL.
  if (hideSmoke) return <Navigate to="/admin/today" replace />;

  if (!ready) return <div style={{ padding: "2rem", textAlign: "center", color: "var(--text-muted)", fontSize: 14 }}>Loading…</div>;

  return (
    <div className="module-page">
      <div className="module-header" style={{ flexWrap: "wrap", gap: "0.75rem" }}>
        <h1>Wind Down</h1>
      </div>

      {activeProfile === "scott" && <ScottyView state={state} onUpdate={onUpdate} />}
    </div>
  );
}
