import { useEffect, useState } from "react";
import { useConfirm } from "../../hooks/useConfirm";
import { useToast } from "../../contexts/ToastContext";
import { loadBugs, createBug, updateBug, deleteBug } from "../../api/bugsApi";

const PRIORITIES = ["low", "medium", "high", "critical"];
const STATUSES   = ["open", "in_progress", "resolved", "closed"];
const STATUS_LABELS = { open: "Open", in_progress: "In Progress", resolved: "Resolved", closed: "Closed" };

const PRIORITY_COLOR = {
  low:      { bg: "rgba(100,116,139,0.15)", text: "#94a3b8" },
  medium:   { bg: "rgba(234,179,8,0.15)",   text: "#eab308" },
  high:     { bg: "rgba(249,115,22,0.15)",  text: "#f97316" },
  critical: { bg: "rgba(239,68,68,0.18)",   text: "#ef4444" },
};
const STATUS_COLOR = {
  open:        { bg: "rgba(239,68,68,0.12)",  text: "#ef4444" },
  in_progress: { bg: "rgba(99,102,241,0.15)", text: "#818cf8" },
  resolved:    { bg: "rgba(34,197,94,0.15)",  text: "#22c55e" },
  closed:      { bg: "rgba(100,116,139,0.12)", text: "#94a3b8" },
};

const EMPTY_FORM = { title: "", description: "", steps: "", page: "", priority: "medium" };

function Badge({ label, colors }) {
  return (
    <span style={{ fontSize: 11, fontWeight: 600, borderRadius: 99, padding: "2px 8px", background: colors.bg, color: colors.text, textTransform: "uppercase", letterSpacing: "0.05em", whiteSpace: "nowrap" }}>
      {label}
    </span>
  );
}

