/**
 * A small row of quick-action pills for a page's toolbar — "+ New Event",
 * "+ New Reminder", etc. Each page passes its own list, so the toolbar
 * changes per page instead of being one fixed set of buttons.
 * actions: [{ key?, label, icon?, onClick, tone? }]
 */
export default function PageActions({ actions }) {
  if (!actions?.length) return null;
  return (
    <div className="page-actions">
      {actions.map((a) => (
        <button
          key={a.key || a.label}
          type="button"
          className={`page-action-btn${a.tone ? ` tone-${a.tone}` : ""}`}
          onClick={a.onClick}
        >
          <i className={`fa-solid ${a.icon || "fa-plus"}`} /> {a.label}
        </button>
      ))}
    </div>
  );
}
