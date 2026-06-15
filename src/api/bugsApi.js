import { supabase } from "../utils/supabase";

const BUCKET = "bug-screenshots";

async function uid() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user?.id) throw new Error("Not authenticated");
  return session.user.id;
}

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
  const { data, error } = await supabase
    .from("bugs")
    .insert({ user_id: userId, title, description: description || null, steps: steps || null, page: page || null, priority, type, status: "open", screenshots: [] })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateBug(id, fields) {
  const patch = { ...fields };
  if ((fields.status === "resolved" || fields.status === "closed") && !fields.resolved_at) {
    patch.resolved_at = new Date().toISOString();
  }
  const { data, error } = await supabase.from("bugs").update(patch).eq("id", id).select().single();
  if (error) throw error;
  return data;
}

export async function deleteBug(id) {
  // Best-effort: remove this bug's screenshots from storage too.
  try {
    const { data: bug } = await supabase.from("bugs").select("screenshots").eq("id", id).single();
    const paths = bug?.screenshots || [];
    if (paths.length) await supabase.storage.from(BUCKET).remove(paths);
  } catch { /* non-fatal */ }
  const { error } = await supabase.from("bugs").delete().eq("id", id);
  if (error) throw error;
}

// ── Screenshots ────────────────────────────────────────────────────────────

// Upload a dropped image to a staging folder before any bug exists (used by
// Frodo's chat). Returns the storage path; log_bug later claims it.
export async function stageScreenshot(file) {
  const userId = await uid();
  const ext = (file.name?.split(".").pop() || "png").toLowerCase();
  const rand = crypto.randomUUID ? crypto.randomUUID().slice(0, 8) : Math.random().toString(36).slice(2, 10);
  const path = `${userId}/_staging/${Date.now()}-${rand}.${ext}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    contentType: file.type || "image/png", upsert: false,
  });
  if (error) throw error;
  return path;
}

export async function addScreenshot(bug, file) {
  const userId = await uid();
  const ext = (file.name?.split(".").pop() || "png").toLowerCase();
  const rand = crypto.randomUUID ? crypto.randomUUID().slice(0, 8) : Math.random().toString(36).slice(2, 10);
  const path = `${userId}/${bug.id}/${Date.now()}-${rand}.${ext}`;
  const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, file, {
    contentType: file.type || "image/png", upsert: false,
  });
  if (upErr) throw upErr;

  const next = [...(bug.screenshots || []), path];
  const { data, error } = await supabase.from("bugs").update({ screenshots: next }).eq("id", bug.id).select().single();
  if (error) { await supabase.storage.from(BUCKET).remove([path]); throw error; } // rollback
  return data;
}

export async function removeScreenshot(bug, path) {
  await supabase.storage.from(BUCKET).remove([path]);
  const next = (bug.screenshots || []).filter((p) => p !== path);
  const { data, error } = await supabase.from("bugs").update({ screenshots: next }).eq("id", bug.id).select().single();
  if (error) throw error;
  return data;
}

export async function screenshotUrl(path, expiresIn = 3600) {
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, expiresIn);
  if (error) throw error;
  return data.signedUrl;
}

// ── Export: zip of a Markdown report + all screenshots ──────────────────────

function slugify(s) {
  return (s || "untitled").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40) || "item";
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

function bugMarkdown(b, shotFiles) {
  const lines = [];
  lines.push(`### ${b.title}`);
  lines.push("");
  lines.push(`- **Status:** ${b.status}  ·  **Priority:** ${b.priority}`);
  if (b.page) lines.push(`- **Page:** ${b.page}`);
  lines.push(`- **Logged:** ${new Date(b.created_at).toLocaleString()}`);
  if (b.resolved_at) lines.push(`- **Resolved:** ${new Date(b.resolved_at).toLocaleString()}`);
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
  const { default: JSZip } = await import("jszip");
  const bugs = await loadBugs();
  const zip = new JSZip();
  const shotsDir = zip.folder("screenshots");

  const reportDate = new Date().toLocaleString();
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
    `## 🐞 Bugs (${bugCount})`,
    ``,
    bugCount ? bugMd.join("\n") : "_None._\n",
    `## ✨ Feature requests (${featCount})`,
    ``,
    featCount ? featMd.join("\n") : "_None._\n",
  ].join("\n");

  zip.file("report.md", report);
  const blob = await zip.generateAsync({ type: "blob" });
  const stamp = new Date().toISOString().slice(0, 10);
  downloadBlob(blob, `bug-report-${stamp}.zip`);

  return { bugs: bugCount, features: featCount, screenshots: shotCount, file: `bug-report-${stamp}.zip` };
}
