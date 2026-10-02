import { Fragment, useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { loadJournal, newJournalEntry, updateJournalEntry, deleteJournalEntry } from "../../api/plannerApi";
import DatePicker from "../../components/DatePicker";
import { FormModal, Field, Modal, ShowMore } from "../../components/ui";
import { usePaged } from "../../hooks/usePaged";
import { formatDisplayDate, toDateStr } from "../../utils/plannerUtils";
import { useConfirm } from "../../hooks/useConfirm";
import { useToast } from "../../contexts/ToastContext";
import { loadDraft, saveDraft, clearDraft, JOURNAL_NEW_DRAFT, journalEditDraft } from "../../utils/drafts";
import { journalToMarkdown, journalExportFilename } from "../../utils/journalExport";
import { downloadMarkdown } from "../../lib/exporter";
import UpdatedMeta from "../../components/UpdatedMeta";
import { SkeletonRegion, SkeletonRows } from "../../components/Skeleton";
import {
  autoPauseIdleTimer,
  cleanupResponseIsCurrent,
  createWritingTimer,
  elapsedWritingMs,
  formatWritingDuration,
  journalProvenanceForSave,
  journalTextDiff,
  journalWritingCounts,
  pauseWritingTimer,
  resumeWritingTimer,
  writingTimerInput,
  writingTimerMetadata,
} from "../../utils/journalWriting";
import { JOURNAL_CLEANUP_LIMIT, loadJournalCleanupStatus, requestJournalCleanup } from "../../api/journalCleanup";
import { useJournalCleanupEnabled } from "../../utils/settings";

const monthLabel = (ds) => new Date(ds + "T00:00:00").toLocaleDateString(undefined, { month: "long", year: "numeric" });
const shortDay = (ds) => new Date(ds + "T00:00:00").toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
const savedTime = (iso) => new Date(iso).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
const draftFailedMsg = "Couldn't auto-save this draft — browser storage is full or blocked. Save it before closing.";
const timerNow = () => performance.now();
const draftMetadata = (timer, cleanup, now = timerNow()) => ({ timer: writingTimerMetadata(timer, now), cleanup });

export default function JournalPage() {
  const [params, setParams] = useSearchParams();
  const selectedId = params.get("id");
  // ?new=1 opens the compose modal (deep-linkable, and keeps other params like tab=journal).
  const composeOpen = params.get("new") === "1";

  const [entries, setEntries] = useState([]);
  // The compose modal is write-through cached (utils/drafts) so closing it,
  // clicking another entry, switching Life tabs or reloading never loses what's been typed.
  const [restoredDraft, setRestoredDraft] = useState(() => loadDraft(JOURNAL_NEW_DRAFT));
  const [compose, setCompose] = useState(() => restoredDraft?.fields ?? {});
  const [composeTimer, setComposeTimer] = useState(() => createWritingTimer(restoredDraft?.metadata?.timer));
  const [composeCleanup, setComposeCleanup] = useState(() => restoredDraft?.metadata?.cleanup ?? null);
  const [draftFailed, setDraftFailed] = useState(false);
  const title = compose.title || "";
  const entry = compose.entry || "";
  const hasDraft = Boolean(title.trim() || entry.trim());
  const composeRef = useRef(compose);
  const composeCleanupRef = useRef(composeCleanup);
  useEffect(() => { composeRef.current = compose; }, [compose]);
  useEffect(() => { composeCleanupRef.current = composeCleanup; }, [composeCleanup]);
  const updateCompose = (patch, { bodyInput = false } = {}) => {
    const next = { ...compose, ...patch };
    const nextTimer = bodyInput ? writingTimerInput(composeTimer, timerNow()) : composeTimer;
    const nextCleanup = bodyInput ? null : composeCleanup;
    setCompose(next);
    if (bodyInput) { setComposeTimer(nextTimer); setComposeCleanup(null); }
    setDraftFailed(!saveDraft(JOURNAL_NEW_DRAFT, next, draftMetadata(nextTimer, nextCleanup)));
  };
  const { confirm, dialog } = useConfirm();
  const { addToast } = useToast();
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState(null);
  const [editTimer, setEditTimer] = useState(() => createWritingTimer());
  const [editCleanup, setEditCleanup] = useState(null);
  const editFormRef = useRef(editForm);
  const editCleanupRef = useRef(editCleanup);
  useEffect(() => { editFormRef.current = editForm; }, [editForm]);
  useEffect(() => { editCleanupRef.current = editCleanup; }, [editCleanup]);
  const [clock, setClock] = useState(() => timerNow());
  const [cleanupAvailable, setCleanupAvailable] = useState(false);
  const cleanupEnabled = useJournalCleanupEnabled();
  const [cleanupBusy, setCleanupBusy] = useState(null);
  const [cleanupNotice, setCleanupNotice] = useState(null);
  const [cleanupReview, setCleanupReview] = useState(null);
  const composeOpenRef = useRef(composeOpen);
  const editingRef = useRef(editing);
  const selectedIdRef = useRef(selectedId);
  useEffect(() => { composeOpenRef.current = composeOpen; }, [composeOpen]);
  useEffect(() => { editingRef.current = editing; }, [editing]);
  useEffect(() => { selectedIdRef.current = selectedId; }, [selectedId]);
  const [ready, setReady] = useState(false);
  const [loadError, setLoadError] = useState(null); // a failed load is NOT "no entries yet"

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
  useEffect(() => {
    let active = true;
    loadJournalCleanupStatus().then((status) => { if (active) setCleanupAvailable(status.available); });
    return () => { active = false; };
  }, []);

  const selectedEntry = entries.find((e) => String(e.id) === String(selectedId));

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
  // Edits are cached per entry too; closing the edit modal (or leaving the entry)
  // keeps the draft and the Edit button becomes "Resume edits". Only Discard or a
  // successful save clears it.
  const startEdit = (e) => {
    const draft = loadDraft(journalEditDraft(e.id));
    setEditForm(draft?.fields ?? entryFields(e));
    setEditTimer(createWritingTimer(draft?.metadata?.timer));
    setEditCleanup(draft?.metadata?.cleanup ?? null);
    setCleanupNotice(null);
    setEditing(true);
  };
  const updateEdit = (patch, { bodyInput = false } = {}) => {
    const next = { ...editForm, ...patch };
    const nextTimer = bodyInput ? writingTimerInput(editTimer, timerNow()) : editTimer;
    const nextCleanup = bodyInput ? null : editCleanup;
    setEditForm(next);
    if (bodyInput) { setEditTimer(nextTimer); setEditCleanup(null); }
    setDraftFailed(!saveDraft(journalEditDraft(selectedEntry.id), next, draftMetadata(nextTimer, nextCleanup)));
  };
  const persistComposeTimer = (timer) => {
    setDraftFailed(!saveDraft(JOURNAL_NEW_DRAFT, composeRef.current, draftMetadata(timer, composeCleanupRef.current)));
  };
  const persistEditTimer = (timer) => {
    if (selectedEntry && editFormRef.current) {
      setDraftFailed(!saveDraft(journalEditDraft(selectedEntry.id), editFormRef.current, draftMetadata(timer, editCleanupRef.current)));
    }
  };
  const pauseComposeTimer = (reason = "automatic") => {
    const now = timerNow();
    setComposeTimer((current) => {
      const next = pauseWritingTimer(current, now, reason);
      persistComposeTimer(next);
      return next;
    });
  };
  const pauseEditTimer = (reason = "automatic") => {
    const now = timerNow();
    setEditTimer((current) => {
      const next = pauseWritingTimer(current, now, reason);
      persistEditTimer(next);
      return next;
    });
  };

  useEffect(() => {
    if (composeTimer.status !== "running" && editTimer.status !== "running") return undefined;
    const interval = setInterval(() => {
      const now = timerNow();
      setClock(now);
      if (composeOpen) {
        setComposeTimer((current) => {
          const next = autoPauseIdleTimer(current, now);
          if (next !== current) persistComposeTimer(next);
          return next;
        });
      }
      if (editing) {
        setEditTimer((current) => {
          const next = autoPauseIdleTimer(current, now);
          if (next !== current) persistEditTimer(next);
          return next;
        });
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [composeTimer.status, editTimer.status, composeOpen, editing, selectedEntry?.id]);

  useEffect(() => {
    if (composeTimer.status !== "running" && editTimer.status !== "running") return undefined;
    const interval = setInterval(() => {
      if (composeOpen && composeTimer.status === "running") persistComposeTimer(composeTimer);
      if (editing && editTimer.status === "running") persistEditTimer(editTimer);
    }, 5000);
    return () => clearInterval(interval);
  }, [composeTimer, editTimer, composeOpen, editing, selectedEntry?.id]);

  useEffect(() => {
    const pauseVisibleEditors = () => {
      if (composeOpen) pauseComposeTimer();
      if (editing) pauseEditTimer();
    };
    const onVisibility = () => { if (document.hidden) pauseVisibleEditors(); };
    window.addEventListener("blur", pauseVisibleEditors);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("blur", pauseVisibleEditors);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [composeOpen, editing, selectedEntry?.id]);
  const isEditDirty = () => {
    const orig = entryFields(selectedEntry);
    return ["title", "entry", "date"].some((k) => editForm[k] !== orig[k]);
  };
  const closeEdit = () => {
    setEditing(false);
    setEditForm(null);
    setEditTimer(createWritingTimer());
    setEditCleanup(null);
  };
  const dismissEdit = () => {
    // Edits that match the saved entry leave nothing to resume.
    if (selectedEntry && editForm && !isEditDirty()) clearDraft(journalEditDraft(selectedEntry.id));
    else if (selectedEntry && editForm) {
      const paused = pauseWritingTimer(editTimer, timerNow(), "automatic");
      saveDraft(journalEditDraft(selectedEntry.id), editForm, draftMetadata(paused, editCleanup));
    }
    closeEdit();
  };
  const discardEdit = async () => {
    if (isEditDirty() && !await confirm("Discard your unsaved changes to this entry?", { title: "Discard changes", confirmLabel: "Discard" })) return;
    clearDraft(journalEditDraft(selectedEntry.id));
    setEditTimer(createWritingTimer());
    setEditCleanup(null);
    closeEdit();
  };
  const discardDraft = async () => {
    if (!await confirm("Discard this draft? The text will be gone for good.", { title: "Discard draft", confirmLabel: "Discard" })) return;
    clearDraft(JOURNAL_NEW_DRAFT);
    setCompose({});
    setDraftFailed(false);
    setRestoredDraft(null);
    setComposeTimer(createWritingTimer());
    setComposeCleanup(null);
  };
  const saveEdit = async () => {
    if (!selectedEntry || !editForm.entry.trim()) return false;
    const fields = { title: editForm.title.trim() || formatDisplayDate(editForm.date), entry: editForm.entry.trim(), date: editForm.date };
    const prev = selectedEntry;
    const provenance = journalProvenanceForSave(editCleanup, fields.entry);
    if (provenance) fields.aiProvenance = provenance;
    else if (fields.entry !== String(prev.entry || "").trim()) fields.aiProvenance = null;
    // Optimistic: show the edit immediately; on failure roll back and keep the modal open with the error.
    setEntries((list) => list.map((x) => x.id === prev.id ? {
      ...x,
      title: fields.title,
      entry: fields.entry,
      date: fields.date,
      ai_provenance: fields.aiProvenance === undefined ? x.ai_provenance : fields.aiProvenance,
      updated_at: new Date().toISOString(),
    } : x));
    try {
      await updateJournalEntry(prev.id, fields);
    } catch (err) {
      setEntries((list) => list.map((x) => x.id === prev.id ? prev : x));
      throw new Error(`Couldn't save entry: ${err?.message || "unknown error"}`, { cause: err });
    }
    clearDraft(journalEditDraft(prev.id));
    closeEdit();
    addToast("Entry updated.", "success");
    load(); // pick up the server's updated_at (set by the journal_updated_at trigger)
    return false; // already closed (closeEdit), without dismissEdit's draft check
  };

  const submit = async () => {
    if (!entry.trim()) return false;
    try {
      await newJournalEntry({
        title: title.trim() || todayLong,
        entry: entry.trim(),
        date: toDateStr(new Date()),
        aiProvenance: journalProvenanceForSave(composeCleanup, entry),
      });
    } catch (err) {
      throw new Error(`Couldn't save entry: ${err?.message || "unknown error"}`, { cause: err });
    }
    // Only clear the draft once the save has actually succeeded.
    clearDraft(JOURNAL_NEW_DRAFT);
    setCompose({});
    setDraftFailed(false);
    setRestoredDraft(null);
    setComposeTimer(createWritingTimer());
    setComposeCleanup(null);
    await load();
  };

  const hasEditDraft = selectedEntry && !editing && loadDraft(journalEditDraft(selectedEntry.id)) !== null;

  // Sort entries newest first for the list
  const sortedEntries = [...entries].sort((a, b) => b.date.localeCompare(a.date));
  const entryPage = usePaged(sortedEntries, 60);

  const openCompose = () => {
    // Preserve other params (e.g. tab=journal when embedded in Life)
    const next = new URLSearchParams(params);
    next.set("new", "1");
    setParams(next);
  };
  // Closing the compose modal keeps the draft; the header button and the banner offer "Resume".
  const closeCompose = () => {
    pauseComposeTimer();
    setParams((current) => {
      const next = new URLSearchParams(current);
      next.delete("new");
      return next;
    });
  };

  const setTimerAction = async (mode, action) => {
    const current = mode === "compose" ? composeTimer : editTimer;
    const now = timerNow();
    let next = current;
    if (action === "pause") next = pauseWritingTimer(current, now, "manual");
    if (action === "resume") next = resumeWritingTimer(current, now);
    if (action === "reset") {
      if (elapsedWritingMs(current, now) > 0 && !await confirm("Reset this draft's writing timer?", { title: "Reset writing timer", confirmLabel: "Reset" })) return;
      next = createWritingTimer();
    }
    if (mode === "compose") {
      setComposeTimer(next);
      persistComposeTimer(next);
    } else {
      setEditTimer(next);
      persistEditTimer(next);
    }
    setClock(now);
  };

  const runCleanup = async (mode, body) => {
    if (!body.trim() || journalWritingCounts(body).characters > JOURNAL_CLEANUP_LIMIT || !navigator.onLine) return;
    const approved = await confirm(
      "Send this entry text to Anthropic for grammar and spelling cleanup? The text is not saved to your journal unless you accept the suggestion and then save the entry.",
      { title: "Clean up writing", confirmLabel: "Send to Anthropic" },
    );
    if (!approved) return;
    const snapshot = body;
    const entryId = selectedIdRef.current;
    setCleanupBusy(mode);
    setCleanupNotice({ mode, type: "status", text: "Checking your writing…" });
    try {
      const result = await requestJournalCleanup(snapshot);
      const currentBody = mode === "compose" ? composeRef.current.entry || "" : editFormRef.current?.entry || "";
      const isCurrent = cleanupResponseIsCurrent({
        submittedBody: snapshot,
        currentBody,
        requestedEntryId: mode === "compose" ? null : entryId,
        currentEntryId: mode === "compose" ? null : selectedIdRef.current,
        open: mode === "compose" ? composeOpenRef.current : editingRef.current,
      });
      if (!isCurrent) {
        setCleanupNotice({ mode, type: "error", text: "The entry changed while cleanup was running. Nothing was replaced; request cleanup again." });
      } else if (result.cleanedText === snapshot) {
        setCleanupNotice({ mode, type: "status", text: "No grammar or spelling changes were suggested." });
      } else {
        setCleanupReview({ mode, original: snapshot, suggestion: result.cleanedText, provenance: result.provenance });
        setCleanupNotice(null);
      }
    } catch (error) {
      setCleanupNotice({ mode, type: "error", text: error?.message || "Journal cleanup failed. Try again." });
    } finally {
      setCleanupBusy(null);
    }
  };

  const acceptCleanup = () => {
    if (!cleanupReview) return;
    const pending = {
      original: cleanupReview.original,
      suggestion: cleanupReview.suggestion,
      provenance: cleanupReview.provenance,
    };
    if (cleanupReview.mode === "compose") {
      const next = { ...composeRef.current, entry: pending.suggestion };
      setCompose(next);
      setComposeCleanup(pending);
      setDraftFailed(!saveDraft(JOURNAL_NEW_DRAFT, next, draftMetadata(composeTimer, pending)));
    } else if (selectedEntry && editFormRef.current) {
      const next = { ...editFormRef.current, entry: pending.suggestion };
      setEditForm(next);
      setEditCleanup(pending);
      setDraftFailed(!saveDraft(journalEditDraft(selectedEntry.id), next, draftMetadata(editTimer, pending)));
    }
    setCleanupNotice({ mode: cleanupReview.mode, type: "status", text: "Suggestion applied to this draft. Save the entry to keep it." });
    setCleanupReview(null);
  };

  const undoCleanup = (mode) => {
    const pending = mode === "compose" ? composeCleanup : editCleanup;
    if (!pending) return;
    if (mode === "compose") {
      const next = { ...composeRef.current, entry: pending.original };
      setCompose(next);
      setComposeCleanup(null);
      setDraftFailed(!saveDraft(JOURNAL_NEW_DRAFT, next, draftMetadata(composeTimer, null)));
    } else if (selectedEntry && editFormRef.current) {
      const next = { ...editFormRef.current, entry: pending.original };
      setEditForm(next);
      setEditCleanup(null);
      setDraftFailed(!saveDraft(journalEditDraft(selectedEntry.id), next, draftMetadata(editTimer, null)));
    }
    setCleanupNotice({ mode, type: "status", text: "Cleanup undone." });
  };

  const exportAll = () => {
    try {
      downloadMarkdown(journalToMarkdown(entries), journalExportFilename());
      addToast(`Exported ${entries.length} ${entries.length === 1 ? "entry" : "entries"}.`, "success");
    } catch (err) {
      addToast(`Couldn't export journal: ${err?.message || "unknown error"}`, "error");
    }
  };

  const hasMain = Boolean(selectedEntry) || hasDraft;

  return (
    <div className="module-page journal">
      <div className="module-header">
        <h1>Journal</h1>
        <div className="header-actions">
          {ready && !loadError && entries.length > 0 && (
            <button type="button" className="btn btn-sm btn-secondary-sm" onClick={exportAll} title="Download every entry as one Markdown file">
              <i className="fa-solid fa-file-arrow-down" aria-hidden="true" /> Export .md
            </button>
          )}
          <button type="button" className="btn btn-sm" onClick={openCompose}>
            <i className={`fa-solid ${hasDraft ? "fa-pen-to-square" : "fa-plus"}`} aria-hidden="true" /> {hasDraft ? "Resume draft" : "New entry"}
          </button>
        </div>
      </div>

      {loadError && (
        <div className="load-error" role="alert">
          <p className="load-error-msg">{loadError}</p>
          <button type="button" className="btn btn-sm" onClick={() => { setReady(false); load(); }}>Retry</button>
        </div>
      )}

      <div className={`journal-layout${hasMain ? "" : " is-index-only"}`}>
        {hasMain && (
          <div className="journal-main">
            {/* Draft reminder — the unsaved text is never just hidden */}
            {hasDraft && (
              <div className="draft-banner" role="status">
                <i className="fa-solid fa-pen-to-square" aria-hidden="true" />
                <span className="draft-banner-preview"><strong>Unsaved draft:</strong> {title.trim() || entry.trim()}</span>
                <button type="button" className="btn btn-sm btn-secondary-sm" onClick={openCompose}>Continue writing</button>
              </div>
            )}

            {/* Single entry — read like a page */}
            {selectedEntry && (
              <article className="journal-sheet is-reading">
                <div className="journal-sheet-head">
                  {/* Untitled entries already show the date as their title */}
                  <p className="journal-sheet-date">{selectedEntry.title !== formatDisplayDate(selectedEntry.date) ? formatDisplayDate(selectedEntry.date) : ""}</p>
                  <div className="journal-sheet-actions">
                    <button type="button" className="btn-sm btn-secondary-sm" onClick={() => startEdit(selectedEntry)} title={hasEditDraft ? "You have unsaved edits to this entry" : "Edit entry"}>
                      <i className="fa-solid fa-pen" aria-hidden="true" /> {hasEditDraft ? "Resume edits" : "Edit"}
                    </button>
                    <button type="button" className="btn-delete" onClick={() => handleDelete(selectedEntry)} title="Delete entry">
                      <i className="fa-solid fa-trash" aria-hidden="true" /> Delete
                    </button>
                  </div>
                </div>
                <h2 className="journal-sheet-title">{selectedEntry.title}</h2>
                <UpdatedMeta at={selectedEntry.updated_at} createdAt={selectedEntry.created_at} className="journal-sheet-updated" />
                {selectedEntry.ai_provenance?.feature === "journal_cleanup" && (
                  <p className="journal-ai-provenance">
                    <i className="fa-solid fa-wand-magic-sparkles" aria-hidden="true" />
                    <strong>Cleaned with AI</strong>
                    <span> · {selectedEntry.ai_provenance.model} · {selectedEntry.ai_provenance.prompt} v{selectedEntry.ai_provenance.promptVersion} · {savedTime(selectedEntry.ai_provenance.generatedAt)}</span>
                  </p>
                )}
                <p className="journal-sheet-body">{selectedEntry.entry}</p>
              </article>
            )}
          </div>
        )}

        {/* Entries index — always shown once loaded (a load error is rendered above, never as "no entries") */}
        {(!ready || !loadError) && (
          <aside className="journal-index" aria-label="Journal entries">
            <div className="journal-index-head">
              <h2 className="db-card-title">Entries</h2>
              {ready && (
                <span className="db-count">
                  {entryPage.visible.length < sortedEntries.length ? `${entryPage.visible.length} of ${sortedEntries.length}` : sortedEntries.length}
                  <span className="visually-hidden"> {sortedEntries.length === 1 ? "entry" : "entries"}</span>
                </span>
              )}
            </div>
            {!ready ? (
              <SkeletonRegion label="Loading journal entries" inline><SkeletonRows rows={6} actions={false} /></SkeletonRegion>
            ) : sortedEntries.length === 0 ? (
              <p className="no-entries">No journal entries yet. Start writing!</p>
            ) : (
              <div className="journal-list">
                {entryPage.visible.map((e, i) => {
                  const month = monthLabel(e.date);
                  const isActive = String(e.id) === String(selectedId);
                  return (
                    <Fragment key={e.id}>
                      {(i === 0 || monthLabel(sortedEntries[i - 1].date) !== month) && <h3 className="journal-month">{month}</h3>}
                      <button
                        type="button"
                        className={`journal-list-item${isActive ? " active" : ""}`}
                        aria-current={isActive ? "true" : undefined}
                        onClick={() => {
                          // Preserve other params (e.g. tab=journal when embedded in Life)
                          const next = new URLSearchParams(params);
                          next.set("id", String(e.id));
                          next.delete("new");
                          setParams(next);
                          dismissEdit(); // any in-progress edit stays cached as a draft
                        }}
                      >
                        <span className="journal-list-top">
                          <span className="journal-list-title">{e.title}</span>
                          <span className="journal-list-date">{shortDay(e.date)}</span>
                        </span>
                        <span className="journal-list-preview">{e.entry.slice(0, 90)}{e.entry.length > 90 ? "…" : ""}</span>
                      </button>
                    </Fragment>
                  );
                })}
                <ShowMore remaining={entryPage.remaining} pageSize={60} onClick={entryPage.showMore} noun="entries" />
              </div>
            )}
          </aside>
        )}
      </div>

      {/* Compose — every keystroke is cached as a draft; closing keeps it */}
      {composeOpen && (
        <FormModal
          title="New entry"
          width={720}
          className="journal-modal"
          submitLabel="Save entry"
          submitDisabled={!entry.trim()}
          onClose={closeCompose}
          onSubmit={submit}
          extraActions={hasDraft && <button className="btn btn-ghost" type="button" onClick={discardDraft}>Discard draft</button>}
        >
          <p className="journal-sheet-date">{todayLong}</p>
          <Field label="Title">
            <input value={title} onChange={(e) => updateCompose({ title: e.target.value })} placeholder={`Defaults to "${todayLong}"`} />
          </Field>
          <Field label="Entry">
            <textarea
              className="journal-body-field"
              value={entry}
              onChange={(e) => updateCompose({ entry: e.target.value }, { bodyInput: true })}
              rows={12}
              placeholder="Write your thoughts..."
              required
              data-autofocus
            />
          </Field>
          <WritingTools
            body={entry}
            timer={composeTimer}
            clock={clock}
            onTimer={(action) => setTimerAction("compose", action)}
            cleanupVisible={cleanupAvailable && cleanupEnabled}
            cleanupBusy={cleanupBusy === "compose"}
            onCleanup={() => runCleanup("compose", entry)}
            pendingCleanup={composeCleanup}
            onUndo={() => undoCleanup("compose")}
            notice={cleanupNotice?.mode === "compose" ? cleanupNotice : null}
          />
          {draftFailed ? (
            <p className="draft-status is-error" role="alert">{draftFailedMsg}</p>
          ) : hasDraft ? (
            <p className="draft-status" role="status">
              <i className="fa-solid fa-floppy-disk" aria-hidden="true" /> Draft auto-saved on this device
              {restoredDraft?.savedAt ? ` · restored from ${savedTime(restoredDraft.savedAt)}` : ""}
            </p>
          ) : null}
        </FormModal>
      )}

      {/* Edit — cached per entry; closing keeps the edits for "Resume edits" */}
      {editing && editForm && selectedEntry && (
        <FormModal
          title="Edit entry"
          width={720}
          className="journal-modal"
          submitLabel="Save changes"
          submitDisabled={!editForm.entry.trim()}
          onClose={dismissEdit}
          onSubmit={saveEdit}
          extraActions={<button className="btn btn-ghost" type="button" onClick={discardEdit}>Discard changes</button>}
        >
          <div className="journal-edit-row">
            <Field label="Title" className="journal-edit-title">
              <input value={editForm.title} onChange={(e) => updateEdit({ title: e.target.value })} placeholder="Title" />
            </Field>
            {/* Not a <label>: the picker is a button + portal popover */}
            <div className="uik-field journal-edit-date">
              <span className="field-label">Date</span>
              <DatePicker value={editForm.date} onChange={(v) => updateEdit({ date: v })} placeholder="Date" />
            </div>
          </div>
          <Field label="Entry">
            <textarea className="journal-body-field" value={editForm.entry} onChange={(e) => updateEdit({ entry: e.target.value }, { bodyInput: true })} rows={12} required data-autofocus />
          </Field>
          <WritingTools
            body={editForm.entry}
            timer={editTimer}
            clock={clock}
            onTimer={(action) => setTimerAction("edit", action)}
            cleanupVisible={cleanupAvailable && cleanupEnabled}
            cleanupBusy={cleanupBusy === "edit"}
            onCleanup={() => runCleanup("edit", editForm.entry)}
            pendingCleanup={editCleanup}
            onUndo={() => undoCleanup("edit")}
            notice={cleanupNotice?.mode === "edit" ? cleanupNotice : null}
          />
          {draftFailed && <p className="draft-status is-error" role="alert">{draftFailedMsg}</p>}
        </FormModal>
      )}
      {cleanupReview && (
        <CleanupReview
          review={cleanupReview}
          onCancel={() => setCleanupReview(null)}
          onAccept={acceptCleanup}
        />
      )}
      {dialog}
    </div>
  );
}

function WritingTools({ body, timer, clock, onTimer, cleanupVisible, cleanupBusy, onCleanup, pendingCleanup, onUndo, notice }) {
  const counts = journalWritingCounts(body);
  const elapsed = elapsedWritingMs(timer, clock);
  const offline = typeof navigator !== "undefined" && !navigator.onLine;
  const cleanupDisabled = !body.trim() || counts.characters > JOURNAL_CLEANUP_LIMIT || offline || cleanupBusy;
  return (
    <div className="journal-writing-tools" aria-label="Writing tools">
      <div className="journal-writing-stats">
        <span>{counts.characters} {counts.characters === 1 ? "character" : "characters"}</span>
        <span aria-hidden="true">·</span>
        <span>{counts.words} {counts.words === 1 ? "word" : "words"}</span>
        <span aria-hidden="true">·</span>
        <span className="journal-timer" aria-label={`Writing time ${formatWritingDuration(elapsed)}`}>{formatWritingDuration(elapsed)}</span>
      </div>
      <div className="journal-writing-actions">
        {timer.status === "running" ? (
          <button type="button" className="btn btn-sm btn-secondary-sm" onClick={() => onTimer("pause")}>Pause</button>
        ) : timer.status === "paused" ? (
          <button type="button" className="btn btn-sm btn-secondary-sm" onClick={() => onTimer("resume")}>Resume</button>
        ) : null}
        {elapsed > 0 && <button type="button" className="btn btn-sm btn-ghost" onClick={() => onTimer("reset")}>Reset</button>}
        {cleanupVisible && (
          <button
            type="button"
            className="btn btn-sm btn-secondary-sm"
            onClick={onCleanup}
            disabled={cleanupDisabled}
            aria-busy={cleanupBusy || undefined}
            title={counts.characters > JOURNAL_CLEANUP_LIMIT ? `Cleanup supports up to ${JOURNAL_CLEANUP_LIMIT.toLocaleString()} characters` : undefined}
          >
            <i className="fa-solid fa-wand-magic-sparkles" aria-hidden="true" /> {cleanupBusy ? "Cleaning…" : "Clean up writing"}
          </button>
        )}
        {pendingCleanup && <button type="button" className="btn btn-sm btn-ghost" onClick={onUndo}>Undo cleanup</button>}
      </div>
      {notice && <p className={`journal-cleanup-notice${notice.type === "error" ? " is-error" : ""}`} role={notice.type === "error" ? "alert" : "status"}>{notice.text}</p>}
    </div>
  );
}

function CleanupReview({ review, onCancel, onAccept }) {
  const diff = journalTextDiff(review.original, review.suggestion);
  return (
    <Modal
      title="Review cleanup"
      width={920}
      className="journal-cleanup-modal"
      onClose={onCancel}
      footer={(
        <>
          <button type="button" className="btn btn-secondary" onClick={onCancel} data-autofocus>Cancel</button>
          <button type="button" className="btn btn-primary" onClick={onAccept}>Use suggestion</button>
        </>
      )}
    >
      <p className="journal-cleanup-intro">Nothing is saved yet. Compare the original with the suggested grammar and spelling changes.</p>
      <div className="journal-cleanup-columns">
        <section><h4>Original</h4><pre>{review.original}</pre></section>
        <section><h4>Suggestion</h4><pre>{review.suggestion}</pre></section>
      </div>
      <section className="journal-cleanup-diff" aria-label="Changes">
        <h4>Changes</h4>
        <p>
          {diff.map((part, index) => part.type === "removed" ? (
            <del key={index}><span className="visually-hidden">Removed: </span>{part.text}</del>
          ) : part.type === "added" ? (
            <ins key={index}><span className="visually-hidden">Added: </span>{part.text}</ins>
          ) : <span key={index}>{part.text}</span>)}
        </p>
      </section>
    </Modal>
  );
}
