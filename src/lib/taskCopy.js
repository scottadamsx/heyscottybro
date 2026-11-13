// Pure text builder for the task Copy button: assembles the plain-text
// brief (title, due, project, description, documents) that gets pasted to
// an AI agent, especially for bug tasks. No imports, so it stays trivially
// unit-testable; the surfaces pass in the due label they already display
// (shared display format, e.g. "Thursday, Jan 15th") or null for none.

/** Names of a task's linked documents, from enriched DocLinks rows. */
export function taskDocNames(links) {
  return (links || [])
    .map((l) => String(l?.node_title || "").trim())
    .filter(Boolean);
}

/**
 * The copied brief. `documents` is an array of document names.
 * Exact shape:
 *   Title: <title>
 *   Due: <due label, or "No due date">
 *   Project: <name>            (only when set)
 *   Description:
 *   <description, or "None">
 *   Documents:
 *   - <name>                   (one per line, or "None")
 */
export function buildTaskCopyText({ title, due = null, projectName = null, description = "", documents = [] } = {}) {
  const lines = [
    `Title: ${String(title || "").trim()}`,
    `Due: ${String(due || "").trim() || "No due date"}`,
  ];
  const project = String(projectName || "").trim();
  if (project) lines.push(`Project: ${project}`);
  const desc = String(description || "").trim();
  lines.push("Description:", desc || "None");
  const docs = (documents || []).map((d) => String(d || "").trim()).filter(Boolean);
  lines.push("Documents:");
  if (docs.length) for (const d of docs) lines.push(`- ${d}`);
  else lines.push("None");
  return lines.join("\n");
}
