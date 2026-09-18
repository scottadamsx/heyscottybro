/**
 * The floating dock on public pages: storage notice (left / bottom) and a
 * stack of round buttons (right) — Contact above Back-to-top, so neither ever
 * covers the other. Lazy-loaded by PublicChrome.
 */
import { useEffect, useRef, useState } from "react";
import NewsletterForm from "./NewsletterForm.jsx";

const NOTICE_KEY = "hsb-storage-notice"; // value: "v1" once dismissed (bump to re-show after a policy change)
const NOTICE_VERSION = "v1";

const CONTACTS = [
  { label: "Email", detail: "scottadamsx@gmail.com", href: "mailto:scottadamsx@gmail.com", icon: "fa-solid fa-envelope" },
  { label: "Phone", detail: "709-730-2937", href: "tel:7097302937", icon: "fa-solid fa-phone" },
  { label: "LinkedIn", detail: "in/scottadams", href: "https://linkedin.com/in/scottadams", icon: "fa-brands fa-linkedin-in", ext: true },
  { label: "GitHub", detail: "scotty3xe", href: "https://github.com/scotty3xe", icon: "fa-brands fa-github", ext: true },
  { label: "Instagram", detail: "@scotty3xe", href: "https://instagram.com/scotty3xe", icon: "fa-brands fa-instagram", ext: true },
  { label: "Spotify", detail: "scotty.3xe", href: "https://open.spotify.com/artist/2cLUqlaPtqUPBAMn5gdRbe", icon: "fa-brands fa-spotify", ext: true },
];

const prefersReducedMotion = () => {
  try { return window.matchMedia("(prefers-reduced-motion: reduce)").matches; } catch { return false; }
};

function readNoticeDismissed() {
  try { return localStorage.getItem(NOTICE_KEY) === NOTICE_VERSION; }
  catch { return false; } // storage blocked: show the notice; dismissal lasts this page view only
}

function BackToTop() {
  const [show, setShow] = useState(false);
  useEffect(() => {
    const onScroll = () => setShow(window.scrollY > window.innerHeight * 0.9);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => { window.removeEventListener("scroll", onScroll); window.removeEventListener("resize", onScroll); };
  }, []);
  if (!show) return null;
  const toTop = () => {
    window.scrollTo({ top: 0, behavior: prefersReducedMotion() ? "auto" : "smooth" });
    // Move keyboard focus back to the top too, without a second jump.
    const main = document.getElementById("main");
    if (main) { if (!main.hasAttribute("tabindex")) main.setAttribute("tabindex", "-1"); main.focus({ preventScroll: true }); }
  };
  return (
    <button type="button" className="pub-fab pub-fab-top" onClick={toTop} aria-label="Back to top" title="Back to top">
      <i className="fa-solid fa-arrow-up" aria-hidden="true" />
    </button>
  );
}

function ContactDialog({ open, onClose, variant }) {
  const ref = useRef(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      className={`pub-contact pub-contact-${variant}`}
      aria-labelledby="pub-contact-title"
      onClose={onClose}
      onClick={(e) => { if (e.target === ref.current) onClose(); }} // click on the backdrop
    >
      <div className="pub-contact-inner">
        <header className="pub-contact-head">
          <h2 id="pub-contact-title">Get in touch</h2>
          <button type="button" className="pub-contact-close" onClick={onClose} aria-label="Close contact panel">
            <i className="fa-solid fa-xmark" aria-hidden="true" />
          </button>
        </header>
        <p className="pub-contact-lede">A project, a collab, or just a conversation — my inbox is open. Based in St. John&apos;s, NL.</p>
        <ul className="pub-contact-list">
          {CONTACTS.map((c) => (
            <li key={c.label}>
              <a href={c.href} {...(c.ext ? { target: "_blank", rel: "noreferrer" } : {})}>
                <i className={c.icon} aria-hidden="true" />
                <span className="pub-contact-label">{c.label}</span>
                <span className="pub-contact-detail">{c.detail}</span>
                {c.ext && <><i className="fa-solid fa-arrow-up-right-from-square pub-contact-ext" aria-hidden="true" /><span className="pub-sr"> (opens in a new tab)</span></>}
              </a>
            </li>
          ))}
        </ul>
        {open && <NewsletterForm source="contact-panel" variant={variant === "xp" ? "xp" : "terminal"} heading="Or get the occasional update" />}
      </div>
    </dialog>
  );
}

function StorageNotice({ variant, onDismiss }) {
  return (
    <section className={`pub-notice pub-notice-${variant}`} aria-label="Cookies and storage">
      <p>
        <strong>No tracking here.</strong> This site sets no advertising or analytics cookies. It only keeps
        essentials in your browser&apos;s own storage — sign-in for Scott&apos;s private tools, preferences like
        window positions, and a note that you&apos;ve seen this message.
      </p>
      <button type="button" onClick={onDismiss}>OK</button>
    </section>
  );
}

export default function PublicDock({ variant = "terminal", showContact = true, showTop = true, raised = false }) {
  const [contactOpen, setContactOpen] = useState(false);
  const [noticeDone, setNoticeDone] = useState(readNoticeDismissed);

  const dismiss = () => {
    setNoticeDone(true);
    try { localStorage.setItem(NOTICE_KEY, NOTICE_VERSION); } catch { /* blocked storage: hidden for this visit only */ }
  };

  return (
    <div className={`pub-dock pub-dock-${variant}${raised ? " is-raised" : ""}`}>
      {!noticeDone && <StorageNotice variant={variant} onDismiss={dismiss} />}
      {(showContact || showTop) && (
        <div className="pub-fabs">
          {showContact && (
            <button type="button" className="pub-fab pub-fab-contact" onClick={() => setContactOpen(true)} aria-haspopup="dialog" aria-expanded={contactOpen}>
              <i className="fa-solid fa-envelope" aria-hidden="true" /> <span>Contact</span>
            </button>
          )}
          {showTop && <BackToTop />}
        </div>
      )}
      {showContact && <ContactDialog open={contactOpen} onClose={() => setContactOpen(false)} variant={variant} />}
    </div>
  );
}
