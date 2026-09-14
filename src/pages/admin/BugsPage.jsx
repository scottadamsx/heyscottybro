import { useEffect, useRef, useState } from "react";
import { useConfirm } from "../../hooks/useConfirm";
import { useToast } from "../../contexts/ToastContext";
import {
  loadBugs, createBug, updateBug, deleteBug,
  addScreenshot, removeScreenshot, screenshotUrl, exportBugsZip, buildFixPrompt,
} from "../../api/bugsApi";
import { toUploadableImage } from "../../utils/image";
import "./mission.css";

const PRIORITIES = ["low", "medium", "high", "critical"];
const STATUSES   = ["open", "in_progress", "resolved", "closed"];
const STATUS_LABELS = { open: "Open", in_progress: "In progress", resolved: "Resolved", closed: "Closed" };

// Badge tones map onto the system's status colours (.bug-badge.tone-* in mission.css).
const PRIORITY_TONE = { low: "neutral", medium: "neutral", high: "warn", critical: "bad" };
const STATUS_TONE = { open: "neutral", in_progress: "info", resolved: "good", closed: "neutral" };
const TYPE_META = {
  bug:     { label: "Bug",     icon: "fa-bug",       tone: "bad" },
  feature: { label: "Feature", icon: "fa-lightbulb", tone: "info" },
};
const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

const EMPTY_FORM = { title: "", description: "", steps: "", page: "", priority: "medium", type: "bug" };

function Badge({ label, tone = "neutral", icon, hint }) {
  return (
    <span className={`bug-badge tone-${tone}`}>
      {icon && <i className={`fa-solid ${icon}`} aria-hidden="true" />}{label}
      {hint && <span className="visually-hidden"> {hint}</span>}
    </span>
  );
}

