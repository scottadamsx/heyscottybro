import { STEPS } from "./steps";

/* The full guide in reading order — used by the sidebar and the mobile
   bottom nav so Prev/Next and the contents sheet stay in sync. */
export const GUIDE_NAV = [
  { to: "/guide", label: "Get started", end: true },
  { to: "/guide/setup", label: "Set up accounts" },
  ...STEPS.map((s) => ({ to: `/guide/step/${s.slug}`, label: `${s.num}. ${s.title}`, step: true })),
  { to: "/guide/toolkit", label: "The toolkit" },
  { to: "/guide/help", label: "Help & FAQ" },
];
