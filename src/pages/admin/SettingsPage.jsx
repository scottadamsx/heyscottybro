import { HIDE_SMOKE_TRACKER, useSetting, setSetting } from "../../utils/settings";

function Toggle({ checked, onChange, label }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      className={`settings-switch${checked ? " on" : ""}`}
      onClick={() => onChange(!checked)}
    >
      <span className="settings-switch-knob" />
    </button>
  );
}

export default function SettingsPage() {
  const hideSmoke = useSetting(HIDE_SMOKE_TRACKER);

  return (
    <div className="module-page">
      <div className="module-header">
        <h1>Settings</h1>
      </div>

      <div className="db-card">
        <div className="settings-row">
          <div className="settings-row-body">
            <div className="settings-row-title">
              <i className="fa-solid fa-leaf" /> Hide Smoke Tracker
            </div>
            <div className="settings-row-meta">
              Removes Smoke Tracker from the sidebar, menus, and command palette —
              handy when showing the dashboard to someone else. Your data is kept.
            </div>
          </div>
          <Toggle
            checked={hideSmoke}
            onChange={(v) => setSetting(HIDE_SMOKE_TRACKER, v)}
            label="Hide Smoke Tracker"
          />
        </div>
      </div>
    </div>
  );
}
