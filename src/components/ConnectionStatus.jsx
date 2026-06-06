import { useEffect, useState } from "react";
import { checkConnection, getConnectionStatus, isLocalMode, setLocalMode, onConnectionChange } from "../api/plannerApi";

export default function ConnectionStatus() {
  const [connected, setConnected] = useState(getConnectionStatus());
  const [checking, setChecking] = useState(false);
  const [localOn] = useState(isLocalMode());

  const refresh = async () => {
    setChecking(true);
    await checkConnection();
    setChecking(false);
  };

  useEffect(() => {
    const off = onConnectionChange(setConnected);
    refresh();
    return off;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggleLocal = (e) => {
    setLocalMode(e.target.checked);
    window.location.reload(); // apply consistently across the app
  };

  const state = localOn ? "local" : connected === true ? "ok" : connected === false ? "down" : "unknown";
  const label = {
    local: "Local mode — saving to this browser",
    ok: "Database connected",
    down: "Database disconnected",
    unknown: "Checking database…",
  }[state];

  return (
    <div className="conn-status col-12">
      <span className={`conn-dot ${state}`} />
      <span className="conn-label">{label}</span>
      <button className="conn-btn" onClick={refresh} disabled={checking} title="Re-check connection" aria-label="Re-check">
        <i className={`fa-solid fa-rotate ${checking ? "fa-spin" : ""}`} />
      </button>
      <label className="conn-local" title="Store data in this browser instead of the database">
        <input type="checkbox" checked={localOn} onChange={toggleLocal} /> Local mode
      </label>
    </div>
  );
}
