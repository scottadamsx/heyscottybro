import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { loadJournal, newJournalEntry, updateJournalEntry, deleteJournalEntry } from "../../api/plannerApi";
import DatePicker from "../../components/DatePicker";
import { formatDisplayDate, toDateStr } from "../../utils/plannerUtils";
import { useConfirm } from "../../hooks/useConfirm";
import { useToast } from "../../contexts/ToastContext";
import { loadDraft, saveDraft, clearDraft, JOURNAL_NEW_DRAFT, journalEditDraft } from "../../utils/drafts";
import { journalToMarkdown, journalExportFilename } from "../../utils/journalExport";
import { downloadMarkdown } from "../../lib/exporter";

const savedTime = (iso) => new Date(iso).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

export default function JournalPage() {
  const [params, setParams] = useSearchParams();
  const selectedId = params.get("id");
  const isNew = params.get("new") === "1";

  const [entries, setEntries] = useState([]);
  // The compose form is write-through cached (utils/drafts) so clicking another
  // entry, switching Life tabs or reloading never loses what's been typed.
  const [restoredDraft, setRestoredDraft] = useState(() => loadDraft(JOURNAL_NEW_DRAFT));
  const [compose, setCompose] = useState(() => restoredDraft?.fields ?? {});
  const [draftFailed, setDraftFailed] = useState(false);
  const title = compose.title || "";
  const entry = compose.entry || "";
  const hasDraft = Boolean(title.trim() || entry.trim());
  const updateCompose = (patch) => {
    const next = { ...compose, ...patch };
    setCompose(next);
    setDraftFailed(!saveDraft(JOURNAL_NEW_DRAFT, next));
  };
  const { confirm, dialog } = useConfirm();
  const { addToast } = useToast();
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [ready, setReady] = useState(false);
  const [loadError, setLoadError] = useState(null); // a failed load is NOT "no entries yet"
  const [submitting, setSubmitting] = useState(false);

  const load = async () => {
    try { setEntries(await loadJournal()); setLoadError(null); }
    catch (err) {
      console.error("[journal] load failed", err);
      setLoadError(`Couldn't load journal entries: ${err?.message || err}`);
      addToast(`Couldn't load journal entries: ${err?.message || err}`, "error");
    }
    setReady(true);
  };
  useEffect(() => { load(); }, []);

  const handleDelete = async (e) => {
    if (!await confirm(`Delete "${e.title}"? This can't be undone.`, { title: "Delete entry", confirmLabel: "Delete" })) return;
    try {
      await deleteJournalEntry(e.id);
      clearDraft(journalEditDraft(e.id));
      await load();
      const next = new URLSearchParams(params);
      next.delete("id");
      setParams(next);
      addToast("Entry deleted.", "success");
    } catch (err) {
      addToast(`Couldn't delete entry: ${err?.message || "unknown error"}`, "error");
    }
  };

  const todayLong = formatDisplayDate(toDateStr(new Date()));

  const entryFields = (e) => ({ title: e.title || "", entry: e.entry || "", date: e.date || toDateStr(new Date()) });
  // Edits are cached per entry too; leaving an entry mid-edit keeps the draft
  // (the Edit button becomes "Resume edits"). Only Cancel or a save clears it.
  const startEdit = (e) => { setEditForm(loadDraft(journalEditDraft(e.id))?.fields ?? entryFields(e)); setEditing(true); };
  const updateEdit = (patch) => {
    const next = { ...editForm, ...patch };
    setEditForm(next);
    setDraftFailed(!saveDraft(journalEditDraft(selectedEntry.id), next));
  };
  const closeEdit = () => { setEditing(false); setEditForm(null); };
  const cancelEdit = async () => {
    const orig = entryFields(selectedEntry);
    const dirty = ["title", "entry", "date"].some((k) => editForm[k] !== orig[k]);
    if (dirty && !await confirm("Discard your unsaved changes to this entry?", { title: "Discard changes", confirmLabel: "Discard" })) return;
    clearDraft(journalEditDraft(selectedEntry.id));
    closeEdit();
  };
  const discardDraft = async () => {
    if (!await confirm("Discard this draft? The text will be gone for good.", { title: "Discard draft", confirmLabel: "Discard" })) return;
    clearDraft(JOURNAL_NEW_DRAFT);
    setCompose({});
    setDraftFailed(false);
    setRestoredDraft(null);
  };
  const saveEdit = async (ev) => {
    ev.preventDefault();
    if (!selectedEntry || !editForm.entry.trim()) return;
    const fields = { title: editForm.title.trim() || formatDisplayDate(editForm.date), entry: editForm.entry.trim(), date: editForm.date };
    const prev = selectedEntry;
    setSaving(true);
    // Optimistic: show the edit immediately, roll back and surface the error if it fails.
    setEntries((list) => list.map((x) => x.id === prev.id ? { ...x, ...fields } : x));
    setEditing(false);
    try {
      await updateJournalEntry(prev.id, fields);
      clearDraft(journalEditDraft(prev.id));
      addToast("Entry updated.", "success");
    } catch (err) {
      setEntries((list) => list.map((x) => x.id === prev.id ? prev : x));
      addToast(`Couldn't save entry: ${err?.message || "unknown error"}`, "error");
      setEditing(true);
    } finally { setSaving(false); }
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!entry.trim() || submitting) return;
    setSubmitting(true);
    try {
      await newJournalEntry({ title: title.trim() || todayLong, entry: entry.trim(), date: toDateStr(new Date()) });
      // Only clear the draft once the save has actually succeeded.
      clearDraft(JOURNAL_NEW_DRAFT);
      setCompose({});
      setDraftFailed(false);
      setRestoredDraft(null);
      await load();
      const next = new URLSearchParams(params);
      next.delete("new");
      setParams(next);
    } catch (err) {
      addToast(`Couldn't save entry: ${err?.message || "unknown error"}`, "error");
    } finally { setSubmitting(false); }
  };

  const selectedEntry = entries.find((e) => String(e.id) === String(selectedId));
  const showForm = isNew || (!selectedId && !selectedEntry);
  const showEntry = selectedEntry && !isNew;

  const hasEditDraft = showEntry && !editing && loadDraft(journalEditDraft(selectedEntry.id)) !== null;

  // Sort entries newest first for the list
  const sortedEntries = [...entries].sort((a, b) => b.date.localeCompare(a.date));

  const openCompose = () => {
    // Preserve other params (e.g. tab=journal when embedded in Life)
    const next = new URLSearchParams(params);
    next.set("new", "1");
    next.delete("id");
    setParams(next);
  };
  const draftFailedMsg = "Couldn't auto-save this draft — browser storage is full or blocked. Save it before leaving this page.";

  const exportAll = () => {
    try {
      downloadMarkdown(journalToMarkdown(entries), journalExportFilename());
      addToast(`Exported ${entries.length} ${entries.length === 1 ? "entry" : "entries"}.`, "success");
    } catch (err) {
      addToast(`Couldn't export journal: ${err?.message || "unknown error"}`, "error");
    }
  };

  return (
    <div className="module-page">
      <div className="module-header">
        <h1>Journal</h1>
        <div className="header-actions">
          {ready && !loadError && entries.length > 0 && (
            <button type="button" className="btn btn-sm btn-secondary-sm" onClick={exportAll} title="Download every entry as one Markdown file">
              <i className="fa-solid fa-file-arrow-down" aria-hidden="true" /> Export .md
            </button>
          )}
          <button className="btn btn-sm" onClick={openCompose}>
            <i className={`fa-solid ${hasDraft ? "fa-pen-to-square" : "fa-plus"}`} aria-hidden="true" /> {hasDraft ? "Resume Draft" : "New Entry"}
          </button>
        </div>
      </div>

      {/* Compose form — every keystroke is cached as a draft */}
      {showForm && (
        <form className="form-card" onSubmit={submit} style={{ marginBottom: "var(--space-lg)" }}>
          <input value={title} onChange={(e) => updateCompose({ title: e.target.value })} placeholder={`Title (defaults to "${todayLong}")`} aria-label="Title" />
          <textarea
            value={entry}
            onChange={(e) => updateCompose({ entry: e.target.value })}
            rows={8}
            placeholder="Write your thoughts..."
            style={{ resize: "vertical" }}
            aria-label="Entry"
            required
            autoFocus
          />
          {draftFailed ? (
            <p className="draft-status is-error" role="alert">{draftFailedMsg}</p>
          ) : hasDraft ? (
            <p className="draft-status" role="status">
              <i className="fa-solid fa-floppy-disk" aria-hidden="true" /> Draft auto-saved on this device
              {restoredDraft?.savedAt ? ` · restored from ${savedTime(restoredDraft.savedAt)}` : ""}
            </p>
          ) : null}
          <div className="form-actions">
            <button className="btn" type="submit" disabled={submitting}>{submitting ? "Saving…" : "Save Entry"}</button>
            {hasDraft && <button className="btn btn-secondary-sm" type="button" onClick={discardDraft}>Discard draft</button>}
          </div>
        </form>
      )}

      {/* Draft reminder while reading other entries — the text is never just hidden */}
      {!showForm && hasDraft && (
        <div className="draft-banner" role="status">
          <i className="fa-solid fa-pen-to-square" aria-hidden="true" />
          <span className="draft-banner-preview"><strong>Unsaved draft:</strong> {title.trim() || entry.trim()}</span>
          <button type="button" className="btn btn-sm" onClick={openCompose}>Continue writing</button>
        </div>
      )}

      {loadError && (
        <div className="load-error" role="alert">
          <p className="load-error-msg">{loadError}</p>
          <button type="button" className="btn btn-sm" onClick={() => { setReady(false); load(); }}>Retry</button>
        </div>
      )}

      {/* Single entry view */}
      {showEntry && (
        <div className="db-card" style={{ marginBottom: "var(--space-lg)" }}>
          <div className="db-card-header">
            <h3 className="db-card-title">{selectedEntry.title}</h3>
            <div className="header-actions">
              <span className="journal-date">{formatDisplayDate(selectedEntry.date)}</span>
              {!editing && (
                <button type="button" className="btn-mini" onClick={() => startEdit(selectedEntry)} title={hasEditDraft ? "You have unsaved edits to this entry" : "Edit entry"}>
                  <i className="fa-solid fa-pen" aria-hidden="true" /> {hasEditDraft ? "Resume edits" : "Edit"}
                </button>
              )}
              <button className="btn-sm btn-delete" onClick={() => handleDelete(selectedEntry)} title="Delete entry" style={{ fontSize: 12, padding: "4px 10px" }}>
                <i className="fa-solid fa-trash" style={{ marginRight: 4 }} /> Delete
              </button>
            </div>
          </div>
          {editing && editForm ? (
            <form className="form-card" onSubmit={saveEdit}>
              <div className="form-row">
                <input className="field-grow" value={editForm.title} onChange={(e) => updateEdit({ title: e.target.value })} placeholder="Title" aria-label="Title" />
                <DatePicker value={editForm.date} onChange={(v) => updateEdit({ date: v })} placeholder="Date" />
              </div>
              <textarea className="edit-body" value={editForm.entry} onChange={(e) => updateEdit({ entry: e.target.value })} rows={8} required aria-label="Entry" />
              {draftFailed && <p className="draft-status is-error" role="alert">{draftFailedMsg}</p>}
              <div className="form-actions">
                <button className="btn" type="submit" disabled={saving}>{saving ? "Saving…" : "Save changes"}</button>
                <button className="btn btn-secondary-sm" type="button" onClick={cancelEdit}>Cancel</button>
              </div>
            </form>
          ) : (
            <p style={{ whiteSpace: "pre-wrap", padding: 0, margin: 0, lineHeight: "var(--leading-relaxed)", fontSize: "var(--text-sm)" }}>{selectedEntry.entry}</p>
          )}
        </div>
      )}

      {/* Entries list — always shown once loaded (a load error is rendered above, never as "no entries") */}
      {!ready ? (
        <p className="no-entries">Loading…</p>
      ) : loadError ? null : sortedEntries.length === 0 ? (
        <p className="no-entries">No journal entries yet. Start writing!</p>
      ) : (
        <div className="journal-list">
          <div className="journal-list-head">
            {sortedEntries.length} {sortedEntries.length === 1 ? "entry" : "entries"}
          </div>
          {sortedEntries.map((e) => (
            <button
              key={e.id}
              className={`journal-list-item${String(e.id) === String(selectedId) ? " active" : ""}`}
              onClick={() => {
                // Preserve other params (e.g. tab=journal when embedded in Life)
                const next = new URLSearchParams(params);
                next.set("id", String(e.id));
                next.delete("new");
                setParams(next);
                closeEdit(); // any in-progress edit stays cached as a draft
              }}
            >
              <div className="journal-list-title">{e.title}</div>
              <div className="journal-list-date">{formatDisplayDate(e.date)}</div>
              <div className="journal-list-preview">{e.entry.slice(0, 90)}{e.entry.length > 90 ? "…" : ""}</div>
            </button>
          ))}
        </div>
      )}
      {dialog}
    </div>
  );
}
