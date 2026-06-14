export default function EmptyState({ icon = "fa-inbox", title, description, action }) {
  return (
    <div className="empty-state">
      <div className="empty-state-icon"><i className={`fa-solid ${icon}`} /></div>
      <div className="empty-state-title">{title}</div>
      {description && <div className="empty-state-desc">{description}</div>}
      {action && <div className="empty-state-action">{action}</div>}
    </div>
  );
}
