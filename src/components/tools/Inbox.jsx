import { useEffect, useState } from "react";
import { loadMessages, createMessage, updateMessage, deleteMessage, syncGmail, sendReply, markRead } from "../../api/messagesApi";
import { generateDraft } from "../../api/aiDraft";
import { useToast } from "../../contexts/ToastContext";
import { useConfirm } from "../../hooks/useConfirm";
import { FormModal, Field } from "../ui";
import "./tools.css";

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
  const { confirm, dialog } = useConfirm();
  const [rows, setRows] = useState([]);
  const [ready, setReady] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ ...EMPTY });
  const [open, setOpen] = useState(null);          // expanded message id
  const [drafts, setDrafts] = useState({});        // id -> editable draft text
  const [busy, setBusy] = useState(null);          // id currently drafting
  const [showArchived, setShowArchived] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [sending, setSending] = useState(null);     // id currently sending

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

  // FormModal: a thrown error stays in the modal with the pasted message kept.
  const add = async () => {
    if (!form.body.trim()) throw new Error("Paste the message body.");
    const m = await createMessage(form);
    setForm({ ...EMPTY });
    setRows((rs) => [m, ...rs]); setOpen(m.id);
  };

  const draftFor = (m) => drafts[m.id] ?? m.draft ?? "";

  // Toggle a message open; opening an unread one marks it read (app + Gmail).
  const openItem = (m, expanded) => {
    setOpen(expanded ? null : m.id);
    if (!expanded && !m.read) {
      setRows((rs) => rs.map((x) => (x.id === m.id ? { ...x, read: true } : x))); // optimistic
      markRead(m.id).catch((err) => {
        console.warn("[inbox] mark-read failed", err);
        setRows((rs) => rs.map((x) => (x.id === m.id ? { ...x, read: false } : x))); // revert optimistic
        addToast(`Couldn't mark as read: ${err?.message || err}`, "error");
      });
    }
  };

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

  const send = async (m) => {
    const text = draftFor(m);
    if (!text.trim()) { addToast("Write or generate a draft first.", "error"); return; }
    if (!await confirm(`Send this reply to ${m.sender || "the sender"} from your Gmail? This can't be undone.`, { title: "Send reply", confirmLabel: "Send" })) return;
    setSending(m.id);
    try {
      const { to } = await sendReply(m.id, text);   // server sends, marks replied, clears draft
      setRows((rs) => rs.map((x) => (x.id === m.id ? { ...x, status: "replied", draft: "" } : x)));
      setDrafts((d) => ({ ...d, [m.id]: "" }));      // empty the draft box
      addToast(`Reply sent${to ? ` to ${to}` : ""}.`, "success");
    } catch (e) { addToast(e.message, "error"); }
    finally { setSending(null); }
  };

  if (!ready) return <p className="no-entries">Loading inbox…</p>;

  const visible = rows.filter((m) => (showArchived ? true : m.status !== "archived"));

  return (
    <div className="inbox">
      {dialog}
      <div className="inbox-bar">
        <button type="button" className="btn btn-sm" onClick={() => setShowAdd(true)}>
          <i className="fa-solid fa-plus" aria-hidden="true" /> Add message
        </button>
        <button type="button" className="btn btn-sm btn-secondary-sm" onClick={sync} disabled={syncing}>
          {syncing ? <><i className="fa-solid fa-spinner fa-spin" aria-hidden="true" /> Syncing…</> : <><i className="fa-solid fa-rotate" aria-hidden="true" /> Sync from Gmail</>}
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
        <FormModal title="Add message" submitLabel="Add" submitDisabled={!form.body.trim()} onClose={() => setShowAdd(false)} onSubmit={add}>
          <div className="inbox-form-row">
            <Field label="Channel">
              <select value={form.channel} onChange={(e) => setForm({ ...form, channel: e.target.value })}>
                {CHANNELS.map((c) => <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>)}
              </select>
            </Field>
            <Field label="From">
              <input placeholder="Name / handle" value={form.sender} onChange={(e) => setForm({ ...form, sender: e.target.value })} />
            </Field>
          </div>
          <Field label="Subject" hint="Optional.">
            <input value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} />
          </Field>
          <Field label="Message">
            <textarea placeholder="Paste the message you need to reply to…" rows={6} required value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} data-autofocus />
          </Field>
        </FormModal>
      )}

      {visible.length === 0 ? (
        <p className="no-entries">No messages yet. Add one to get an AI reply draft.</p>
      ) : (
        <div className="inbox-list">
          {visible.map((m) => {
            const expanded = open === m.id;
            return (
              <div className={`inbox-item${expanded ? " open" : ""}${m.read ? "" : " unread"}`} key={m.id}>
                <button type="button" className="inbox-item-head" aria-expanded={expanded} onClick={() => openItem(m, expanded)}>
                  <span className="inbox-dot" aria-hidden="true" />
                  <i className={`${chOf(m.channel).prefix} ${chOf(m.channel).icon} inbox-ch-icon`} aria-hidden="true" />
                  <span className="inbox-item-main">
                    <span className="inbox-item-title">{!m.read && <span className="visually-hidden">Unread: </span>}{m.subject || m.sender || "(message)"}</span>
                    <span className="inbox-item-sub">{m.sender ? `${m.sender} · ` : ""}{m.body.slice(0, 80).replace(/\s+/g, " ")}…</span>
                  </span>
                  <span className={`inbox-status s-${m.status}`}>{STATUS_LABEL[m.status] || m.status}</span>
                </button>

                {expanded && (
                  <div className="inbox-item-body">
                    <div className="inbox-msg">{m.body}</div>
                    <div className="inbox-draft-head">
                      <span>Reply draft</span>
                      <button type="button" className="btn btn-sm btn-secondary-sm" onClick={() => makeDraft(m)} disabled={busy === m.id}>
                        {busy === m.id ? <><i className="fa-solid fa-spinner fa-spin" aria-hidden="true" /> Drafting…</> : <><i className="fa-solid fa-wand-magic-sparkles" aria-hidden="true" /> {draftFor(m) ? "Redraft" : "Generate draft"}</>}
                      </button>
                    </div>
                    <textarea
                      className="inbox-draft"
                      aria-label="Reply draft"
                      rows={5}
                      placeholder="The AI draft appears here — edit it freely."
                      value={draftFor(m)}
                      onChange={(e) => setDrafts((d) => ({ ...d, [m.id]: e.target.value }))}
                    />
                    <div className="inbox-actions">
                      {m.channel === "email" && (
                        <button type="button" className="btn btn-sm" onClick={() => send(m)} disabled={!draftFor(m) || sending === m.id || m.status === "replied"}>
                          {sending === m.id ? <><i className="fa-solid fa-spinner fa-spin" aria-hidden="true" /> Sending…</> : m.status === "replied" ? <><i className="fa-solid fa-check" aria-hidden="true" /> Sent</> : <><i className="fa-solid fa-paper-plane" aria-hidden="true" /> Send reply</>}
                        </button>
                      )}
                      <button type="button" className="btn btn-sm btn-secondary-sm" onClick={() => copyDraft(m)} disabled={!draftFor(m)}><i className="fa-solid fa-copy" aria-hidden="true" /> Copy</button>
                      <button type="button" className="btn btn-sm btn-secondary-sm" onClick={() => saveDraft(m)}>Save draft</button>
                      <button type="button" className="btn btn-sm btn-secondary-sm" onClick={() => setStatus(m, "replied")}>Replied</button>
                      <button type="button" className="btn btn-sm btn-secondary-sm" onClick={() => setStatus(m, m.status === "archived" ? "needs_reply" : "archived")}>{m.status === "archived" ? "Unarchive" : "Archive"}</button>
                      <button type="button" className="btn-mini danger" onClick={() => remove(m)} aria-label="Delete message" title="Delete message"><i className="fa-solid fa-trash" aria-hidden="true" /></button>
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
