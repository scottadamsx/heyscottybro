import { useState, useEffect, useRef, useCallback } from "react";
import { Navigate } from "react-router-dom";
import { freshState } from "../../utils/weedCalc";
import { loadWeedState, saveWeedState } from "../../api/weedApi";
import ScottyView from "../../components/weed/ScottyView";
import { HIDE_SMOKE_TRACKER, useSetting } from "../../utils/settings";
import { useToast } from "../../contexts/ToastContext";

export default function WeedTrackerPage() {
  const hideSmoke = useSetting(HIDE_SMOKE_TRACKER);
  const { addToast } = useToast();
  const [state, setState] = useState(freshState);
  const [ready, setReady] = useState(false);       // load succeeded — the ONLY gate that allows a save
  const [loadError, setLoadError] = useState(null);
  const dirty = useRef(false);                       // set by a user action; never by load
  const mounted = useRef(true);
  // Re-arm on mount — StrictMode (dev) remounts with the same ref.
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);

  const load = useCallback(() => {
    setReady(false);
    setLoadError(null);
    loadWeedState()
      .then((s) => { if (mounted.current) { dirty.current = false; setState(s); setReady(true); } })
      .catch((err) => { if (mounted.current) setLoadError(err?.message || "Couldn't load the wind-down tracker."); });
  }, []);
  useEffect(() => { load(); }, [load]);

  // Debounced save: only after a successful load AND a user action. A failed
  // load never reaches here (ready stays false), so a fresh default can never
  // overwrite real data; the first render never saves (dirty is false).
  const saveTimer = useRef(null);
  useEffect(() => {
    if (!ready || !dirty.current) return;
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      saveWeedState(state).catch((err) => addToast(err?.message || "Couldn't save the wind-down tracker.", "error"));
    }, 500);
    return () => clearTimeout(saveTimer.current);
  }, [state, ready, addToast]);

  const onUpdate = (fn) => {
    dirty.current = true;
    setState((prev) => {
      const next = JSON.parse(JSON.stringify(prev));
      fn(next);
      return next;
    });
  };

  // Hidden via Settings → keep the page unreachable even by direct URL.
  if (hideSmoke) return <Navigate to="/admin/today" replace />;

  if (loadError) {
    return (
      <div className="module-page">
        <div className="module-header"><h1>Wind Down</h1></div>
        <div className="load-error" role="alert">
          <p className="load-error-msg">{loadError}</p>
          <button type="button" className="btn btn-sm" onClick={load}>Retry</button>
        </div>
      </div>
    );
  }

  if (!ready) return <p className="life-loading">Loading…</p>;

  return (
    <div className="module-page">
      <div className="module-header">
        <h1>Wind Down</h1>
      </div>

      <ScottyView state={state} onUpdate={onUpdate} />
    </div>
  );
}
