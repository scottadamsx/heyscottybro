import { useState } from "react";

const TABS = [
  {
    id: "upcoming",
    label: "Upcoming",
    icon: "fa-calendar-day",
    text: "This is the Phase 1 shell of the Status view. Upcoming will gather today's Planner items and open reminders here as the Planner phase lands.",
  },
  {
    id: "activity",
    label: "Activity",
    icon: "fa-clock-rotate-left",
    text: "This is the Phase 1 shell of the Status view. Activity will gather the app's recent activity here as the shell phases land.",
  },
];

/**
 * The Status view of the detail panel: Scott's equivalents of the Muse
 * panel's tabs. Phase 1 ships the view shell with Upcoming and Activity
 * (SPEC-GAP 7 recommendation); each tab fills with its real source in the
 * phase that migrates that source. Approvals waits until Scott names its
 * sources, and Identity arrives in Phase 4, so neither renders empty.
 */
export default function StatusPanel() {
  const [tab, setTab] = useState(TABS[0].id);
  const active = TABS.find((t) => t.id === tab) || TABS[0];
  return (
    <div className="status-panel">
      <div className="status-profile">
        <span className="avatar" aria-hidden="true">SA</span>
        <span className="sidebar-profile-text">
          <span className="sidebar-name">Scott Adams</span>
          <span className="sidebar-role">Personal HQ</span>
        </span>
      </div>
      <div className="segmented status-tabs" role="tablist" aria-label="Status">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            className={`segmented-opt${tab === t.id ? " active" : ""}`}
            onClick={() => setTab(t.id)}
          >
            <i className={`fa-solid ${t.icon}`} aria-hidden="true" /> {t.label}
          </button>
        ))}
      </div>
      <div className="empty-state" role="tabpanel" aria-label={active.label}>
        <span className="empty-state-icon">
          <i className={`fa-solid ${active.icon}`} aria-hidden="true" />
        </span>
        <p className="empty-state-desc">{active.text}</p>
      </div>
    </div>
  );
}
