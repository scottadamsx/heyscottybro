import { supabase } from "../utils/supabase";
import { formatDisplayDateTime } from "../utils/dates.js";
import { uid } from "./_base";
import { downloadBlob, slugify } from "../lib/exporter";
import { lazyImport } from "../lib/lazyImport";
import { BUG_SCREENSHOTS_BUCKET, createBugScreenshotStorage } from "./bugScreenshotStorageCore";
import { captureEstablishedOwnerId } from "../utils/authIdentityBoundary";

const BUCKET = BUG_SCREENSHOTS_BUCKET;
const screenshotStorage = createBugScreenshotStorage({
  captureOwnerId: captureEstablishedOwnerId,
  getUserId: (expectedOwnerId) => uid(expectedOwnerId),
  verifyOwnerId: (expectedOwnerId) => uid(expectedOwnerId),
  getBucket: (bucket) => supabase.storage.from(bucket),
  randomId: () => (crypto.randomUUID ? crypto.randomUUID().slice(0, 8) : Math.random().toString(36).slice(2, 10)),
});


export async function loadBugs() {
  const userId = await uid();
  const { data, error } = await supabase
    .from("bugs")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function createBug({ title, description, steps, page, priority = "medium", type = "bug" }) {
  const userId = await uid();
  const base = { user_id: userId, title, description: description || null, steps: steps || null, page: page || null, priority, status: "open" };
  // Never insert `screenshots` — it has a DB default ('[]'), so sending it is
  // what triggered the "could not find the 'screenshots' column" schema-cache
  // error on databases where the migration hasn't run. We only add `type`; if
  // that column is also missing, fall back to the core columns so creation
  // always succeeds (just without the bug/feature distinction until migrated).
  let { data, error } = await supabase.from("bugs").insert({ ...base, type }).select().single();
  if (error && /could not find|column|schema cache|\btype\b/i.test(error.message || "")) {
    ({ data, error } = await supabase.from("bugs").insert(base).select().single());
  }
  if (error) throw error;
  return data;
}

export async function updateBug(id, fields) {
  await uid();
  const patch = { ...fields };
  if ((fields.status === "resolved" || fields.status === "closed") && !fields.resolved_at) {
    patch.resolved_at = new Date().toISOString();
  }
  const { data, error } = await supabase.from("bugs").update(patch).eq("id", id).select().single();
  if (error) throw error;
  return data;
}

export async function deleteBug(id) {
  await uid();
  // Best-effort: remove this bug's screenshots from storage too.
  try {
    const { data: bug } = await supabase.from("bugs").select("screenshots").eq("id", id).single();
    const paths = bug?.screenshots || [];
    if (paths.length) await supabase.storage.from(BUCKET).remove(paths);
  } catch { /* non-fatal */ }
  const { error } = await supabase.from("bugs").delete().eq("id", id);
  if (error) throw error;
}

// ── Claude fix-prompt ────────────────────────────────────────────────────────

/**
 * Compose a ready-to-paste prompt that tells Claude (Code) to fix a bug or build
 * a feature, from everything captured on the report. The description already
 * holds the structured facets (Element / Action / Expected / Actual) that log_bug
 * stitches in, so we lead with them and wrap the whole thing in clear marching
 * orders. Returned as a plain string — the Bugs page copies it to the clipboard
 * and only reveals it on request, so it never clutters the card.
 */
export function buildFixPrompt(bug) {
  const isFeature = (bug.type || "bug") === "feature";
  const L = [];
  L.push(
    isFeature
      ? "You are working in the heyScottyBro codebase. Implement the following feature request."
      : "You are working in the heyScottyBro codebase. Investigate and fix the following bug.",
  );
  L.push("");
  L.push(`## ${isFeature ? "Feature" : "Bug"}: ${bug.title}`);
  L.push("");
  const meta = [];
  if (bug.page) meta.push(`- **Page / area:** ${bug.page}`);
  if (bug.priority) meta.push(`- **Priority:** ${bug.priority}`);
  if (meta.length) { L.push(...meta, ""); }
  if (bug.description) { L.push("### Details", "", String(bug.description).trim(), ""); }
  if (bug.steps) { L.push("### Steps to reproduce", "", String(bug.steps).trim(), ""); }
  if (bug.notes) { L.push("### Notes / prior context", "", String(bug.notes).trim(), ""); }
  L.push("### What to do");
  if (isFeature) {
    L.push(
      "1. Locate the page/element named above and the code behind it.",
      "2. Design the smallest change that delivers the wanted behaviour, matching existing patterns and conventions.",
      "3. Implement it, wiring up any state/data it needs.",
      "4. Verify the app builds and the new behaviour works end to end before reporting back.",
    );
  } else {
    L.push(
      "1. Locate the page/element named above and the code behind it.",
      "2. Diagnose the root cause of the actual behaviour — don't just patch the symptom.",
      "3. Apply a minimal, conventional fix.",
      "4. Verify the app builds and the behaviour now matches the expected result before reporting back.",
    );
  }
  return L.join("\n");
}

// ── Screenshots ────────────────────────────────────────────────────────────

// Upload a dropped image to a staging folder before any bug exists (used by
// Frodo's chat). Returns versioned path/metadata; no image bytes are persisted.
export function stageScreenshot(file, originalMetadata, expectedOwnerId = null) {
  return screenshotStorage.stage(file, originalMetadata, expectedOwnerId);
}

export async function addScreenshot(bug, file) {
  const ownerId = captureEstablishedOwnerId();
  await uid(ownerId);
  const path = await screenshotStorage.uploadForBug(bug.id, file, ownerId);

  const next = [...(bug.screenshots || []), path];
  await uid(ownerId);
  const { data, error } = await supabase.from("bugs").update({ screenshots: next }).eq("id", bug.id).select().single();
  if (error) {
    try { await screenshotStorage.removePaths([path], "Rolling back the bug screenshot"); } catch { /* keep the database error */ }
    throw error;
  }
  return data;
}

export async function removeScreenshot(bug, path) {
  const ownerId = captureEstablishedOwnerId();
  await uid(ownerId);
  await screenshotStorage.removePaths([path], "Removing the bug screenshot", ownerId);
  const next = (bug.screenshots || []).filter((p) => p !== path);
  await uid(ownerId);
  const { data, error } = await supabase.from("bugs").update({ screenshots: next }).eq("id", bug.id).select().single();
  if (error) throw error;
  return data;
}

/** Copy owned chat-staging objects into a bug-specific folder before DB use. */
export function claimStagedScreenshots(bugId, paths, expectedOwnerId = null) {
  return screenshotStorage.claim(bugId, paths, expectedOwnerId);
}

/** Delete only owned chat-staging objects (used after confirmed Clear). */
export function removeStagedScreenshots(paths, expectedOwnerId = null) {
  return screenshotStorage.removeStaged(paths, expectedOwnerId);
}

/** Remove every object under the authenticated owner's chat-staging prefix. */
export function clearStagedScreenshots(extraPaths = [], expectedOwnerId = null) {
  return screenshotStorage.clearAllStaged(extraPaths, expectedOwnerId);
}

/** Roll back copied evidence if recording its DB paths fails. */
export function removeScreenshotPaths(paths) {
  return screenshotStorage.removePaths(paths, "Rolling back copied chat evidence");
}

export async function screenshotUrl(path, expiresIn = 3600, expectedOwnerId = null) {
  const ownerId = expectedOwnerId || captureEstablishedOwnerId();
  await uid(ownerId);
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, expiresIn);
  if (error) throw new Error(`Couldn't load the screenshot preview from "${BUCKET}": ${error.message || error}`);
  if (!data?.signedUrl) throw new Error(`Couldn't load the screenshot preview from "${BUCKET}": no signed URL was returned.`);
  return data.signedUrl;
}

