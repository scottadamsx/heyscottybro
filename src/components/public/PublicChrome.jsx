/**
 * Site-wide chrome for the PUBLIC pages (everything outside /admin).
 *
 * App.jsx renders <PublicSkipLink/> before <Routes> (so it is the first tab
 * stop) and <PublicChrome/> after (so the floating buttons come last in the
 * tab order). Both render nothing under /admin — the admin shell has its own
 * skip link and chrome, and its links are never rewritten.
 *
 * Kept light on purpose: the skip link and the UTM click handler are tiny;
 * the floating dock (back-to-top, contact, storage notice) is lazy-loaded.
 */
import { lazy, Suspense, useEffect } from "react";
import { useLocation } from "react-router-dom";
import { tagOutboundHref } from "../../utils/utm";
import "../../styles/public.css";

const PublicDock = lazy(() => import("./PublicDock.jsx"));

const isAdminPath = (p) => /^\/admin(\/|$)/.test(p);
// Full-screen iframe games: a floating contact button would sit on the game.
const isEmbedPath = (p) => /^\/games\/(minecraft-trivia|monopoly-banker)\/?$/.test(p);

/** First focusable element: jumps to the page's <main id="main">. */
export function PublicSkipLink() {
  const { pathname } = useLocation();
  if (isAdminPath(pathname)) return null;
  const onClick = (e) => {
    const main = document.getElementById("main");
    if (!main) return; // let the browser try the hash
    e.preventDefault();
    if (!main.hasAttribute("tabindex")) main.setAttribute("tabindex", "-1");
    main.focus({ preventScroll: true });
    main.scrollIntoView({ block: "start" });
  };
  return <a className={`pub-skip${pathname === "/" ? " is-xp" : ""}`} href="#main" onClick={onClick}>Skip to content</a>;
}

/**
 * Outbound links get UTM params at click time (click, middle-click and
 * right-click → "copy link"). The decision is made by tagOutboundHref(), which
 * re-checks the CURRENT path, so nothing under /admin or /doc is ever touched,
 * nor mailto:/tel:, same-site links, or anything carrying a token/signature.
 * Opt a link out with data-no-utm.
 */
function useUtmLinks() {
  useEffect(() => {
    const onPoint = (e) => {
      const a = e.target instanceof Element ? e.target.closest("a[href]") : null;
      if (!a || a.hasAttribute("download") || a.hasAttribute("data-no-utm")) return;
      const href = a.getAttribute("href");
      const next = tagOutboundHref(href, { origin: window.location.origin, pathname: window.location.pathname });
      if (next !== href) a.setAttribute("href", next);
    };
    const opts = { capture: true };
    document.addEventListener("click", onPoint, opts);
    document.addEventListener("auxclick", onPoint, opts);
    document.addEventListener("contextmenu", onPoint, opts);
    return () => {
      document.removeEventListener("click", onPoint, opts);
      document.removeEventListener("auxclick", onPoint, opts);
      document.removeEventListener("contextmenu", onPoint, opts);
    };
  }, []);
}

/** Print: open every closed <details> so FAQ answers make it onto paper, then restore. */
function usePrintOpensDetails() {
  useEffect(() => {
    let opened = [];
    const before = () => {
      if (isAdminPath(window.location.pathname)) return;
      opened = [...document.querySelectorAll("details:not([open])")];
      opened.forEach((d) => { d.open = true; });
    };
    const after = () => { opened.forEach((d) => { d.open = false; }); opened = []; };
    window.addEventListener("beforeprint", before);
    window.addEventListener("afterprint", after);
    return () => { window.removeEventListener("beforeprint", before); window.removeEventListener("afterprint", after); };
  }, []);
}

export default function PublicChrome() {
  const { pathname } = useLocation();
  useUtmLinks();
  usePrintOpensDetails();
  if (isAdminPath(pathname)) return null;

  const home = pathname === "/";
  const embed = isEmbedPath(pathname);
  const doc = pathname.startsWith("/doc/");
  return (
    <Suspense fallback={null}>
      <PublicDock
        variant={home ? "xp" : doc ? "plain" : "terminal"}
        showContact={!embed && !doc}
        showTop={!home && !embed}
        raised={pathname.startsWith("/guide")}
      />
    </Suspense>
  );
}
