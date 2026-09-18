import "../../styles/public.css";

/**
 * Loading indicator for the public site — the Suspense fallback of lazy public
 * routes and the "fetching…" state of public pages.
 *
 *   variant="terminal" (default) — the dark terminal look of /guide, /sjhc, …
 *   variant="plain"              — token-coloured, for pages on the app theme (/doc)
 *   variant="xp"                 — Luna, for the XP desktop home
 *
 * role="status" so screen readers hear the label once; the animation is
 * decorative and stops under prefers-reduced-motion.
 */
export default function PublicLoader({ label = "Loading…", variant = "terminal", fullscreen = true }) {
  return (
    <div className={`pub-loader pub-loader-${variant}${fullscreen ? " is-full" : ""}`} role="status" aria-live="polite">
      <span className="pub-loader-mark" aria-hidden="true"><i /><i /><i /></span>
      <span className="pub-loader-label">{label}</span>
    </div>
  );
}