// ── Export: zip of a Markdown report + all screenshots ──────────────────────

function bugMarkdown(b, shotFiles) {
  const lines = [];
  lines.push(`### ${b.title}`);
  lines.push("");
  lines.push(`- **Status:** ${b.status}  ·  **Priority:** ${b.priority}`);
  if (b.page) lines.push(`- **Page:** ${b.page}`);
  lines.push(`- **Logged:** ${formatDisplayDateTime(b.created_at)}`);
  if (b.resolved_at) lines.push(`- **Resolved:** ${formatDisplayDateTime(b.resolved_at)}`);
  lines.push("");
  if (b.description) { lines.push(`**Description**`, "", b.description, ""); }
  if (b.steps) { lines.push(`**Steps to reproduce**`, "", b.steps, ""); }
  if (b.notes) { lines.push(`**Notes / resolution**`, "", b.notes, ""); }
  if (shotFiles.length) {
    lines.push(`**Screenshots**`, "");
    shotFiles.forEach((f) => lines.push(`![${f}](${f})`, ""));
  }
  lines.push("---", "");
  return lines.join("\n");
}

/**
 * Build a zip containing report.md + every screenshot, and trigger a download.
 * Returns a summary so callers (and Frodo) can confirm what was exported.
 */
export async function exportBugsZip() {
  const { default: JSZip } = await lazyImport(() => import("jszip"), "the zip builder");
  const bugs = await loadBugs();
  const zip = new JSZip();
  const shotsDir = zip.folder("screenshots");

  const reportDate = formatDisplayDateTime(new Date());
  let bugCount = 0, featCount = 0, shotCount = 0;
  const bugMd = [], featMd = [];

  for (const b of bugs) {
    const isFeature = b.type === "feature";
    const baseName = `${slugify(b.title)}-${String(b.id).slice(0, 6)}`;
    const shotFiles = [];
    const paths = b.screenshots || [];
    for (let i = 0; i < paths.length; i++) {
      try {
        const { data, error } = await supabase.storage.from(BUCKET).download(paths[i]);
        if (error || !data) continue;
        const ext = paths[i].split(".").pop() || "png";
        const fname = `${baseName}-${i + 1}.${ext}`;
        shotsDir.file(fname, data);
        shotFiles.push(`screenshots/${fname}`);
        shotCount++;
      } catch { /* skip unreadable file */ }
    }
    const md = bugMarkdown(b, shotFiles);
    if (isFeature) { featMd.push(md); featCount++; } else { bugMd.push(md); bugCount++; }
  }

  const report = [
    `# Bug & Feature Report`,
    ``,
    `_Exported ${reportDate} — ${bugCount} bug${bugCount === 1 ? "" : "s"}, ${featCount} feature request${featCount === 1 ? "" : "s"}, ${shotCount} screenshot${shotCount === 1 ? "" : "s"}._`,
    ``,
    `## Bugs (${bugCount})`,
    ``,
    bugCount ? bugMd.join("\n") : "_None._\n",
    `## Feature requests (${featCount})`,
    ``,
    featCount ? featMd.join("\n") : "_None._\n",
  ].join("\n");

  zip.file("report.md", report);
  const blob = await zip.generateAsync({ type: "blob" });
  const stamp = new Date().toISOString().slice(0, 10);
  downloadBlob(blob, `bug-report-${stamp}.zip`);

  return { bugs: bugCount, features: featCount, screenshots: shotCount, file: `bug-report-${stamp}.zip` };
}