export default function BugsPage() {
  const [bugs, setBugs]         = useState([]);
  const [loading, setLoading]   = useState(true);
  const [filter, setFilter]     = useState("open");
  const [expanded, setExpanded] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm]         = useState({ ...EMPTY_FORM });
  const [saving, setSaving]     = useState(false);
  const [editingNotes, setEditingNotes] = useState(null);
  const [notesVal, setNotesVal] = useState("");
  const { confirm, dialog }     = useConfirm();
  const { addToast }            = useToast();

  useEffect(() => {
    loadBugs()
      .then(setBugs)
      .catch(() => addToast("Couldn't load bugs — run the migration first.", "error"))
      .finally(() => setLoading(false));
  }, []);

  const filtered = bugs.filter(b =>
    filter === "all" ? true :
    filter === "active" ? ["open", "in_progress"].includes(b.status) :
    b.status === filter
  );

  const counts = {
    all:        bugs.length,
    active:     bugs.filter(b => ["open", "in_progress"].includes(b.status)).length,
    open:       bugs.filter(b => b.status === "open").length,
    in_progress:bugs.filter(b => b.status === "in_progress").length,
    resolved:   bugs.filter(b => b.status === "resolved").length,
    closed:     bugs.filter(b => b.status === "closed").length,
  };

  const handleCreate = async () => {
    if (!form.title.trim()) return;
    setSaving(true);
    try {
      const bug = await createBug(form);
      setBugs(prev => [bug, ...prev]);
      setForm({ ...EMPTY_FORM });
      setShowForm(false);
      addToast("Bug reported.", "success");
    } catch {
      addToast("Failed to create bug.", "error");
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
    if (!await confirm("Delete this bug?", { title: "Delete bug", confirmLabel: "Delete" })) return;
    try {
      await deleteBug(id);
      setBugs(prev => prev.filter(b => b.id !== id));
      if (expanded === id) setExpanded(null);
      addToast("Bug deleted.", "success");
    } catch {
      addToast("Delete failed.", "error");
    }
  };

  const handleSaveNotes = async (id) => {
    await patch(id, { notes: notesVal });
    setEditingNotes(null);
  };

  const card  = { background: "var(--bg-elevated,#1a1a1a)", border: "0.5px solid var(--border,#333)", borderRadius: "0.5rem", padding: "0.75rem 1rem", marginBottom: 8 };
  const inp   = { width: "100%", marginBottom: 8, boxSizing: "border-box" };
  const sh    = { fontSize: 11, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--text-muted)", margin: "0 0 4px", fontWeight: 500 };
  const FILTER_TABS = [
    { key: "active",      label: "Active" },
    { key: "open",        label: "Open" },
    { key: "in_progress", label: "In Progress" },
    { key: "resolved",    label: "Resolved" },
    { key: "all",         label: "All" },
  ];

  return (
    <div className="module-page">
      <div className="module-header">
        <h1><i className="fa-solid fa-bug" /> Bugs</h1>
        <button className="btn-primary" onClick={() => { setShowForm(s => !s); setExpanded(null); }}>
          <i className="fa-solid fa-plus" /> Report bug
        </button>
      </div>

      {/* New bug form */}
      {showForm && (
        <div style={{ ...card, borderColor: "var(--accent,#6366f1)", marginBottom: 16 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 12 }}>New bug report</div>
          <input placeholder="Title *" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} style={inp} />
          <input placeholder="Page / area (e.g. Budget › Dashboard)" value={form.page} onChange={e => setForm(f => ({ ...f, page: e.target.value }))} style={inp} />
          <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
            <select value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value }))} style={{ flex: 1, fontSize: 13 }}>
              {PRIORITIES.map(p => <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>)}
            </select>
          </div>
          <textarea placeholder="Description (what's broken?)" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={3} style={{ ...inp, resize: "vertical", fontFamily: "inherit", fontSize: 14 }} />
          <textarea placeholder="Steps to reproduce (optional)" value={form.steps} onChange={e => setForm(f => ({ ...f, steps: e.target.value }))} rows={2} style={{ ...inp, resize: "vertical", fontFamily: "inherit", fontSize: 14 }} />
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn" onClick={handleCreate} disabled={saving || !form.title.trim()} style={{ flex: 1, background: "var(--accent,#6366f1)", color: "#fff", border: "none" }}>
              {saving ? "Saving…" : "Submit"}
            </button>
            <button className="btn" onClick={() => setShowForm(false)} style={{ flex: 1 }}>Cancel</button>
          </div>
        </div>
      )}

      {/* Filter tabs */}
      <div style={{ display: "flex", gap: 6, marginBottom: 14, flexWrap: "wrap" }}>
        {FILTER_TABS.map(t => (
          <button key={t.key} onClick={() => setFilter(t.key)}
            style={{ fontSize: 12, padding: "4px 11px", borderRadius: 99, border: "0.5px solid var(--border)", cursor: "pointer",
              background: filter === t.key ? "var(--accent,#6366f1)" : "var(--bg-elevated,#1a1a1a)",
              color: filter === t.key ? "#fff" : "var(--text-secondary)" }}>
            {t.label}{counts[t.key] != null ? ` (${counts[t.key]})` : ""}
          </button>
        ))}
      </div>

      {loading && <p style={{ color: "var(--text-muted)", fontSize: 13 }}>Loading…</p>}
      {!loading && filtered.length === 0 && (
        <p style={{ color: "var(--text-muted)", fontSize: 13 }}>No bugs here{filter !== "all" ? " — try another filter" : ""}.</p>
      )}

      {filtered.map(bug => {
        const isOpen = expanded === bug.id;
        return (
          <div key={bug.id} style={{ ...card, borderColor: isOpen ? "var(--accent,#6366f1)" : undefined }}>
            {/* Row summary */}
            <div style={{ display: "flex", alignItems: "flex-start", gap: 10, cursor: "pointer" }} onClick={() => setExpanded(isOpen ? null : bug.id)}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 4 }}>
                  <span style={{ fontSize: 14, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{bug.title}</span>
                  <Badge label={bug.priority} colors={PRIORITY_COLOR[bug.priority] || PRIORITY_COLOR.medium} />
                  <Badge label={STATUS_LABELS[bug.status] || bug.status} colors={STATUS_COLOR[bug.status] || STATUS_COLOR.open} />
                </div>
                <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
                  {bug.page && <span style={{ marginRight: 8 }}><i className="fa-solid fa-location-dot" style={{ marginRight: 3 }} />{bug.page}</span>}
                  {new Date(bug.created_at).toLocaleDateString("en-CA", { month: "short", day: "numeric" })}
                </div>
              </div>
              <i className={`fa-solid fa-chevron-${isOpen ? "up" : "down"}`} style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 3, flexShrink: 0 }} />
            </div>

            {/* Expanded detail */}
            {isOpen && (
              <div style={{ marginTop: 14, paddingTop: 14, borderTop: "0.5px solid var(--border,#333)" }}>
                {/* Status + Priority editors */}
                <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
                  <div style={{ flex: 1, minWidth: 140 }}>
                    <p style={sh}>Status</p>
                    <select value={bug.status} onChange={e => patch(bug.id, { status: e.target.value, ...(["resolved","closed"].includes(e.target.value) && !bug.resolved_at ? { resolved_at: new Date().toISOString() } : {}) })}
                      style={{ width: "100%", fontSize: 13 }}>
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
                      <textarea value={notesVal} onChange={e => setNotesVal(e.target.value)} rows={3}
                        style={{ ...inp, resize: "vertical", fontFamily: "inherit", fontSize: 13 }} />
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

                <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
                  {bug.status !== "resolved" && (
                    <button className="btn" style={{ fontSize: 12, padding: "4px 12px", background: "rgba(34,197,94,0.12)", color: "#22c55e", border: "none" }}
                      onClick={() => patch(bug.id, { status: "resolved", resolved_at: new Date().toISOString() })}>
                      <i className="fa-solid fa-check" style={{ marginRight: 4 }} />Resolve
                    </button>
                  )}
                  <button className="btn" style={{ fontSize: 12, padding: "4px 12px", background: "rgba(239,68,68,0.1)", color: "#ef4444", border: "none" }}
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
