/**
 * The one exporter — consolidates the four ad-hoc download helpers that lived
 * in bugsApi, BudgetSimulator, hikerApi and DesignPage, and gives every page a
 * single vocabulary for getting data OUT of the app:
 *
 *   downloadBlob(blob, filename)      raw download
 *   downloadText(text, filename, mime)
 *   toCSV(rows, columns?)             array-of-objects -> CSV string
 *   downloadCSV(rows, filename)
 *   downloadMarkdown(md, filename)
 *   markdownToPdfDownload(md, opts)   via the in-house markdownToPdf engine
 *   printMarkdown(md, title)          opens the print dialog on a clean article
 *   emailToMe({ subject, markdown })  POST /api/send-to-me (Resend)
 *
 * Pages describe themselves to <ExportKit> with an `exporter` object:
 *   { title, filename?, toMarkdown(), toRows?() }
 */
import { getAuthHeaders } from "../utils/supabase";
import { markdownToPdfBlob } from "./markdownToPdf";

export function slugify(s) {
  return (s || "export").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "export";
}

export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

export function downloadText(text, filename, mime = "text/plain") {
  downloadBlob(new Blob([text], { type: `${mime};charset=utf-8` }), filename);
}

/** rows: array of plain objects. columns: optional [{key, label}] ordering. */
export function toCSV(rows, columns) {
  if (!rows?.length) return "";
  const cols = columns || Object.keys(rows[0]).map((k) => ({ key: k, label: k }));
  const esc = (v) => {
    const s = v == null ? "" : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const head = cols.map((c) => esc(c.label)).join(",");
  const body = rows.map((r) => cols.map((c) => esc(r[c.key])).join(",")).join("\n");
  return `${head}\n${body}\n`;
}

export function downloadCSV(rows, filename, columns) {
  downloadText(toCSV(rows, columns), filename.endsWith(".csv") ? filename : `${filename}.csv`, "text/csv");
}

export function downloadMarkdown(md, filename) {
  downloadText(md, filename.endsWith(".md") ? filename : `${filename}.md`, "text/markdown");
}

export function markdownToPdfDownload(md, { title = "Export", filename } = {}) {
  const blob = markdownToPdfBlob(md, { title, footer: `heyscottybro · ${new Date().toLocaleString()}` });
  downloadBlob(blob, filename || `${slugify(title)}.pdf`);
}

/**
 * Print any markdown as a clean paper article: render into a hidden print
 * container (styled by styles/print.css), print, clean up.
 */
export async function printMarkdown(md, title = "") {
  const { renderMarkdown } = await import("../utils/markdown");
  const host = document.createElement("div");
  host.className = "print-sheet";
  host.innerHTML = `${title ? `<h1 class="print-title">${title.replace(/</g, "&lt;")}</h1>` : ""}<div class="chat-md">${renderMarkdown(md)}</div>`;
  document.body.appendChild(host);
  document.body.classList.add("printing-sheet");
  const done = () => {
    document.body.classList.remove("printing-sheet");
    host.remove();
    window.removeEventListener("afterprint", done);
  };
  window.addEventListener("afterprint", done);
  window.print();
  // Safari fallback if afterprint never fires
  setTimeout(done, 2000);
}

/** Email an export to yourself via /api/send-to-me (Resend). */
export async function emailToMe({ subject, markdown }) {
  const res = await fetch("/api/send-to-me", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(await getAuthHeaders()) },
    body: JSON.stringify({ subject, markdown }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Send failed (${res.status})`);
  return data;
}
