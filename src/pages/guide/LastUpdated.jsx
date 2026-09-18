import { useLocation } from "react-router-dom";
import DATES from "./pageDates.json";

/* "Last updated <date>" under each guide page. Dates come from git history via
   scripts/page-dates.mjs (npm run page-dates) — never typed by hand. */
function pageKey(pathname) {
  const p = pathname.replace(/\/+$/, "");
  if (p === "/guide") return "start";
  if (p.startsWith("/guide/step/")) return "steps";
  return { "/guide/setup": "setup", "/guide/toolkit": "toolkit", "/guide/help": "help" }[p] || null;
}

function formatDay(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-CA", { year: "numeric", month: "long", day: "numeric" });
}

export default function LastUpdated() {
  const { pathname } = useLocation();
  const iso = DATES[pageKey(pathname)];
  if (!iso) return null; // unknown page or not in the JSON yet: say nothing rather than a wrong date
  return (
    <p className="lp-updated">
      <i className="fa-regular fa-clock" aria-hidden="true" />
      Last updated <time dateTime={iso}>{formatDay(iso)}</time>
    </p>
  );
}
