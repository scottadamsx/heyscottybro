import { useEffect, useMemo, useState } from "react";
import UpdatedMeta from "../../components/UpdatedMeta";
import { PageSkeleton } from "../../components/Skeleton";
import { useToast } from "../../contexts/ToastContext";
import { AGENTS } from "../../agents/registry";
import {
  loadResearchRequests, newResearchRequest, updateResearchRequest, deleteResearchRequest,
  RESEARCH_STATUSES,
} from "../../api/researchApi";
import DocLinks from "../../components/docs/DocLinks";
import { Badge, FormModal, Field } from "../../components/ui";
import { useConfirm } from "../../hooks/useConfirm";
import "./research.css";

const STATUS_META = {
  open:        { label: "Open",        icon: "fa-circle-dot",   cls: "open",      tone: "accent" },
  in_progress: { label: "In progress", icon: "fa-spinner",      cls: "progress",  tone: "warn" },
  delivered:   { label: "Delivered",   icon: "fa-circle-check", cls: "delivered", tone: "good" },
  archived:    { label: "Archived",    icon: "fa-box-archive",  cls: "archived",  tone: "default" },
};

export default function ResearchPage() {
  const { addToast } = useToast();
  const { confirm, dialog } = useConfirm();
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState("");
  const [details, setDetails] = useState("");
  const [assignee, setAssignee] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [showArchived, setShowArchived] = useState(false);

  const [loadError, setLoadError] = useState(null); // a failed read is NOT "no requests yet"
  const refresh = () => {
    setLoading(true);
    loadResearchRequests()
      .then((rows) => { setRequests(rows); setLoadError(null); })
      .catch((err) => { console.error("[research] load failed", err); setLoadError(`Couldn't load research requests: ${err?.message || err}`); })
      .finally(() => setLoading(false));
  };
  useEffect(() => { refresh(); }, []);

  const visible = useMemo(
    () => requests.filter((r) => showArchived || r.status !== "archived"),
    [requests, showArchived],
  );
  const openCount = requests.filter((r) => r.status === "open" || r.status === "in_progress").length;

  // FormModal: a thrown error stays in the modal with what was typed.
  async function add() {
    if (!title.trim()) return false;
    try { await newResearchRequest({ title, details, assignee }); }
    catch (err) { throw new Error(err?.message || "Could not create", { cause: err }); }
    setTitle(""); setDetails(""); setAssignee("");
    refresh();
    addToast("Research request created", "success");
  }

  async function setStatus(r, status) {
    try {
      await updateResearchRequest(r.id, { status });
      setRequests((rs) => rs.map((x) => (x.id === r.id ? { ...x, status, updated_at: new Date().toISOString() } : x)));
    } catch (err) { addToast(err.message || "Could not update", "error"); }
  }

  async function remove(r) {
    if (!await confirm(`Delete "${r.title}" and its document links?`, { title: "Delete request", confirmLabel: "Delete" })) return;
    try { await deleteResearchRequest(r.id); setRequests((rs) => rs.filter((x) => x.id !== r.id)); addToast("Deleted", "success"); }
    catch (err) { addToast(err.message || "Could not delete", "error"); }
  }

  const agentName = (id) => AGENTS.find((a) => a.id === id)?.name || id;

  return (
    <div className="module-page research-page">
      {dialog}
      <div className="module-header">
        <h1>Research</h1>
        <span className="research-count">{openCount} open</span>
        <label className="research-archived-toggle">
          <input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} /> Show archived
        </label>
        <button type="button" className="btn btn-sm" onClick={() => setShowNew(true)}>
          <i className="fa-solid fa-flask" aria-hidden="true" /> New request
        </button>
      </div>

      {showNew && (
        <FormModal title="New research request" submitLabel="Create request" submitDisabled={!title.trim()} onClose={() => setShowNew(false)} onSubmit={add}>
          <Field label="What do you want researched?">
            <input required value={title} onChange={(e) => setTitle(e.target.value)} data-autofocus />
          </Field>
          <Field label="Details" hint="Optional — questions, sources to use…">
            <textarea value={details} onChange={(e) => setDetails(e.target.value)} rows={4} />
          </Field>
          <Field label="Assign to">
            <select value={assignee} onChange={(e) => setAssignee(e.target.value)}>
              <option value="">Unassigned</option>
              {AGENTS.map((a) => <option key={a.id} value={a.id}>{a.name} · {a.title}</option>)}
            </select>
          </Field>
        </FormModal>
      )}

      {loading && <PageSkeleton variant="list" label="Loading research requests" header={false} page={false} />}
      {loadError && (
        <div className="load-error" role="alert">
          <p className="load-error-msg">{loadError}</p>
          <button type="button" className="btn btn-sm" onClick={refresh}>Retry</button>
        </div>
      )}
      {!loading && !loadError && visible.length === 0 && <p className="no-entries">No research requests yet. Create one with New request, then attach deliverable docs from your Brain as they’re ready.</p>}

      <div className="research-list">
        {visible.map((r) => {
          const meta = STATUS_META[r.status] || STATUS_META.open;
          return (
            <div className={`db-card research-card ${meta.cls}`} key={r.id}>
              <div className="research-card-head">
                <h3 className="db-card-title research-card-title">{r.title}</h3>
                <Badge tone={meta.tone} icon={meta.icon}>{meta.label}</Badge>
                {r.unread_count > 0 && <Badge tone="accent">{r.unread_count} unread</Badge>}
                {r.assignee && <span className="research-assignee"><i className="fa-solid fa-user-astronaut" aria-hidden="true" /> {agentName(r.assignee)}</span>}
              </div>
              {r.details && <p className="research-details">{r.details}</p>}

              <DocLinks entityType="research" entityId={r.id} title="Deliverables" />

              <div className="research-card-foot">
                <UpdatedMeta at={r.updated_at} createdAt={r.created_at} className="research-updated" />
                <select aria-label="Status" value={r.status} onChange={(e) => setStatus(r, e.target.value)} className="research-status-select">
                  {RESEARCH_STATUSES.map((s) => <option key={s} value={s}>{STATUS_META[s]?.label || s}</option>)}
                </select>
                <button type="button" className="btn-mini danger" onClick={() => remove(r)} title="Delete" aria-label={`Delete ${r.title}`}><i className="fa-solid fa-trash" aria-hidden="true" /></button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
