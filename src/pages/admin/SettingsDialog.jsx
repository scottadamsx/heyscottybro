import { Suspense, useEffect, useRef } from "react";
import { lazyWithReload } from "../../utils/lazyWithReload";
import { PageSkeleton } from "../../components/Skeleton";

const SettingsPage = lazyWithReload(() => import("./SettingsPage.jsx"));

/**
 * Settings as a dialog (Muse-UI rewrite, Phase 1): the rail menu opens the
 * existing SettingsPage content in a dialog over the current page. The
 * /admin/settings route keeps rendering the same page full-frame for deep
 * links; this is a second host of the same content, not a replacement.
 */
export default function SettingsDialog({ onClose }) {
  const dialogRef = useRef(null);

  useEffect(() => {
    dialogRef.current?.focus();
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    document.body.classList.add("uik-modal-open");
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.classList.remove("uik-modal-open");
    };
  }, [onClose]);

  return (
    <div
      className="settings-dialog-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <section
        className="settings-dialog"
        role="dialog"
        aria-modal="true"
        aria-label="Settings"
        ref={dialogRef}
        tabIndex={-1}
      >
        <header className="settings-dialog-head">
          <h2>Settings</h2>
          <button
            type="button"
            className="icon-x"
            onClick={onClose}
            aria-label="Close settings"
          >
            <i className="fa-solid fa-xmark" aria-hidden="true" />
          </button>
        </header>
        <div className="settings-dialog-body">
          <Suspense fallback={<PageSkeleton label="Loading settings" />}>
            <SettingsPage />
          </Suspense>
        </div>
      </section>
    </div>
  );
}
