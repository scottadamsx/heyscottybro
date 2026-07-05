import { useEffect, useRef, useState } from "react";
import { useToast } from "../../contexts/ToastContext";
import {
  slugify, downloadCSV, downloadMarkdown, markdownToPdfDownload, printMarkdown, emailToMe,
} from "../../lib/exporter";

/**
 * The universal export menu — one button on every page header.
 *
 * exporter: {
 *   title: string                    document title
 *   filename?: string                base filename (defaults to slug of title)
 *   toMarkdown(): string | Promise   the page as a markdown document (required)
 *   toRows?(): array | Promise       tabular rows -> enables CSV
 *   csvColumns?: [{key,label}]       optional CSV column ordering
 * }
 * Renders: Print · PDF · CSV (if rows) · Copy Markdown · Email me
 */
export default function ExportKit({ exporter }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState("");
  const ref = useRef(null);
  const { addToast } = useToast();

  useEffect(() => {
    if (!open) return;
    const close = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  if (!exporter) return null;
  const base = exporter.filename || slugify(exporter.title);

  const run = (key, fn) => async () => {
    setBusy(key);
    try { await fn(); setOpen(false); }
    catch (e) { addToast(e.message || "Export failed.", "error"); }
    finally { setBusy(""); }
  };

  const md = async () => String(await exporter.toMarkdown());

  const actions = [
    { key: "print", icon: "fa-print", label: "Print", fn: async () => printMarkdown(await md(), exporter.title) },
    { key: "pdf", icon: "fa-file-pdf", label: "PDF", fn: async () => markdownToPdfDownload(await md(), { title: exporter.title, filename: `${base}.pdf` }) },
    ...(exporter.toRows ? [{ key: "csv", icon: "fa-file-csv", label: "CSV", fn: async () => downloadCSV(await exporter.toRows(), base, exporter.csvColumns) }] : []),
    { key: "md", icon: "fa-copy", label: "Copy Markdown", fn: async () => { await navigator.clipboard.writeText(await md()); addToast("Markdown copied.", "success"); } },
    { key: "mdfile", icon: "fa-file-lines", label: "Download .md", fn: async () => downloadMarkdown(await md(), base) },
    { key: "email", icon: "fa-paper-plane", label: "Email me", fn: async () => { const r = await emailToMe({ subject: exporter.title, markdown: await md() }); addToast(`Sent to ${r.to || "your inbox"}.`, "success"); } },
  ];

  return (
    <div className="export-kit" ref={ref}>
      <button type="button" className="btn btn-sm btn-secondary-sm" onClick={() => setOpen((o) => !o)} title="Export this page">
        <i className="fa-solid fa-arrow-up-from-bracket" /> Export
      </button>
      {open && (
        <div className="export-kit-menu">
          {actions.map((a) => (
            <button key={a.key} type="button" onClick={run(a.key, a.fn)} disabled={!!busy}>
              <i className={`fa-solid ${busy === a.key ? "fa-spinner fa-spin" : a.icon}`} /> {a.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
