#!/usr/bin/env node
/**
 * Writes src/pages/guide/pageDates.json — the "Last updated" date shown on
 * every public guide page — from git history, so the date is never typed by hand.
 *
 *   npm run page-dates        (then commit the JSON with your guide change)
 *
 * Each guide page maps to the source file(s) that hold its words. The date is
 * the newest `git log -1 --format=%cs -- <file>` among them (committer date,
 * YYYY-MM-DD). A file with uncommitted edits counts as changed today, so running
 * this right before committing a guide edit gives the date the commit will carry.
 * All eight steps live in steps.jsx (+ figures.jsx), so they share one date.
 *
 * Run it whenever a guide page's content changes. It is not run at build time on
 * purpose: Vercel builds from a shallow clone, where git dates are unreliable.
 */
import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const G = "src/pages/guide";

/** page key (see LastUpdated.jsx) → content files */
export const PAGE_FILES = {
  start: [`${G}/GuideStart.jsx`],
  setup: [`${G}/GuideSetup.jsx`],
  steps: [`${G}/steps.jsx`, `${G}/figures.jsx`],
  toolkit: [`${G}/GuideToolkit.jsx`],
  help: [`${G}/GuideHelp.jsx`],
};

const git = (...args) => execFileSync("git", args, { cwd: ROOT, encoding: "utf8" }).trim();

function localToday() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function fileDate(file) {
  if (git("status", "--porcelain", "--", file)) return localToday(); // edited, not yet committed
  const d = git("log", "-1", "--format=%cs", "--", file);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) throw new Error(`No git history for ${file} — commit it first, then re-run.`);
  return d;
}

const out = {};
for (const [page, files] of Object.entries(PAGE_FILES)) {
  out[page] = files.map(fileDate).sort().at(-1);
}

const target = path.join(ROOT, G, "pageDates.json");
writeFileSync(target, `${JSON.stringify(out, null, 2)}\n`);
console.log(`Wrote ${path.relative(ROOT, target)}:`, out);
