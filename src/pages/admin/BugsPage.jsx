import { useEffect, useRef, useState } from "react";
import { useConfirm } from "../../hooks/useConfirm";
import { useToast } from "../../contexts/ToastContext";
import {
  loadBugs, createBug, updateBug, deleteBug,
  addScreenshot, removeScreenshot, screenshotUrl, exportBugsZip, buildFixPrompt,
} from "../../api/bugsApi";

const PRIORITIES = ["low", "medium", "high", "critical"];
const STATUSES   = ["open", "in_progress", "resolved", "closed"];
const STATUS_LABELS = { open: "Open", in_progress: "In Progress", resolved: "Resolved", closed: "Closed" };

const PRIORITY_COLOR = {
  low:      { bg: "rgba(100,116,139,0.15)", text: "#94a3b8" },
  medium:   { bg: "rgba(234,179,8,0.15)",   text: "#eab308" },
  high:     { bg: "rgba(249,115,22,0.15)",  text: "var(--orange)" },
  critical: { bg: "rgba(239,68,68,0.18)",   text: "var(--red)" },
};
const STATUS_COLOR = {
  open:        { bg: "rgba(239,68,68,0.12)",  text: "var(--red)" },
  in_progress: { bg: "rgba(99,102,241,0.15)", text: "var(--accent)" },
  resolved:    { bg: "rgba(34,197,94,0.15)",  text: "var(--green)" },
  closed:      { bg: "rgba(100,116,139,0.12)", text: "#94a3b8" },
};
const TYPE_META = {
  bug:     { label: "Bug",     icon: "fa-bug",         bg: "rgba(239,68,68,0.12)",  text: "var(--red)" },
  feature: { label: "Feature", icon: "fa-lightbulb",   bg: "rgba(99,102,241,0.15)", text: "var(--accent)" },
};

const EMPTY_FORM = { title: "", description: "", steps: "", page: "", priority: "medium", type: "bug" };

