import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useToast } from "../../contexts/ToastContext";
import { toDateStr } from "../../utils/plannerUtils";
import {
  loadDateIdeas, addDateIdea, deleteDateIdea,
  loadDateCompleted, addDateCompleted, updateDateMemory, deleteDateCompleted,
  syncLocalDatePlanner,
} from "../../api/datePlannerApi";

const EMOJIS = ["💖", "🍷", "🍿", "🎬", "🥾", "🏖️", "🎨", "🍣", "🎢", "🌃", "🎳", "🕯️", "☕", "🍜", "⛸️", "🎤"];

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
  const [emoji, setEmoji] = useState("💖");
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
    const optimistic = { id: `tmp-${Date.now()}`, title: title.trim(), emoji, note: note.trim() };
    setIdeas((prev) => [...prev, optimistic]);
    setTitle(""); setNote(""); setEmoji("💖");
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
      bg: ["#CF1124", "#1F62FF", "#ffffff", "#ff7a8a", "#ffd23f"][i % 5],
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
        <h1>💕 Date Night</h1>
        <span style={{ color: "var(--text-muted)", fontSize: "0.85rem" }}>
          {ideas.length} on the list · {completed.length} done
        </span>
        <button className="btn btn-sm" style={{ marginLeft: "auto" }} onClick={runSync} disabled={syncing}>
          {syncing ? <><i className="fa-solid fa-spinner fa-spin" /> Syncing…</> : <><i className="fa-solid fa-cloud-arrow-up" /> Sync local data</>}
        </button>
      </div>

      {error && <p className="error-message" style={{ marginBottom: "0.75rem" }}>{error}</p>}
      {syncMsg && <p className="no-entries" style={{ marginBottom: "0.75rem", color: "var(--accent,#4ade80)" }}>{syncMsg}</p>}
      {loading && <p className="no-entries"><i className="fa-solid fa-spinner fa-spin" /> Loading…</p>}

      {/* ── Pick-a-date pack opener ── */}
      <div className="db-card dates-pick" id="dates-pick">
        <h3 className="db-card-title">Pick our date</h3>
        {ideas.length === 0 ? (
          <p className="no-entries">Add a few ideas below, then open a pack to pick one ✨</p>
        ) : (
          <div className="pack-stage">
            <button
              type="button"
              className={`date-pack ${opening ? "opening" : ""}`}
              onClick={spin}
              disabled={opening}
            >
              <span className="date-pack-shine" />
              <span className="date-pack-inner">
                {opening ? (
                  <span className="pack-flash">{flash}</span>
                ) : (
                  <>
                    <span className="date-pack-spark">✨</span>
                    <span className="date-pack-label">Open a date pack</span>
                    <span className="date-pack-sub">tap to reveal a surprise</span>
                  </>
                )}
              </span>
            </button>
          </div>
        )}
      </div>

      {/* ── Reveal overlay ── */}
      {reveal && (
        <div className="reveal-overlay" onClick={(e) => { if (e.target.classList.contains("reveal-overlay")) setReveal(null); }}>
          <div className="confetti">
            {confetti.map((c) => (
              <span key={c.id} style={{ left: `${c.left}%`, background: c.bg, animationDelay: `${c.delay}s`, animationDuration: `${c.dur}s`, "--rot": `${c.rot}deg` }} />
            ))}
          </div>
          <div className="reveal-card">
            <div className="reveal-tag">Tonight&apos;s date</div>
            <div className="reveal-emoji">{reveal.emoji || "💖"}</div>
            <div className="reveal-title">{reveal.title}</div>
            {reveal.note && <div className="reveal-note">{reveal.note}</div>}
            <div className="reveal-actions">
              <button className="btn" onClick={() => openMarkDone(reveal)}>
                <i className="fa-solid fa-heart" /> We did it!
              </button>
              <button className="btn-tiny-blue" style={{ height: 38, padding: "0 1rem" }} onClick={spin}>
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
          <div className="event-card">
            <h3>When did you do this? 💞</h3>
            <div style={{ fontSize: "1.1rem", marginBottom: "0.75rem" }}>{markingDone.emoji} {markingDone.title}</div>
            <label style={{ fontSize: "0.82rem", color: "var(--text-muted)", marginBottom: "0.25rem", display: "block" }}>Date</label>
            <input type="date" value={doneDate} onChange={(e) => setDoneDate(e.target.value)} />
            <div className="budget-widget-actions" style={{ marginTop: "0.75rem" }}>
              <button className="btn" onClick={confirmMarkDone}>✓ Save memory</button>
              <button className="btn" style={{ background: "var(--bg-raised)", color: "var(--text-secondary)" }} onClick={() => setMarkingDone(null)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Bucket list ── */}
      <div className="db-card" id="dates-bucket">
        <div className="db-card-header">
          <h3 className="db-card-title">Date bucket list</h3>
        </div>

        <form className="add-idea-row" onSubmit={addIdea}>
          <select className="emoji-select" value={emoji} onChange={(e) => setEmoji(e.target.value)} aria-label="Emoji">
            {EMOJIS.map((em) => <option key={em} value={em}>{em}</option>)}
          </select>
          <input className="field-grow" placeholder="A date idea…" value={title} onChange={(e) => setTitle(e.target.value)} required />
          <input placeholder="note (optional)" value={note} onChange={(e) => setNote(e.target.value)} />
          <button className="btn" type="submit"><i className="fa-solid fa-plus" /> Add</button>
        </form>

        {ideas.length === 0 ? (
          <p className="no-entries">No ideas yet — add your first date above.</p>
        ) : (
          <div className="idea-grid">
            {ideas.map((i) => (
              <div className="idea-card" key={i.id}>
                <div className="idea-emoji">{i.emoji || "💖"}</div>
                <div className="idea-body">
                  <div className="idea-title">{i.title}</div>
                  {i.note && <div className="idea-note">{i.note}</div>}
                </div>
                <div className="idea-actions">
                  <button className="btn-sm btn-complete" onClick={() => openMarkDone(i)} title="We did this">✓</button>
                  <button className="btn-sm btn-delete" onClick={() => deleteIdea(i.id)} title="Remove">✕</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Completed ── */}
      <div className="db-card" id="dates-done">
        <div className="db-card-header">
          <h3 className="db-card-title">Been there 💞 ({completed.length})</h3>
        </div>
        {completed.length === 0 ? (
          <p className="no-entries">No dates logged yet. Go make some memories 🥰</p>
        ) : (
          <div className="done-list">
            {completed.map((c) => (
              <div className="done-item" key={c.id}>
                <span className="done-emoji">{c.emoji || "💖"}</span>
                <div className="done-body">
                  <div className="done-title">{c.title}</div>
                  {c.done_on && <div className="done-date">{fmtDoneDate(c.done_on)}</div>}
                  <input
                    className="done-memory"
                    placeholder="add a memory…"
                    value={c.memory || ""}
                    onChange={(e) => setMemory(c.id, e.target.value)}
                  />
                </div>
                <button className="btn-sm btn-delete" onClick={() => deleteDone(c.id)} title="Delete">✕</button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
