export default function PageTabs({ tabs, active, onChange }) {
  return (
    <div className="page-tabs">
      {tabs.map((t) => (
        <button
          key={t.key}
          className={`page-tab${active === t.key ? " active" : ""}`}
          onClick={() => onChange(t.key)}
        >
          {t.icon && <i className={`fa-solid ${t.icon}`} />}
          {t.label}
        </button>
      ))}
    </div>
  );
}