export default function BugsPage() {
  const [bugs, setBugs]         = useState([]);
  const [loading, setLoading]   = useState(true);
  const [kind, setKind]         = useState("all");      // all | bug | feature
  const [filter, setFilter]     = useState("active");   // status filter
  const [expanded, setExpanded] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm]         = useState({ ...EMPTY_FORM });
  const [saving, setSaving]     = useState(false);
  const [exporting, setExporting] = useState(false);
  const [editingNotes, setEditingNotes] = useState(null);
  const [notesVal, setNotesVal] = useState("");
  const [shotUrls, setShotUrls] = useState({});         // { path: signedUrl }
  const [promptShown, setPromptShown] = useState(null); // bug id whose fix-prompt is revealed
  const [dragId, setDragId]     = useState(null);       // bug id being dragged over
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef(null);
  const { confirm, dialog }     = useConfirm();
  const { addToast }            = useToast();

  // A failed load is an error state with Retry — never "Nothing here yet" (QF-3).
  const [loadError, setLoadError] = useState(null);
  const loadAll = () => {
    setLoading(true);
    setLoadError(null);
    loadBugs()
      .then(setBugs)
      .catch((err) => setLoadError(`Couldn't load the bug list: ${err?.message || err}. If it's a new database, run MIGRATION_2026-06-14-bugs.sql.`))
      .finally(() => setLoading(false));
  };
  useEffect(() => { loadAll(); }, []);

  const ensureUrls = async (paths = []) => {
    const missing = paths.filter(p => !(p in shotUrls));
    if (!missing.length) return;
    const entries = await Promise.all(missing.map(async p => {
      try { return [p, await screenshotUrl(p)]; } catch { return [p, null]; }
    }));
    setShotUrls(prev => ({ ...prev, ...Object.fromEntries(entries) }));
  };

  const toggleExpand = (bug) => {
    const next = expanded === bug.id ? null : bug.id;
    setExpanded(next);
    if (next) ensureUrls(bug.screenshots);
  };

  const byKind = bugs.filter(b => kind === "all" || (b.type || "bug") === kind);
  const filtered = byKind.filter(b =>
    filter === "all" ? true :
    filter === "active" ? ["open", "in_progress"].includes(b.status) :
    b.status === filter
  );
  const counts = {
    all:        byKind.length,
    active:     byKind.filter(b => ["open", "in_progress"].includes(b.status)).length,
    open:       byKind.filter(b => b.status === "open").length,
    in_progress:byKind.filter(b => b.status === "in_progress").length,
    resolved:   byKind.filter(b => b.status === "resolved").length,
    closed:     byKind.filter(b => b.status === "closed").length,
  };

  const handleCreate = async () => {
    if (!form.title.trim()) return;
    setSaving(true);
    try {
      const bug = await createBug(form);
      setBugs(prev => [bug, ...prev]);
      setForm({ ...EMPTY_FORM });
      setShowForm(false);
      addToast(form.type === "feature" ? "Feature request added." : "Bug reported.", "success");
    } catch (err) {
      addToast(`Failed to create: ${err?.message || err}`, "error");
    } finally {
      setSaving(false);
    }
  };

  const patch = async (id, fields) => {
    try {
      const updated = await updateBug(id, fields);
      setBugs(prev => prev.map(b => b.id === id ? updated : b));
    } catch (err) {
      addToast(`Update failed: ${err?.message || err}`, "error");
    }
  };

  const handleDelete = async (id) => {
    if (!await confirm("Delete this item?", { title: "Delete", confirmLabel: "Delete" })) return;
    try {
      await deleteBug(id);
      setBugs(prev => prev.filter(b => b.id !== id));
      if (expanded === id) setExpanded(null);
      addToast("Deleted.", "success");
    } catch (err) {
      addToast(`Delete failed: ${err?.message || err}`, "error");
    }
  };

  const handleCopyPrompt = async (bug) => {
    try {
      await navigator.clipboard.writeText(buildFixPrompt(bug));
      addToast("Claude fix-prompt copied.", "success");
    } catch {
      addToast("Couldn't copy — reveal the prompt and copy it by hand.", "error");
      setPromptShown(bug.id);
    }
  };

  const handleSaveNotes = async (id) => {
    await patch(id, { notes: notesVal });
    setEditingNotes(null);
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const r = await exportBugsZip();
      addToast(`Exported ${r.bugs} bug(s) + ${r.features} request(s), ${r.screenshots} screenshot(s).`, "success");
    } catch (err) {
      addToast(`Export failed: ${err?.message || err}`, "error");
    } finally {
      setExporting(false);
    }
  };

  // Upload one or more image files as screenshots on a bug. Each is re-encoded
  // to a bucket-legal JPEG first — a raw camera-roll HEIC (or anything over the
  // bucket's size cap) was rejected by Storage with an opaque "the string did
  // not match the expected pattern" in Safari.
  const uploadFiles = async (bug, fileList) => {
    const files = [...fileList].filter(f => f.type.startsWith("image/") || /\.(hei[cf])$/i.test(f.name || ""));
    if (!files.length) return;
    setUploading(true);
    let current = bug;
    try {
      for (const file of files) current = await addScreenshot(current, await toUploadableImage(file));
      setBugs(prev => prev.map(b => b.id === current.id ? current : b));
      await ensureUrls(current.screenshots);
      addToast(`Added ${files.length} screenshot${files.length === 1 ? "" : "s"}.`, "success");
    } catch (err) {
      addToast(err.message || "Screenshot upload failed.", "error");
    } finally {
      setUploading(false);
    }
  };

  const handleRemoveShot = async (bug, path) => {
    try {
      const updated = await removeScreenshot(bug, path);
      setBugs(prev => prev.map(b => b.id === updated.id ? updated : b));
    } catch (err) {
      addToast(`Couldn't remove screenshot: ${err?.message || err}`, "error");
    }
  };

  const FILTER_TABS = [
    { key: "active", label: "Active" }, { key: "open", label: "Open" },
    { key: "in_progress", label: "In progress" }, { key: "resolved", label: "Resolved" }, { key: "all", label: "All" },
  ];
  const KIND_TABS = [
    { key: "all", label: "Everything" },
    { key: "bug", label: "Bugs" },
    { key: "feature", label: "Requests" },
  ];

  return (
    <div className="module-page">
      <div className="module-header">
        <h1>Bugs &amp; requests</h1>
        <div className="header-actions">
          <button type="button" className="btn btn-sm btn-secondary-sm" onClick={handleExport} disabled={exporting || bugs.length === 0}>
            <i className={`fa-solid ${exporting ? "fa-spinner fa-spin" : "fa-file-zipper"}`} aria-hidden="true" /> {exporting ? "Zipping…" : "Export zip"}
          </button>
          <button type="button" className="btn btn-sm" aria-expanded={showForm} onClick={() => { setForm({ ...EMPTY_FORM }); setShowForm(s => !s); setExpanded(null); }}>
            <i className="fa-solid fa-plus" aria-hidden="true" /> New
          </button>
        </div>
      </div>

      {/* New item form */}
      {showForm && (
        <div className="form-card bug-form">
          {/* Type toggle */}
          <div className="segmented bug-type-toggle" role="group" aria-label="Type">
            {["bug", "feature"].map(t => (
              <button key={t} type="button" className={`segmented-opt${form.type === t ? " active" : ""}`} aria-pressed={form.type === t} onClick={() => setForm(f => ({ ...f, type: t }))}>
                <i className={`fa-solid ${TYPE_META[t].icon}`} aria-hidden="true" />
                {t === "bug" ? "Bug report" : "Feature request"}
              </button>
            ))}
          </div>
          <input aria-label="Title" placeholder="Title *" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
          <div className="form-row">
            <input className="field-grow" aria-label="Page or area" placeholder="Page / area (e.g. Budget › Dashboard)" value={form.page} onChange={e => setForm(f => ({ ...f, page: e.target.value }))} />
            <select aria-label="Priority" value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value }))}>
              {PRIORITIES.map(p => <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>)}
            </select>
          </div>
          <textarea aria-label="Description" placeholder={form.type === "feature" ? "Describe the feature you'd like" : "Description (what's broken?)"} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={3} />
          {form.type === "bug" && (
            <textarea aria-label="Steps to reproduce" placeholder="Steps to reproduce (optional)" value={form.steps} onChange={e => setForm(f => ({ ...f, steps: e.target.value }))} rows={2} />
          )}
          <p className="bug-hint">You can drag in screenshots after saving — open the item below.</p>
          <div className="form-actions">
            <button type="button" className="btn btn-sm" onClick={handleCreate} disabled={saving || !form.title.trim()}>
              {saving ? "Saving…" : "Submit"}
            </button>
            <button type="button" className="btn btn-sm btn-ghost" onClick={() => setShowForm(false)}>Cancel</button>
          </div>
        </div>
      )}

      <div className="bug-toolbar">
        {/* Kind filter */}
        <div className="segmented" role="group" aria-label="Show">
          {KIND_TABS.map(t => <button key={t.key} type="button" className={`segmented-opt${kind === t.key ? " active" : ""}`} aria-pressed={kind === t.key} onClick={() => setKind(t.key)}>{t.label}</button>)}
        </div>
        {/* Status filter */}
        <div className="bug-chips" role="group" aria-label="Status">
          {FILTER_TABS.map(t => (
            <button key={t.key} type="button" className={`chip${filter === t.key ? " active" : ""}`} aria-pressed={filter === t.key} onClick={() => setFilter(t.key)}>
              {t.label}{counts[t.key] != null ? <span className="bug-chip-count">{counts[t.key]}</span> : null}
            </button>
          ))}
        </div>
      </div>

      {loading && <p className="no-entries">Loading…</p>}
      {!loading && loadError && (
        <div className="load-error" role="alert">
          <p className="load-error-msg">{loadError}</p>
          <button type="button" className="btn btn-sm" onClick={loadAll}>Retry</button>
        </div>
      )}
      {!loading && !loadError && filtered.length === 0 && (
        <p className="no-entries">Nothing here{filter !== "all" || kind !== "all" ? " — try another filter" : " yet"}.</p>
      )}

      <div className="bug-list">
      {filtered.map(bug => {
        const isOpen = expanded === bug.id;
        const type = TYPE_META[bug.type] || TYPE_META.bug;
        const shots = bug.screenshots || [];
        return (
          <div key={bug.id} className={`bug-card${isOpen ? " is-open" : ""}`}>
            {/* Row summary */}
            <button type="button" className="bug-summary" aria-expanded={isOpen} onClick={() => toggleExpand(bug)}>
              <span className="bug-summary-main">
                <span className="bug-title-row">
                  <span className="bug-title">{bug.title}</span>
                  <Badge label={type.label} tone={type.tone} icon={type.icon} />
                  <Badge label={cap(bug.priority)} tone={PRIORITY_TONE[bug.priority] || "neutral"} hint="priority" />
                  <Badge label={STATUS_LABELS[bug.status] || bug.status} tone={STATUS_TONE[bug.status] || "neutral"} />
                </span>
                <span className="bug-meta">
                  {bug.page && <span><i className="fa-solid fa-location-dot" aria-hidden="true" />{bug.page}</span>}
                  {shots.length > 0 && <span><i className="fa-solid fa-image" aria-hidden="true" />{shots.length}<span className="visually-hidden"> screenshots</span></span>}
                  <span>{new Date(bug.created_at).toLocaleDateString("en-CA", { month: "short", day: "numeric" })}</span>
                </span>
              </span>
              <i className={`fa-solid fa-chevron-${isOpen ? "up" : "down"} bug-caret`} aria-hidden="true" />
            </button>

            {/* Expanded detail */}
            {isOpen && (
              <div className="bug-detail">
                <div className="form-row">
                  <div>
                    <label className="field-label" htmlFor={`bug-status-${bug.id}`}>Status</label>
                    <select id={`bug-status-${bug.id}`} value={bug.status} onChange={e => patch(bug.id, { status: e.target.value, ...(["resolved","closed"].includes(e.target.value) && !bug.resolved_at ? { resolved_at: new Date().toISOString() } : {}) })}>
                      {STATUSES.map(s => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="field-label" htmlFor={`bug-priority-${bug.id}`}>Priority</label>
                    <select id={`bug-priority-${bug.id}`} value={bug.priority} onChange={e => patch(bug.id, { priority: e.target.value })}>
                      {PRIORITIES.map(p => <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>)}
                    </select>
                  </div>
                </div>

                {bug.description && (
                  <div className="bug-section">
                    <h4 className="bug-label">Description</h4>
                    <p className="bug-text">{bug.description}</p>
                  </div>
                )}
                {bug.steps && (
                  <div className="bug-section">
                    <h4 className="bug-label">Steps to reproduce</h4>
                    <p className="bug-text">{bug.steps}</p>
                  </div>
                )}

                {/* Screenshots — drag & drop */}
                <div className="bug-section">
                  <h4 className="bug-label">Screenshots</h4>
                  <button
                    type="button"
                    className={`bug-drop${dragId === bug.id ? " is-drag" : ""}`}
                    onDragOver={e => { e.preventDefault(); setDragId(bug.id); }}
                    onDragLeave={() => setDragId(null)}
                    onDrop={e => { e.preventDefault(); setDragId(null); uploadFiles(bug, e.dataTransfer.files); }}
                    onClick={() => { if (expanded === bug.id) fileRef.current?.click(); }}
                  >
                    <i className={`fa-solid ${uploading ? "fa-spinner fa-spin" : "fa-cloud-arrow-up"}`} aria-hidden="true" />
                    {uploading ? "Uploading…" : "Drag screenshots here, or click to choose"}
                  </button>
                  <input ref={fileRef} type="file" accept="image/*" multiple hidden
                    onChange={e => { uploadFiles(bug, e.target.files); e.target.value = ""; }} />
                  {shots.length > 0 && (
                    <div className="bug-shots">
                      {shots.map(path => (
                        <div key={path} className="bug-shot">
                          {shotUrls[path]
                            ? <a href={shotUrls[path]} target="_blank" rel="noreferrer"><img src={shotUrls[path]} alt="screenshot" /></a>
                            : <div className="bug-shot-loading"><i className="fa-solid fa-spinner fa-spin" aria-hidden="true" /><span className="visually-hidden">Loading screenshot</span></div>}
                          <button type="button" className="bug-shot-x" onClick={() => handleRemoveShot(bug, path)} title="Remove" aria-label="Remove screenshot">
                            <i className="fa-solid fa-xmark" aria-hidden="true" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Resolution notes */}
                <div className="bug-section">
                  <div className="bug-section-head">
                    <h4 className="bug-label">Notes / resolution</h4>
                    {editingNotes !== bug.id && (
                      <button type="button" className="btn-mini"
                        onClick={() => { setEditingNotes(bug.id); setNotesVal(bug.notes || ""); }}>
                        <i className="fa-solid fa-pen" aria-hidden="true" />Edit
                      </button>
                    )}
                  </div>
                  {editingNotes === bug.id ? (
                    <div className="bug-notes-edit">
                      <textarea aria-label="Notes / resolution" value={notesVal} onChange={e => setNotesVal(e.target.value)} rows={3} />
                      <div className="form-actions">
                        <button type="button" className="btn-mini accent" onClick={() => handleSaveNotes(bug.id)}>Save</button>
                        <button type="button" className="btn-mini" onClick={() => setEditingNotes(null)}>Cancel</button>
                      </div>
                    </div>
                  ) : (
                    <p className={`bug-text${bug.notes ? "" : " is-empty"}`}>
                      {bug.notes || "No notes yet."}
                    </p>
                  )}
                </div>

                {bug.resolved_at && (
                  <p className="bug-resolved">
                    Resolved {new Date(bug.resolved_at).toLocaleDateString("en-CA", { month: "short", day: "numeric", year: "numeric" })}
                  </p>
                )}

                {/* Claude fix-prompt — generated from the report; hidden until asked for */}
                <div className="bug-section">
                  <div className="bug-section-head">
                    <h4 className="bug-label"><i className="fa-solid fa-wand-magic-sparkles" aria-hidden="true" />Claude fix prompt</h4>
                    <div className="form-actions">
                      <button type="button" className="btn-mini" onClick={() => handleCopyPrompt(bug)}>
                        <i className="fa-solid fa-copy" aria-hidden="true" />Copy prompt
                      </button>
                      <button type="button" className="btn-mini" aria-expanded={promptShown === bug.id}
                        onClick={() => setPromptShown(promptShown === bug.id ? null : bug.id)}>
                        <i className={`fa-solid fa-eye${promptShown === bug.id ? "-slash" : ""}`} aria-hidden="true" />
                        {promptShown === bug.id ? "Hide" : "View"}
                      </button>
                    </div>
                  </div>
                  {promptShown === bug.id && (
                    <pre className="bug-prompt">
                      {buildFixPrompt(bug)}
                    </pre>
                  )}
                </div>

                <div className="bug-actions">
                  {bug.status !== "resolved" && (
                    <button type="button" className="btn-complete"
                      onClick={() => patch(bug.id, { status: "resolved", resolved_at: new Date().toISOString() })}>
                      <i className="fa-solid fa-check" aria-hidden="true" />Resolve
                    </button>
                  )}
                  <button type="button" className="btn-delete"
                    onClick={() => handleDelete(bug.id)}>
                    <i className="fa-solid fa-trash" aria-hidden="true" />Delete
                  </button>
                </div>
              </div>
            )}
          </div>
        );
      })}
      </div>
      {dialog}
    </div>
  );
}
