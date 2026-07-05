/**
 * The UI kit — the shared primitives every admin page composes from.
 * Token-driven (no hardcoded colors), className-driven (no inline style soup).
 * Import: `import { Card, StatTile, Badge, Modal, PageHeader } from "../../components/ui";`
 */
import { useEffect } from "react";
import ExportKit from "./ExportKit";
import "./ui.css";

export { ExportKit };

export function Card({ title, icon, actions, className = "", children }) {
  return (
    <section className={`uik-card ${className}`}>
      {(title || actions) && (
        <div className="uik-card-head">
          {title && <h3>{icon && <i className={`fa-solid ${icon}`} />} {title}</h3>}
          {actions && <div className="uik-card-actions">{actions}</div>}
        </div>
      )}
      {children}
    </section>
  );
}

export function StatTile({ label, value, sub, tone = "default", onClick }) {
  const Tag = onClick ? "button" : "div";
  return (
    <Tag className={`uik-stat tone-${tone}`} onClick={onClick} type={onClick ? "button" : undefined}>
      <span className="uik-stat-label">{label}</span>
      <span className="uik-stat-value">{value}</span>
      {sub && <span className="uik-stat-sub">{sub}</span>}
    </Tag>
  );
}

export function Badge({ children, tone = "default", icon }) {
  return (
    <span className={`uik-badge tone-${tone}`}>
      {icon && <i className={`fa-solid ${icon}`} />}{children}
    </span>
  );
}

export function Modal({ title, onClose, footer, width = 560, children }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onClose?.(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="uik-modal-backdrop" onClick={onClose}>
      <div className="uik-modal" style={{ width: `min(${width}px, 100%)` }} onClick={(e) => e.stopPropagation()}>
        <div className="uik-modal-head">
          <h3>{title}</h3>
          <button type="button" className="uik-modal-x" onClick={onClose} aria-label="Close"><i className="fa-solid fa-xmark" /></button>
        </div>
        <div className="uik-modal-body">{children}</div>
        {footer && <div className="uik-modal-foot">{footer}</div>}
      </div>
    </div>
  );
}

/**
 * Standard page header: icon + title, optional tab strip, actions, ExportKit.
 * tabs: [{key,label,icon?}], current tab key, onTab(key).
 */
export function PageHeader({ icon, title, tabs, tab, onTab, actions, exporter }) {
  return (
    <>
      <div className="module-header">
        <h1>{icon && <i className={`fa-solid ${icon}`} />} {title}</h1>
        <div className="uik-head-actions">
          {actions}
          {exporter && <ExportKit exporter={exporter} />}
        </div>
      </div>
      {tabs && (
        <div className="uik-tabs">
          {tabs.map((t) => (
            <button
              key={t.key}
              type="button"
              className={`uik-tab${tab === t.key ? " active" : ""}`}
              onClick={() => onTab(t.key)}
            >
              {t.icon && <i className={`fa-solid ${t.icon}`} />} {t.label}
            </button>
          ))}
        </div>
      )}
    </>
  );
}
