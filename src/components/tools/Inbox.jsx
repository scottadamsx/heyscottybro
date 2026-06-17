import { useEffect, useState } from "react";
import { loadMessages, createMessage, updateMessage, deleteMessage, syncGmail } from "../../api/messagesApi";
import { generateDraft } from "../../api/aiDraft";
import { useToast } from "../../contexts/ToastContext";

const CHANNELS = ["manual", "email", "slack", "discord"];
const CHANNEL = {
  manual: { prefix: "fa-solid", icon: "fa-inbox" },
  email: { prefix: "fa-solid", icon: "fa-envelope" },
  slack: { prefix: "fa-brands", icon: "fa-slack" },
  discord: { prefix: "fa-brands", icon: "fa-discord" },
};
const chOf = (c) => CHANNEL[c] || CHANNEL.manual;
const STATUS_LABEL = { needs_reply: "Needs reply", drafted: "Drafted", replied: "Replied", archived: "Archived" };

const EMPTY = { channel: "manual", sender: "", subject: "", body: "" };

function copy(text) {
  if (navigator.clipboard?.writeText) return navigator.clipboard.writeText(text);
  return Promise.reject();
}

export default function Inbox() {
  const { addToast } = useToast();
  const [rows, setRows] = useState([]);
  const [ready, setReady] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ ...EMPTY });
  const [open, setOpen] = useState(null);          // expanded message id
  const [drafts, setDrafts] = useState({});        // id -> editable draft text
  const [busy, setBusy] = useState(null);          // id currently drafting
  const [showArchived, setShowArchived] = useState(false);
  const [syncing, setSyncing] = useState(false);

  const refresh = () => loadMessages().then((r) => { setRows(r); setReady(true); }).catch((e) => { addToast(e.message, "error"); setReady(true); });
  useEffect(() => { refresh(); /* eslint-disable-next-line */ }, []);

  const sync = async () => {
    setSyncing(true);
    try {
      const { imported } = await syncGmail();
      addToast(imported ? `Imported ${imported} new message${imported === 1 ? "" : "s"} from Gmail.` : "No new starred emails.", "success");
      if (imported) refresh();
    } catch (e) { addToast(e.message, "error"); }
    finally { setSyncing(false); }
  };

  const add = async () => {
    if (!form.body.trim()) { addToast("Paste the message body.", "error"); return; }
    try {
      const m = await createMessage(form);
      setForm({ ...EMPTY }); setShowAdd(false);
      setRows((rs) => [m, ...rs]); setOpen(m.id);
    } catch (e) { addToast(e.message, "error"); }
  };

  const draftFor = (m) => drafts[m.id] ?? m.draft ?? "";

  const makeDraft = async (m) => {
    setBusy(m.id);
    try {
      const { draft } = await generateDraft(m);
      setDrafts((d) => ({ ...d, [m.id]: draft }));
      const updated = await updateMessage(m.id, { draft, status: m.status === "needs_reply" ? "drafted" : m.status });
      setRows((rs) => rs.map((x) => (x.id === m.id ? updated : x)));
    } catch (e) { addToast(e.message, "error"); }
    finally { setBusy(null); }
  };

  const saveDraft = async (m) => {
    try {
      const updated = await updateMessage(m.id, { draft: draftFor(m) });
      setRows((rs) => rs.map((x) => (x.id === m.id ? updated : x)));
      addToast("Draft saved.", "success");
    } catch (e) { addToast(e.message, "error"); }
  };

  const setStatus = async (m, status) => {
    try {
      const updated = await updateMessage(m.id, { status });
      setRows((rs) => rs.map((x) => (x.id === m.id ? updated : x)));
    } catch (e) { addToast(e.message, "error"); }
  };

  const remove = async (m) => {
    try { await deleteMessage(m.id); setRows((rs) => rs.filter((x) => x.id !== m.id)); }
    catch (e) { addToast(e.message, "error"); }
  };

  const copyDraft = (m) => copy(draftFor(m)).then(() => addToast("Draft copied.", "success")).catch(() => addToast("Copy failed.", "error"));

  if (!ready) return <p className="no-entries">Loading inbox…</p>;

  const visible = rows.filter((m) => (showArchived ? true : m.status !== "archived"));

  return (
    <div className="inbox">
      <div className="inbox-bar">
        <button className="btn btn-sm btn-primary-sm" onClick={() => setShowAdd((s) => !s)}>
          <i className="fa-solid fa-plus" /> Add message
        </button>
        <button className="btn btn-sm" onClick={sync} disabled={syncing}>
          {syncing ? <><i className="fa-solid fa-spinner fa-spin" /> Syncing…</> : <><i className="fa-solid fa-rotate" /> Sync from Gmail</>}
        </button>
        <label className="inbox-toggle">
          <input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} /> Show archived
        </label>
      </div>

      <p className="inbox-note">
        Paste a message to get an AI reply draft in your voice — edit it, then copy it where it needs to go.
        Email / Slack / Discord auto-sync plugs into the same inbox once those channels are connected.
      </p>

      {showAdd && (
        <div className="inbox-form">
          <div className="inbox-form-row">
            <select value={form.channel} onChange={(e) => setForm({ ...form, channel: e.target.value })}>
              {CHANNELS.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            <input placeholder="From (name / handle)" value={form.sender} onChange={(e) => setForm({ ...form, sender: e.target.value })} />
            <input placeholder="Subject (optional)" value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} />
          </div>
          <textarea placeholder="Paste the message you need to reply to…" rows={4} value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} />
          <div className="inbox-form-actions">
            <button className="btn btn-sm btn-primary-sm" onClick={add}>Add</button>
            <button className="btn btn-sm" onClick={() => setShowAdd(false)}>Cancel</button>
          </div>
        </div>
      )}

      {visible.length === 0 ? (
        <p className="no-entries">No messages yet. Add one to get an AI reply draft.</p>
      ) : (
        <div className="inbox-list">
          {visible.map((m) => {
            const expanded = open === m.id;
            return (
              <div className={`inbox-item${expanded ? " open" : ""}`} key={m.id}>
                <button className="inbox-item-head" onClick={() => setOpen(expanded ? null : m.id)}>
                  <i className={`${chOf(m.channel).prefix} ${chOf(m.channel).icon} inbox-ch-icon`} />
                  <div className="inbox-item-main">
                    <div className="inbox-item-title">{m.subject || m.sender || "(message)"}</div>
                    <div className="inbox-item-sub">{m.sender ? `${m.sender} · ` : ""}{m.body.slice(0, 80).replace(/\s+/g, " ")}…</div>
                  </div>
                  <span className={`inbox-status s-${m.status}`}>{STATUS_LABEL[m.status] || m.status}</span>
                </button>

                {expanded && (
                  <div className="inbox-item-body">
                    <div className="inbox-msg">{m.body}</div>
                    <div className="inbox-draft-head">
                      <span>Reply draft</span>
                      <button className="btn btn-sm" onClick={() => makeDraft(m)} disabled={busy === m.id}>
                        {busy === m.id ? <><i className="fa-solid fa-spinner fa-spin" /> Drafting…</> : <><i className="fa-solid fa-wand-magic-sparkles" /> {draftFor(m) ? "Redraft" : "Generate draft"}</>}
                      </button>
                    </div>
                    <textarea
                      className="inbox-draft"
                      rows={5}
                      placeholder="The AI draft appears here — edit it freely."
                      value={draftFor(m)}
                      onChange={(e) => setDrafts((d) => ({ ...d, [m.id]: e.target.value }))}
                    />
                    <div className="inbox-actions">
                      <button className="btn btn-sm btn-primary-sm" onClick={() => copyDraft(m)} disabled={!draftFor(m)}><i className="fa-solid fa-copy" /> Copy</button>
                      <button className="btn btn-sm" onClick={() => saveDraft(m)}>Save draft</button>
                      <button className="btn btn-sm" onClick={() => setStatus(m, "replied")}>✓ Replied</button>
                      <button className="btn btn-sm" onClick={() => setStatus(m, m.status === "archived" ? "needs_reply" : "archived")}>{m.status === "archived" ? "Unarchive" : "Archive"}</button>
                      <button className="btn-mini danger" onClick={() => remove(m)}><i className="fa-solid fa-trash" /></button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
