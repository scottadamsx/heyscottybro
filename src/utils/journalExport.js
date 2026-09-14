/**
 * Journal → one Markdown document, oldest entry first so it reads like a
 * journal. Pure (no DOM) so it's testable; the page hands the string to
 * lib/exporter.downloadMarkdown.
 */
import { formatDisplayDate, parseDate } from "./plannerUtils.js";

const fullDate = (iso) => {
  const d = /^\d{4}-\d{2}-\d{2}$/.test(String(iso)) ? parseDate(iso) : new Date(iso);
  return Number.isNaN(d.getTime()) ? String(iso || "Undated")
    : d.toLocaleDateString(undefined, { weekday: "long", year: "numeric", month: "long", day: "numeric" });
};

export function journalToMarkdown(entries, exportedAt = new Date()) {
  const sorted = [...entries].sort((a, b) =>
    String(a.date).localeCompare(String(b.date)) || String(a.created_at || "").localeCompare(String(b.created_at || "")));
  const count = `${sorted.length} ${sorted.length === 1 ? "entry" : "entries"}`;
  const exported = exportedAt.toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });
  const out = ["# Journal", "", `Exported ${exported} · ${count}`];
  for (const e of sorted) {
    const date = fullDate(e.date);
    const title = (e.title || "").trim();
    // Untitled entries default their title to the (year-less) date — head
    // those with the full date instead of printing the date twice.
    const isDefaultTitle = !title || title === formatDisplayDate(e.date);
    out.push("", "---", "", `## ${isDefaultTitle ? date : title}`);
    if (!isDefaultTitle) out.push("", `*${date}*`);
    out.push("", String(e.entry || "").trim());
  }
  return out.join("\n") + "\n";
}

export const journalExportFilename = (d = new Date()) =>
  `journal-${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}.md`;
