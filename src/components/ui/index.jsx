/**
 * The UI kit — the shared primitives every admin page composes from.
 * Token-driven (no hardcoded colors), className-driven (no inline style soup).
 * Import: `import { Card, StatTile, Badge, Modal, PageHeader } from "../../components/ui";`
 */
import { cloneElement, isValidElement, useEffect, useId, useRef, useState } from "react";
import ExportKit from "./ExportKit";
import "./ui.css";

export { ExportKit };

/** The trailing "opens something" chevron on a clickable list row. */
export function RowChevron() {
  return <i className="fa-solid fa-chevron-right db-list-item-chevron" aria-hidden="true" />;
}

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

/**
 * The one dialog shell. Real dialog semantics (role, aria-modal, labelled title),
 * focus moves in and returns on close, Tab stays inside, Esc closes, page scroll
 * locks. On phones it becomes a bottom sheet (system.css).
 */
export function Modal({ title, onClose, footer, width = 560, children, className = "" }) {
  const ref = useRef(null);
  const titleId = useId();
  const closeRef = useRef(onClose);
  useEffect(() => { closeRef.current = onClose; }, [onClose]);
  useEffect(() => {
    const node = ref.current;
    const previous = document.activeElement;
    const focusables = () => [...node.querySelectorAll(FOCUSABLE)].filter((el) => el.offsetParent !== null);
    (node.querySelector("[data-autofocus]") || focusables().find((el) => !el.classList.contains("uik-modal-x")) || node).focus();
    const onKey = (e) => {
      if (e.key === "Escape") { e.stopPropagation(); closeRef.current?.(); return; }
      if (e.key !== "Tab") return;
      const items = focusables();
      if (!items.length) return;
      const first = items[0], last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    node.addEventListener("keydown", onKey);
    document.body.classList.add("uik-modal-open");
    return () => {
      node.removeEventListener("keydown", onKey);
      if (!document.querySelector(".uik-modal")) document.body.classList.remove("uik-modal-open");
      if (previous?.isConnected) previous.focus();
    };
  }, []);
  return (
    <div className="uik-modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose?.()}>
      <div
        ref={ref}
        className={`uik-modal ${className}`}
        style={{ width: `min(${width}px, 100%)` }}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
      >
        <div className="uik-modal-head">
          <h3 id={titleId}>{title}</h3>
          <button type="button" className="uik-modal-x" onClick={onClose} aria-label="Close"><i className="fa-solid fa-xmark" /></button>
        </div>
        <div className="uik-modal-body">{children}</div>
        {footer && <div className="uik-modal-foot">{footer}</div>}
      </div>
    </div>
  );
}

/**
 * A labelled field inside a FormModal: <Field label="Weight (lb)" hint="…"><input …/></Field>
 * The hint sits outside the label (so it isn't read as the field's name) and is linked to a
 * single child control with aria-describedby.
 */
export function Field({ label, hint, children, className = "" }) {
  const hintId = useId();
  const only = hint && isValidElement(children) ? cloneElement(children, { "aria-describedby": hintId }) : children;
  return (
    <div className={`uik-field ${className}`}>
      <label className="uik-field-label">
        <span className="field-label">{label}</span>
        {only}
      </label>
      {hint && <span className="field-hint" id={hintId}>{hint}</span>}
    </div>
  );
}

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Every form in the admin lives here (DR-019): a button on the page opens it,
 * Enter or the primary button submits, Cancel/Esc closes. `onSubmit` may be
 * async; while it runs the buttons lock, and a thrown error is shown in the
 * modal (the form stays open with what was typed). Resolve to close.
 *
 *   {open && <FormModal title="Log weight" submitLabel="Save" onClose={...} onSubmit={save}>…fields…</FormModal>}
 */
export function FormModal({
  title, onClose, onSubmit, submitLabel = "Save", cancelLabel = "Cancel",
  submitDisabled = false, danger = false, width = 520, children, extraActions = null, className = "",
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const formId = useId();
  const submit = async (e) => {
    e.preventDefault();
    if (busy || submitDisabled) return;
    setBusy(true);
    setError(null);
    try {
      const keepOpen = await onSubmit?.();
      if (keepOpen !== false) onClose?.();
    } catch (err) {
      setError(err?.message || String(err));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal
      title={title}
      width={width}
      className={className}
      onClose={() => !busy && onClose?.()}
      footer={
        <>
          {extraActions && <div className="uik-modal-foot-extra">{extraActions}</div>}
          <button type="button" className="btn btn-secondary" onClick={onClose} disabled={busy}>{cancelLabel}</button>
          <button type="submit" form={formId} className={`btn ${danger ? "btn-danger" : "btn-primary"}`} disabled={busy || submitDisabled}>
            {busy ? "Saving…" : submitLabel}
          </button>
        </>
      }
    >
      <form id={formId} className="uik-form" onSubmit={submit} noValidate={false}>
        {children}
        {error && <p className="form-error" role="alert">{error}</p>}
      </form>
    </Modal>
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