function Badge({ label, colors, icon }) {
  return (
    <span style={{ fontSize: 11, fontWeight: 600, borderRadius: 99, padding: "2px 8px", background: colors.bg, color: colors.text, textTransform: "uppercase", letterSpacing: "0.05em", whiteSpace: "nowrap" }}>
      {icon && <i className={`fa-solid ${icon}`} style={{ marginRight: 4 }} />}{label}
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

  useEffect(() => {
    loadBugs()
      .then(setBugs)
      .catch(() => addToast("Couldn't load — run MIGRATION_2026-06-14-bugs.sql first.", "error"))
      .finally(() => setLoading(false));
  }, []);

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
    } catch {
      addToast("Failed to create.", "error");
    } finally {
      setSaving(false);
    }
  };

  const patch = async (id, fields) => {
    try {
      const updated = await updateBug(id, fields);
      setBugs(prev => prev.map(b => b.id === id ? updated : b));
    } catch {
      addToast("Update failed.", "error");
    }
  };

  const handleDelete = async (id) => {
    if (!await confirm("Delete this item?", { title: "Delete", confirmLabel: "Delete" })) return;
    try {
      await deleteBug(id);
      setBugs(prev => prev.filter(b => b.id !== id));
      if (expanded === id) setExpanded(null);
      addToast("Deleted.", "success");
    } catch {
      addToast("Delete failed.", "error");
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
    } catch {
      addToast("Export failed.", "error");
    } finally {
      setExporting(false);
    }
  };

  // Upload one or more image files as screenshots on a bug.
  const uploadFiles = async (bug, fileList) => {
    const files = [...fileList].filter(f => f.type.startsWith("image/"));
    if (!files.length) return;
    setUploading(true);
    let current = bug;
    try {
      for (const file of files) current = await addScreenshot(current, file);
      setBugs(prev => prev.map(b => b.id === current.id ? current : b));
      await ensureUrls(current.screenshots);
      addToast(`Added ${files.length} screenshot${files.length === 1 ? "" : "s"}.`, "success");
    } catch {
      addToast("Screenshot upload failed.", "error");
    } finally {
      setUploading(false);
    }
  };

  const handleRemoveShot = async (bug, path) => {
    try {
      const updated = await removeScreenshot(bug, path);
      setBugs(prev => prev.map(b => b.id === updated.id ? updated : b));
    } catch {
      addToast("Couldn't remove screenshot.", "error");
    }
  };

  const card  = { background: "var(--bg-elevated,#1a1a1a)", border: "0.5px solid var(--border,#333)", borderRadius: "0.5rem", padding: "0.75rem 1rem", marginBottom: 8 };
  const inp   = { width: "100%", marginBottom: 8, boxSizing: "border-box" };
  const sh    = { fontSize: 11, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--text-muted)", margin: "0 0 4px", fontWeight: 500 };
  const pill  = (active) => ({ fontSize: 12, padding: "4px 11px", borderRadius: 99, border: "0.5px solid var(--border)", cursor: "pointer", background: active ? "var(--accent)" : "var(--bg-elevated,#1a1a1a)", color: active ? "#fff" : "var(--text-secondary)" });
  const FILTER_TABS = [
    { key: "active", label: "Active" }, { key: "open", label: "Open" },
    { key: "in_progress", label: "In Progress" }, { key: "resolved", label: "Resolved" }, { key: "all", label: "All" },
  ];
  const KIND_TABS = [
    { key: "all", label: "Everything" },
    { key: "bug", label: "🐞 Bugs" },
    { key: "feature", label: "💡 Requests" },
  ];

  return (
    <div className="module-page">
      <div className="module-header">
        <h1><i className="fa-solid fa-bug" /> Bugs &amp; Requests</h1>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn" onClick={handleExport} disabled={exporting || bugs.length === 0} style={{ fontSize: 13 }}>
            <i className={`fa-solid ${exporting ? "fa-spinner fa-spin" : "fa-file-zipper"}`} /> {exporting ? "Zipping…" : "Export zip"}
          </button>
          <button className="btn-primary" onClick={() => { setForm({ ...EMPTY_FORM }); setShowForm(s => !s); setExpanded(null); }}>
            <i className="fa-solid fa-plus" /> New
          </button>
        </div>
      </div>

      {/* New item form */}
      {showForm && (
        <div style={{ ...card, borderColor: "var(--accent)", marginBottom: 16 }}>
          {/* Type toggle */}
          <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
            {["bug", "feature"].map(t => (
              <button key={t} onClick={() => setForm(f => ({ ...f, type: t }))}
                style={{ flex: 1, fontSize: 13, fontWeight: 600, padding: "7px 0", borderRadius: 7, cursor: "pointer",
                  border: `1px solid ${form.type === t ? TYPE_META[t].text : "var(--border)"}`,
                  background: form.type === t ? TYPE_META[t].bg : "transparent",
                  color: form.type === t ? TYPE_META[t].text : "var(--text-muted)" }}>
                <i className={`fa-solid ${TYPE_META[t].icon}`} style={{ marginRight: 6 }} />
                {t === "bug" ? "Bug report" : "Feature request"}
              </button>
            ))}
          </div>
          <input placeholder="Title *" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} style={inp} />
          <input placeholder="Page / area (e.g. Budget › Dashboard)" value={form.page} onChange={e => setForm(f => ({ ...f, page: e.target.value }))} style={inp} />
          <select value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value }))} style={{ ...inp, fontSize: 13 }}>
            {PRIORITIES.map(p => <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>)}
          </select>
          <textarea placeholder={form.type === "feature" ? "Describe the feature you'd like" : "Description (what's broken?)"} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={3} style={{ ...inp, resize: "vertical", fontFamily: "inherit", fontSize: 14 }} />
          {form.type === "bug" && (
            <textarea placeholder="Steps to reproduce (optional)" value={form.steps} onChange={e => setForm(f => ({ ...f, steps: e.target.value }))} rows={2} style={{ ...inp, resize: "vertical", fontFamily: "inherit", fontSize: 14 }} />
          )}
          <p style={{ fontSize: 11, color: "var(--text-muted)", margin: "0 0 10px" }}>You can drag in screenshots after saving — open the item below.</p>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn" onClick={handleCreate} disabled={saving || !form.title.trim()} style={{ flex: 1, background: "var(--accent)", color: "#fff", border: "none" }}>
              {saving ? "Saving…" : "Submit"}
            </button>
            <button className="btn" onClick={() => setShowForm(false)} style={{ flex: 1 }}>Cancel</button>
          </div>
        </div>
      )}

      {/* Kind filter */}
      <div style={{ display: "flex", gap: 6, marginBottom: 8, flexWrap: "wrap" }}>
        {KIND_TABS.map(t => <button key={t.key} onClick={() => setKind(t.key)} style={pill(kind === t.key)}>{t.label}</button>)}
      </div>
      {/* Status filter */}
      <div style={{ display: "flex", gap: 6, marginBottom: 14, flexWrap: "wrap" }}>
        {FILTER_TABS.map(t => (
          <button key={t.key} onClick={() => setFilter(t.key)} style={pill(filter === t.key)}>
            {t.label}{counts[t.key] != null ? ` (${counts[t.key]})` : ""}
          </button>
        ))}
      </div>

      {loading && <p style={{ color: "var(--text-muted)", fontSize: 13 }}>Loading…</p>}
      {!loading && filtered.length === 0 && (
        <p style={{ color: "var(--text-muted)", fontSize: 13 }}>Nothing here{filter !== "all" || kind !== "all" ? " — try another filter" : " yet"}.</p>
      )}

      {filtered.map(bug => {
        const isOpen = expanded === bug.id;
        const type = TYPE_META[bug.type] || TYPE_META.bug;
        const shots = bug.screenshots || [];
        return (
          <div key={bug.id} style={{ ...card, borderColor: isOpen ? "var(--accent)" : undefined }}>
            {/* Row summary */}
            <div style={{ display: "flex", alignItems: "flex-start", gap: 10, cursor: "pointer" }} onClick={() => toggleExpand(bug)}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 4 }}>
                  <span style={{ fontSize: 14, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{bug.title}</span>
                  <Badge label={type.label} colors={type} icon={type.icon} />
                  <Badge label={bug.priority} colors={PRIORITY_COLOR[bug.priority] || PRIORITY_COLOR.medium} />
                  <Badge label={STATUS_LABELS[bug.status] || bug.status} colors={STATUS_COLOR[bug.status] || STATUS_COLOR.open} />
                </div>
                <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
                  {bug.page && <span style={{ marginRight: 8 }}><i className="fa-solid fa-location-dot" style={{ marginRight: 3 }} />{bug.page}</span>}
                  {shots.length > 0 && <span style={{ marginRight: 8 }}><i className="fa-solid fa-image" style={{ marginRight: 3 }} />{shots.length}</span>}
                  {new Date(bug.created_at).toLocaleDateString("en-CA", { month: "short", day: "numeric" })}
                </div>
              </div>
              <i className={`fa-solid fa-chevron-${isOpen ? "up" : "down"}`} style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 3, flexShrink: 0 }} />
            </div>

            {/* Expanded detail */}
            {isOpen && (
              <div style={{ marginTop: 14, paddingTop: 14, borderTop: "0.5px solid var(--border,#333)" }}>
                <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
                  <div style={{ flex: 1, minWidth: 140 }}>
                    <p style={sh}>Status</p>
                    <select value={bug.status} onChange={e => patch(bug.id, { status: e.target.value, ...(["resolved","closed"].includes(e.target.value) && !bug.resolved_at ? { resolved_at: new Date().toISOString() } : {}) })} style={{ width: "100%", fontSize: 13 }}>
                      {STATUSES.map(s => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
                    </select>
                  </div>
                  <div style={{ flex: 1, minWidth: 140 }}>
                    <p style={sh}>Priority</p>
                    <select value={bug.priority} onChange={e => patch(bug.id, { priority: e.target.value })} style={{ width: "100%", fontSize: 13 }}>
                      {PRIORITIES.map(p => <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>)}
                    </select>
                  </div>
                </div>

                {bug.description && (
                  <div style={{ marginBottom: 10 }}>
                    <p style={sh}>Description</p>
                    <p style={{ fontSize: 13, color: "var(--text-secondary)", whiteSpace: "pre-wrap", margin: 0 }}>{bug.description}</p>
                  </div>
                )}
                {bug.steps && (
                  <div style={{ marginBottom: 10 }}>
                    <p style={sh}>Steps to reproduce</p>
                    <p style={{ fontSize: 13, color: "var(--text-secondary)", whiteSpace: "pre-wrap", margin: 0 }}>{bug.steps}</p>
                  </div>
                )}

                {/* Screenshots — drag & drop */}
                <div style={{ marginBottom: 12 }}>
                  <p style={sh}>Screenshots</p>
                  <div
                    onDragOver={e => { e.preventDefault(); setDragId(bug.id); }}
                    onDragLeave={() => setDragId(null)}
                    onDrop={e => { e.preventDefault(); setDragId(null); uploadFiles(bug, e.dataTransfer.files); }}
                    onClick={() => { if (expanded === bug.id) fileRef.current?.click(); }}
                    style={{
                      border: `1.5px dashed ${dragId === bug.id ? "var(--accent)" : "var(--border,#333)"}`,
                      background: dragId === bug.id ? "rgba(99,102,241,0.08)" : "transparent",
                      borderRadius: 8, padding: "14px", textAlign: "center", cursor: "pointer",
                      fontSize: 12, color: "var(--text-muted)", transition: "all .15s",
                    }}>
                    <i className={`fa-solid ${uploading ? "fa-spinner fa-spin" : "fa-cloud-arrow-up"}`} style={{ marginRight: 6 }} />
                    {uploading ? "Uploading…" : "Drag screenshots here, or click to choose"}
                    <input ref={fileRef} type="file" accept="image/*" multiple hidden
                      onChange={e => { uploadFiles(bug, e.target.files); e.target.value = ""; }} />
                  </div>
                  {shots.length > 0 && (
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(96px, 1fr))", gap: 8, marginTop: 8 }}>
                      {shots.map(path => (
                        <div key={path} style={{ position: "relative", borderRadius: 6, overflow: "hidden", border: "0.5px solid var(--border)", aspectRatio: "4/3", background: "var(--bg-raised,#111)" }}>
                          {shotUrls[path]
                            ? <a href={shotUrls[path]} target="_blank" rel="noreferrer"><img src={shotUrls[path]} alt="screenshot" style={{ width: "100%", height: "100%", objectFit: "cover" }} /></a>
                            : <div style={{ display: "grid", placeItems: "center", height: "100%", color: "var(--text-muted)" }}><i className="fa-solid fa-spinner fa-spin" /></div>}
                          <button onClick={() => handleRemoveShot(bug, path)} title="Remove"
                            style={{ position: "absolute", top: 3, right: 3, width: 20, height: 20, borderRadius: 5, border: "none", cursor: "pointer", background: "rgba(0,0,0,0.6)", color: "#fff", fontSize: 11, lineHeight: 1 }}>
                            <i className="fa-solid fa-xmark" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Resolution notes */}
                <div style={{ marginBottom: 12 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                    <p style={{ ...sh, margin: 0 }}>Notes / resolution</p>
                    {editingNotes !== bug.id && (
                      <button style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", fontSize: 11 }}
                        onClick={() => { setEditingNotes(bug.id); setNotesVal(bug.notes || ""); }}>
                        <i className="fa-solid fa-pen" style={{ marginRight: 4 }} />Edit
                      </button>
                    )}
                  </div>
                  {editingNotes === bug.id ? (
                    <div>
                      <textarea value={notesVal} onChange={e => setNotesVal(e.target.value)} rows={3} style={{ ...inp, resize: "vertical", fontFamily: "inherit", fontSize: 13 }} />
                      <div style={{ display: "flex", gap: 6 }}>
                        <button className="btn-sm btn-complete" style={{ fontSize: 12, padding: "4px 10px" }} onClick={() => handleSaveNotes(bug.id)}>Save</button>
                        <button className="btn-sm" style={{ fontSize: 12, padding: "4px 10px" }} onClick={() => setEditingNotes(null)}>Cancel</button>
                      </div>
                    </div>
                  ) : (
                    <p style={{ fontSize: 13, color: bug.notes ? "var(--text-secondary)" : "var(--text-muted)", fontStyle: bug.notes ? "normal" : "italic", whiteSpace: "pre-wrap", margin: 0 }}>
                      {bug.notes || "No notes yet."}
                    </p>
                  )}
                </div>

                {bug.resolved_at && (
                  <p style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 10 }}>
                    Resolved {new Date(bug.resolved_at).toLocaleDateString("en-CA", { month: "short", day: "numeric", year: "numeric" })}
                  </p>
                )}

                {/* Claude fix-prompt — generated from the report; hidden until asked for */}
                <div style={{ marginBottom: 12 }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 4 }}>
                    <p style={{ ...sh, margin: 0 }}><i className="fa-solid fa-wand-magic-sparkles" style={{ marginRight: 4 }} />Claude fix prompt</p>
                    <div style={{ display: "flex", gap: 10 }}>
                      <button style={{ background: "none", border: "none", cursor: "pointer", color: "var(--accent)", fontSize: 12, fontWeight: 600 }}
                        onClick={() => handleCopyPrompt(bug)}>
                        <i className="fa-solid fa-copy" style={{ marginRight: 4 }} />Copy prompt
                      </button>
                      <button style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", fontSize: 12 }}
                        onClick={() => setPromptShown(promptShown === bug.id ? null : bug.id)}>
                        <i className={`fa-solid fa-eye${promptShown === bug.id ? "-slash" : ""}`} style={{ marginRight: 4 }} />
                        {promptShown === bug.id ? "Hide" : "View"}
                      </button>
                    </div>
                  </div>
                  {promptShown === bug.id && (
                    <pre style={{ fontSize: 12, lineHeight: 1.55, color: "var(--text-secondary)", background: "var(--bg-raised,#111)", border: "0.5px solid var(--border,#333)", borderRadius: 8, padding: "10px 12px", margin: 0, whiteSpace: "pre-wrap", wordBreak: "break-word", fontFamily: "var(--font-mono, monospace)", maxHeight: 320, overflowY: "auto" }}>
                      {buildFixPrompt(bug)}
                    </pre>
                  )}
                </div>

                <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
                  {bug.status !== "resolved" && (
                    <button className="btn" style={{ fontSize: 12, padding: "4px 12px", background: "rgba(34,197,94,0.12)", color: "var(--green)", border: "none" }}
                      onClick={() => patch(bug.id, { status: "resolved", resolved_at: new Date().toISOString() })}>
                      <i className="fa-solid fa-check" style={{ marginRight: 4 }} />Resolve
                    </button>
                  )}
                  <button className="btn" style={{ fontSize: 12, padding: "4px 12px", background: "rgba(239,68,68,0.1)", color: "var(--red)", border: "none" }}
                    onClick={() => handleDelete(bug.id)}>
                    <i className="fa-solid fa-trash" style={{ marginRight: 4 }} />Delete
                  </button>
                </div>
              </div>
            )}
          </div>
        );
      })}
      {dialog}
    </div>
  );
}
