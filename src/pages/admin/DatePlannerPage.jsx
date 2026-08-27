import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useToast } from "../../contexts/ToastContext";
import { toDateStr } from "../../utils/plannerUtils";
import {
  loadDateIdeas, addDateIdea, deleteDateIdea,
  loadDateCompleted, addDateCompleted, updateDateMemory, deleteDateCompleted,
  syncLocalDatePlanner,
} from "../../api/datePlannerApi";
import "./dates.css";

export default function DatePlannerPage() {
  const [params] = useSearchParams();
  const { addToast } = useToast();

  const [ideas, setIdeas] = useState([]);
  const [completed, setCompleted] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState("");

  // add-idea form
  const [title, setTitle] = useState("");
  const [note, setNote] = useState("");

  // "mark done" date picker modal
  const [markingDone, setMarkingDone] = useState(null);
  const [doneDate, setDoneDate] = useState(() => toDateStr(new Date()));

  // pack opening
  const [opening, setOpening] = useState(false);
  const [flash, setFlash] = useState("");
  const [reveal, setReveal] = useState(null);
  const timerRef = useRef(null);
  const memDebounceRef = useRef({});

  useEffect(() => () => clearInterval(timerRef.current), []);

  // sidebar "Go to" → scroll to a section
  useEffect(() => {
    const s = params.get("section");
    if (!s) return;
    const el = document.getElementById(`dates-${s}`);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [params]);

  const load = async () => {
    setError("");
    try {
      const [i, c] = await Promise.all([loadDateIdeas(), loadDateCompleted()]);
      setIdeas(i);
      setCompleted(c);
    } catch (e) {
      setError(e?.message || String(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const addIdea = async (e) => {
    e.preventDefault();
    if (!title.trim()) return;
    const optimistic = { id: `tmp-${Date.now()}`, title: title.trim(), emoji: "", note: note.trim() };
    setIdeas((prev) => [...prev, optimistic]);
    setTitle(""); setNote("");
    try {
      const saved = await addDateIdea({ title: optimistic.title, emoji: optimistic.emoji, note: optimistic.note });
      setIdeas((prev) => prev.map((i) => (i.id === optimistic.id ? saved : i)));
    } catch (e) {
      setIdeas((prev) => prev.filter((i) => i.id !== optimistic.id));
      setError(e?.message || String(e));
    }
  };

  const deleteIdea = async (id) => {
    setIdeas((prev) => prev.filter((i) => i.id !== id));
    try { await deleteDateIdea(id); } catch (e) { setError(e?.message || String(e)); await load(); }
  };

  const openMarkDone = (idea) => {
    setMarkingDone(idea);
    setDoneDate(toDateStr(new Date()));
  };

  const confirmMarkDone = async () => {
    if (!markingDone) return;
    const idea = markingDone;
    setMarkingDone(null);
    setReveal(null);
    setIdeas((prev) => prev.filter((i) => i.id !== idea.id));
    const optimistic = { id: `tmp-${Date.now()}`, title: idea.title, emoji: idea.emoji, note: idea.note, memory: "", done_on: doneDate };
    setCompleted((prev) => [optimistic, ...prev]);
    try {
      await deleteDateIdea(idea.id);
      const saved = await addDateCompleted({ title: idea.title, emoji: idea.emoji, note: idea.note, done_on: doneDate });
      setCompleted((prev) => prev.map((c) => (c.id === optimistic.id ? saved : c)));
    } catch (e) {
      setError(e?.message || String(e));
      await load();
    }
  };

  const deleteDone = async (id) => {
    setCompleted((prev) => prev.filter((c) => c.id !== id));
    try { await deleteDateCompleted(id); } catch (e) { setError(e?.message || String(e)); await load(); }
  };

  const setMemory = (id, memory) => {
    setCompleted((prev) => prev.map((c) => (c.id === id ? { ...c, memory } : c)));
    clearTimeout(memDebounceRef.current[id]);
    memDebounceRef.current[id] = setTimeout(async () => {
      try { await updateDateMemory(id, memory); }
      catch (e) { addToast(e?.message || "Failed to save note.", "error"); }
    }, 600);
  };

  const runSync = async () => {
    setSyncing(true); setSyncMsg(""); setError("");
    try {
      const { ideas: i, completed: c } = await syncLocalDatePlanner();
      setSyncMsg(i + c > 0 ? `Synced ${i} idea${i !== 1 ? "s" : ""} and ${c} completed date${c !== 1 ? "s" : ""} from local storage.` : "Nothing new to sync.");
      await load();
    } catch (e) {
      setError(e?.message || String(e));
    } finally {
      setSyncing(false);
    }
  };

  const spin = () => {
    if (ideas.length === 0 || opening) return;
    setReveal(null);
    setOpening(true);
    const start = Date.now();
    const dur = 1700;
    clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setFlash(ideas[Math.floor(Math.random() * ideas.length)]?.title || "");
      if (Date.now() - start > dur) {
        clearInterval(timerRef.current);
        const chosen = ideas[Math.floor(Math.random() * ideas.length)];
        setOpening(false);
        setReveal(chosen);
      }
    }, 85);
  };

  const confetti = useMemo(
    () => Array.from({ length: 42 }, (_, i) => ({
      id: i,
      left: Math.random() * 100,
      delay: Math.random() * 0.5,
      dur: 1.6 + Math.random() * 1.4,
      bg: ["var(--bud-red)", "var(--accent)", "var(--text-primary)", "var(--accent-light)", "var(--bg-hover)"][i % 5],
      rot: Math.random() * 360,
    })),
    [reveal]
  );

  const fmtDoneDate = (d) => {
    if (!d) return "";
    return new Date(d + "T00:00:00").toLocaleDateString([], { weekday: "long", month: "long", day: "numeric" });
  };

  return (
    <div className="module-page dates-page">
      <div className="module-header">
        <h1>Date Night</h1>
        <div className="dates-toolbar">
          <span className="db-count dates-count">{ideas.length} on the list · {completed.length} done</span>
          <button className="btn btn-sm btn-secondary-sm" onClick={runSync} disabled={syncing}>
            {syncing ? <><i className="fa-solid fa-spinner fa-spin" /> Syncing…</> : <><i className="fa-solid fa-cloud-arrow-up" /> Sync local data</>}
          </button>
        </div>
      </div>

      {error && <p className="error-message">{error}</p>}
      {syncMsg && <p className="no-entries dates-sync-msg">{syncMsg}</p>}
      {loading && <p className="no-entries"><i className="fa-solid fa-spinner fa-spin" /> Loading…</p>}

      <div className="db-grid">
        <div className="col-6 dates-col">
          {/* ── Pick-a-date pack opener ── */}
          <div className="db-card dates-pick" id="dates-pick">
            <div className="db-card-header">
              <h3 className="db-card-title">Pick our date</h3>
              {ideas.length > 0 && <span className="db-count">{ideas.length} in the pack</span>}
            </div>
            {ideas.length === 0 ? (
              <p className="no-entries">Add a few ideas below, then open a pack to pick one.</p>
            ) : (
              <div className="pack-stage">
                <div className={`date-pack ${opening ? "opening" : ""}`} aria-live="polite">
                  <span className="date-pack-shine" />
                  <span className="date-pack-inner">
                    {opening ? (
                      <span className="pack-flash">{flash}</span>
                    ) : (
                      <>
                        <span className="date-pack-spark"><i className="fa-solid fa-gift" aria-hidden="true" /></span>
                        <span className="date-pack-label">A surprise date is waiting</span>
                        <span className="date-pack-sub">{ideas.length} idea{ideas.length !== 1 ? "s" : ""} shuffled inside</span>
                      </>
                    )}
                  </span>
                </div>
                <button type="button" className="btn date-pack-open" onClick={spin} disabled={opening}>
                  <i className={`fa-solid ${opening ? "fa-spinner fa-spin" : "fa-gift"}`} /> {opening ? "Opening…" : "Open a pack"}
                </button>
              </div>
            )}
          </div>

          {/* ── Bucket list ── */}
          <div className="db-card" id="dates-bucket">
            <div className="db-card-header">
              <h3 className="db-card-title">Date bucket list</h3>
              <span className="db-count">{ideas.length}</span>
            </div>

            <form className="add-idea-row" onSubmit={addIdea}>
              <input className="field-grow" placeholder="A date idea…" value={title} onChange={(e) => setTitle(e.target.value)} required aria-label="Date idea" />
              <input className="field-note" placeholder="note (optional)" value={note} onChange={(e) => setNote(e.target.value)} aria-label="Note" />
              <button className="btn btn-sm" type="submit"><i className="fa-solid fa-plus" /> Add</button>
            </form>

            {ideas.length === 0 ? (
              <p className="no-entries">No ideas yet — add your first date above.</p>
            ) : (
              <>
                <div className="section-label-sm">Ideas</div>
                <div className="db-list">
                  {ideas.map((i) => (
                    <div className="db-list-item dates-row" key={i.id}>
                      <div className="db-list-item-content dates-row-body">
                        <div className="db-list-item-title">{i.title}</div>
                        {i.note && <div className="db-list-item-subtitle">{i.note}</div>}
                      </div>
                      <div className="dates-row-actions">
                        <button className="btn-mini accent" onClick={() => openMarkDone(i)} title="We did this"><i className="fa-solid fa-check" /> Done</button>
                        <button className="icon-x sm" onClick={() => deleteIdea(i.id)} aria-label={`Remove ${i.title}`}><i className="fa-solid fa-xmark" /></button>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        {/* ── Completed ── */}
        <div className="col-6 dates-col">
          <div className="db-card" id="dates-done">
            <div className="db-card-header">
              <h3 className="db-card-title">Been there</h3>
              <span className="db-count">{completed.length}</span>
            </div>
            {completed.length === 0 ? (
              <p className="no-entries">No dates logged yet. Go make some memories.</p>
            ) : (
              <div className="db-list">
                {completed.map((c) => (
                  <div className="db-list-item dates-row" key={c.id}>
                    <div className="db-list-item-content dates-row-body dates-row-body--fixed">
                      <div className="db-list-item-title">{c.title}</div>
                      {c.done_on && <div className="db-list-item-subtitle">{fmtDoneDate(c.done_on)}</div>}
                    </div>
                    <input
                      className="done-memory"
                      placeholder="add a memory…"
                      value={c.memory || ""}
                      onChange={(e) => setMemory(c.id, e.target.value)}
                      aria-label={`Memory for ${c.title}`}
                    />
                    <button className="icon-x sm" onClick={() => deleteDone(c.id)} aria-label={`Delete ${c.title}`}><i className="fa-solid fa-xmark" /></button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Reveal overlay ── */}
      {reveal && (
        <div className="reveal-overlay" onClick={(e) => { if (e.target.classList.contains("reveal-overlay")) setReveal(null); }}>
          <div className="confetti">
            {confetti.map((c) => (
              <span key={c.id} style={{ left: `${c.left}%`, background: c.bg, animationDelay: `${c.delay}s`, animationDuration: `${c.dur}s`, "--rot": `${c.rot}deg` }} />
            ))}
          </div>
          <div className="reveal-card" role="dialog" aria-modal="true" aria-label="Tonight's date">
            <div className="reveal-tag">Tonight&apos;s date</div>
            <div className="reveal-emoji"><i className="fa-solid fa-heart" aria-hidden="true" /></div>
            <div className="reveal-title">{reveal.title}</div>
            {reveal.note && <div className="reveal-note">{reveal.note}</div>}
            <div className="reveal-actions">
              <button className="btn" onClick={() => openMarkDone(reveal)}>
                <i className="fa-solid fa-heart" /> We did it!
              </button>
              <button className="btn btn-sm btn-secondary-sm" onClick={spin}>
                <i className="fa-solid fa-rotate" /> Spin again
              </button>
              <button className="icon-x" onClick={() => setReveal(null)} aria-label="Close"><i className="fa-solid fa-xmark" /></button>
            </div>
          </div>
        </div>
      )}

      {/* ── Mark done date picker modal ── */}
      {markingDone && (
        <div className="event-overlay" onClick={(e) => { if (e.target.className === "event-overlay") setMarkingDone(null); }}>
          <div className="event-card" role="dialog" aria-modal="true" aria-label="When did you do this?">
            <h3>When did you do this?</h3>
            <div className="dates-modal-subject">{markingDone.title}</div>
            <label className="dates-modal-label" htmlFor="dates-done-on">Date</label>
            <input id="dates-done-on" type="date" value={doneDate} onChange={(e) => setDoneDate(e.target.value)} />
            <div className="budget-widget-actions">
              <button className="btn" onClick={confirmMarkDone}>Save memory</button>
              <button className="btn btn-secondary-sm" onClick={() => setMarkingDone(null)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
