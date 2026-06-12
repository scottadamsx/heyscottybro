import { useState, useEffect } from "react";
import { STORAGE_KEY, loadData } from "../../utils/weedCalc";
import ScottyView from "../../components/weed/ScottyView";
import MariaView from "../../components/weed/MariaView";

export default function WeedTrackerPage() {
  const [state, setState] = useState(loadData);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state]);

  const onUpdate = (fn) => {
    setState(prev => {
      const next = JSON.parse(JSON.stringify(prev));
      fn(next);
      return next;
    });
  };

  const { activeProfile } = state;

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
