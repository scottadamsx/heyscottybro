import { useState, useEffect, useMemo } from "react";

const STORAGE_KEY = "weed_tracker_v3";
const DAY = 86400000;

// Scotty gram presets
const GRAM_PRESETS = [0.1, 0.2, 0.3, 0.5, 0.75, 1.0, 1.5];

// Taper schedule
const SCOTT_TAPER_INTERVAL = 3;
const SCOTT_TAPER_STEP = 0.2;
const MARIA_TAPER_INTERVAL = 3;
const MARIA_TAPER_STEP = 1;

// ── Context classifier ────────────────────────────────────
const TRIGGERS = ["remember", "don't forget", "dont forget", "note that", "note:", "keep in mind", "fyi", "important", "for the record"];
const FACTWORDS = ["started", "likes", "loves", "hates", "works", "worked", "born", "birthday", "allergic", "allergy", "prefers", "anniversary", "favourite", "favorite", "named", "lives", "grew up", "quit", "wants", "married", "met", "studied", "plays"];
const TOPICS = { gardening: "Gardening", garden: "Gardening", work: "Work", school: "School", music: "Music", food: "Food", family: "Family", health: "Health", weed: "Cannabis", pen: "Cannabis", smoke: "Cannabis", joint: "Cannabis", birthday: "Date", anniversary: "Date" };

function classify(raw) {
  const t = raw.trim();
  if (!t) return { kind: "idle" };
  const lower = t.toLowerCase();
  let why = "", keep = false;
  const hitTrig = TRIGGERS.find(k => lower.startsWith(k) || lower.includes(` ${k} `) || lower.includes(`${k} `));
  if (hitTrig) { keep = true; why = `you said "${hitTrig}"`; }
  if (!keep) {
    const fw = FACTWORDS.find(w => lower.includes(w));
    if (fw) { keep = true; why = `reads like a fact ("${fw}")`; }
  }
  let fact = t.replace(/^(please\s+)?(remember(\s+that)?|note(\s+that)?|don'?t forget(\s+that)?|keep in mind(\s+that)?|fyi[\s,:-]*|important[\s,:-]*|for the record[\s,:-]*)\s*/i, "").trim();
  if (!fact) fact = t;
  fact = fact.charAt(0).toUpperCase() + fact.slice(1);
  const tags = [];
  ["scott", "maria"].forEach(n => {
    if (lower.includes(n)) { const T = n === "scott" ? "Scott" : "Maria"; if (!tags.includes(T)) tags.push(T); }
  });
  (t.match(/(?<!^)(?<![.!?]\s)\b[A-Z][a-z]{2,}\b/g) || []).forEach(c => {
    if (!tags.includes(c) && !["Remember", "Note"].includes(c)) tags.push(c);
  });
  Object.keys(TOPICS).forEach(k => {
    if (lower.includes(k)) { const T = TOPICS[k]; if (!tags.includes(T)) tags.push(T); }
  });
  return { kind: keep ? "keep" : "maybe", why, fact, tags: tags.slice(0, 6) };
}

// ── State ─────────────────────────────────────────────────
function freshState() {
  return {
    activeProfile: "scott",
    activeTab: "tracker",
    // Shared conversion: how many grams equals one pen hit
    penGramEquiv: 0.1,
    scott: {
      dailyCapG: 1.5,
      taperEnabled: true,
      taperStart: null,
      logs: [],  // { id, ts, type: "joint"|"pen", grams, penHits? }
    },
    maria: {
      hitsPerDayCap: 8,
      cartridgeMg: 1000,
      mgPerSec: 1.5,
      hitSec: 6,
      daysTarget: 14,
      taperEnabled: true,
      taperStart: null,
      penStart: Date.now(),
      logs: [],  // { id, ts, type: "hit"|"joint", hits, mg?, sec?, grams? }
    },
    context: [],
  };
}

function loadData() {
  try {
    const d = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (d) {
      const fresh = freshState();
      return {
        ...fresh, ...d,
        penGramEquiv: d.penGramEquiv ?? fresh.penGramEquiv,
        scott: { ...fresh.scott, ...(d.scott || {}) },
        maria: { ...fresh.maria, ...(d.maria || {}) },
      };
    }
  } catch { /* ignore */ }
  return freshState();
}

function genId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return `w${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

function toDateStr(ts) { return new Date(ts).toLocaleDateString("en-CA"); }
function today() { return toDateStr(Date.now()); }

function timeAgo(ts) {
  const d = Date.now() - ts;
  if (d < 60000) return "just now";
  if (d < 3600000) return `${Math.floor(d / 60000)}m ago`;
  const dk = toDateStr(ts);
  if (dk === today()) return new Date(ts).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  if (dk === toDateStr(Date.now() - DAY)) return "yesterday";
  return new Date(ts).toLocaleDateString([], { month: "short", day: "numeric" });
}

function taperDays(taperStart) {
  if (!taperStart) return 0;
  return Math.floor((Date.now() - taperStart) / DAY);
}

function scottTaperedCap(scott) {
  if (!scott.taperEnabled || !scott.taperStart) return scott.dailyCapG;
  const intervals = Math.floor(taperDays(scott.taperStart) / SCOTT_TAPER_INTERVAL);
  return Math.max(0.1, +(scott.dailyCapG - intervals * SCOTT_TAPER_STEP).toFixed(2));
}

function mariaTaperedHitsPerDay(maria, base) {
  if (!maria.taperEnabled || !maria.taperStart) return base;
  const intervals = Math.floor(taperDays(maria.taperStart) / MARIA_TAPER_INTERVAL);
  return Math.max(1, base - intervals * MARIA_TAPER_STEP);
}

// ── Scotty View ───────────────────────────────────────────
function ScottyView({ state, onUpdate }) {
  const [logModal, setLogModal] = useState(false);
  const [logType, setLogType] = useState("joint"); // "joint" | "pen"
  const [selectedG, setSelectedG] = useState(null);
  const [customG, setCustomG] = useState("");
  const [penHits, setPenHits] = useState(1);

  const s = state.scott;
  const conv = state.penGramEquiv;
  const effectiveCap = scottTaperedCap(s);
  const daysElapsed = taperDays(s.taperStart);
  const nextReduction = s.taperEnabled && s.taperStart
    ? SCOTT_TAPER_INTERVAL - (daysElapsed % SCOTT_TAPER_INTERVAL)
    : null;

  // All logs count by grams (pen hits are pre-converted to gram-equiv when logged)
  const todayLogs = useMemo(() => s.logs.filter(l => toDateStr(l.ts) === today()), [s.logs]);
  const todayTotal = useMemo(() => todayLogs.reduce((a, l) => a + (l.grams || 0), 0), [todayLogs]);
  const weekLogs = useMemo(() => s.logs.filter(l => l.ts >= Date.now() - 7 * DAY), [s.logs]);
  const weekTotal = weekLogs.reduce((a, l) => a + (l.grams || 0), 0);

  const progressPct = effectiveCap > 0 ? Math.min(100, (todayTotal / effectiveCap) * 100) : 0;
  const remaining = Math.max(0, effectiveCap - todayTotal);
  const isOver = todayTotal > effectiveCap;

  const closeModal = () => { setLogModal(false); setSelectedG(null); setCustomG(""); setPenHits(1); setLogType("joint"); };

  const doLog = () => {
    if (logType === "joint") {
      const g = selectedG !== null ? selectedG : parseFloat(customG);
      if (!g || g <= 0) return;
      onUpdate(d => { d.scott.logs.push({ id: genId(), ts: Date.now(), type: "joint", grams: g }); });
    } else {
      const n = Math.max(1, parseInt(penHits) || 1);
      const g = +(n * conv).toFixed(3);
      onUpdate(d => { d.scott.logs.push({ id: genId(), ts: Date.now(), type: "pen", penHits: n, grams: g }); });
    }
    closeModal();
  };

  const startTaper = () => onUpdate(d => { d.scott.taperStart = Date.now(); });

  // What the log button label should show
  const logLabel = logType === "pen"
    ? `Log ${penHits} hit${penHits !== 1 ? "s" : ""} (≈${+(penHits * conv).toFixed(2)}g)`
    : `Log ${(selectedG ?? customG) || "?"}g`;

  return (
    <>
      {/* Today */}
      <div className="wt-card">
        <div className="wt-card-head">
          <div>
            <div className="wt-card-title">Today</div>
            <div className="wt-card-sub">
              Cap is <strong>{effectiveCap.toFixed(2)}g</strong> — joints + pen hits counted together.
            </div>
          </div>
          {s.taperEnabled && s.taperStart && (
            <div className="wt-taper-badge">
              Day {daysElapsed + 1}
              {nextReduction === 1 && <span className="wt-taper-soon">↓ tomorrow</span>}
            </div>
          )}
        </div>
        <div className="wt-stats-row">
          <div className="wt-stat">
            <div className="wt-stat-val">{todayTotal.toFixed(2)}g</div>
            <div className="wt-stat-lbl">smoked today</div>
          </div>
          <div className="wt-stat">
            <div className="wt-stat-val" style={{ color: isOver ? "var(--red,#f87171)" : "var(--accent,#4ade80)" }}>
              {remaining.toFixed(2)}g
            </div>
            <div className="wt-stat-lbl">remaining</div>
          </div>
          <div className="wt-stat">
            <div className="wt-stat-val">{weekTotal.toFixed(2)}g</div>
            <div className="wt-stat-lbl">this week</div>
          </div>
        </div>
        <div className="wt-bar-wrap">
          <div className="wt-bar-track">
            <div className="wt-bar-fill" style={{
              width: `${progressPct}%`,
              background: isOver ? "linear-gradient(90deg,#f59e0b,#f87171)" : undefined
            }} />
          </div>
          <div className="wt-bar-labels">
            <span>{todayTotal.toFixed(2)}g of {effectiveCap.toFixed(2)}g cap</span>
            <span style={{ color: isOver ? "#f87171" : todayTotal >= effectiveCap ? "#f59e0b" : "#4ade80" }}>
              {isOver ? "over cap" : todayTotal >= effectiveCap ? "at cap" : "under cap"}
            </span>
          </div>
        </div>
        {/* Today's log breakdown by type */}
        {todayLogs.length > 0 && (
          <div className="wt-today-types">
            {todayLogs.filter(l => !l.type || l.type === "joint").length > 0 && (
              <span className="wt-type-chip joint">
                🌿 {todayLogs.filter(l => !l.type || l.type === "joint").reduce((a,l)=>a+(l.grams||0),0).toFixed(2)}g joints
              </span>
            )}
            {todayLogs.filter(l => l.type === "pen").length > 0 && (
              <span className="wt-type-chip pen">
                💨 {todayLogs.filter(l => l.type === "pen").reduce((a,l)=>a+(l.penHits||0),0)} hits
                {" "}(≈{todayLogs.filter(l => l.type === "pen").reduce((a,l)=>a+(l.grams||0),0).toFixed(2)}g)
              </span>
            )}
          </div>
        )}
      </div>

      {/* Log */}
      <div className="wt-card">
        <button className="wt-logbtn" onClick={() => setLogModal(true)}>
          Log a session
          <small>joint or pen hit — all on one bar</small>
        </button>
        <button className="wt-undo-btn" onClick={() => {
          if (s.logs.length) onUpdate(d => { d.scott.logs.pop(); });
        }}>Undo last</button>
      </div>

      {/* Taper plan */}
      <div className="wt-card">
        <div className="wt-card-title">Taper plan</div>
        <div className="wt-card-sub">Auto-reduces your cap by {SCOTT_TAPER_STEP}g every {SCOTT_TAPER_INTERVAL} days.</div>

        <div className="wt-ctrl">
          <div>
            <div className="wt-ctrl-label">Starting daily cap</div>
            <div className="wt-ctrl-sub">grams per day</div>
          </div>
          <div className="wt-stepper">
            <button onClick={() => onUpdate(d => { d.scott.dailyCapG = Math.max(0.25, +(d.scott.dailyCapG - 0.25).toFixed(2)); })}>−</button>
            <span>{s.dailyCapG}g</span>
            <button onClick={() => onUpdate(d => { d.scott.dailyCapG = +(d.scott.dailyCapG + 0.25).toFixed(2); })}>+</button>
          </div>
        </div>

        <div className="wt-ctrl">
          <div>
            <div className="wt-ctrl-label">1 pen hit =</div>
            <div className="wt-ctrl-sub">grams equivalent (shared setting)</div>
          </div>
          <div className="wt-stepper">
            <button onClick={() => onUpdate(d => { d.penGramEquiv = Math.max(0.05, +(d.penGramEquiv - 0.05).toFixed(2)); })}>−</button>
            <span>{conv.toFixed(2)}g</span>
            <button onClick={() => onUpdate(d => { d.penGramEquiv = +(d.penGramEquiv + 0.05).toFixed(2); })}>+</button>
          </div>
        </div>

        <div className="wt-ctrl">
          <div>
            <div className="wt-ctrl-label">Auto-taper</div>
            <div className="wt-ctrl-sub">−{SCOTT_TAPER_STEP}g every {SCOTT_TAPER_INTERVAL} days</div>
          </div>
          <button
            className={`wt-toggle${s.taperEnabled ? " on" : ""}`}
            onClick={() => onUpdate(d => { d.scott.taperEnabled = !d.scott.taperEnabled; })}
          >
            {s.taperEnabled ? "On" : "Off"}
          </button>
        </div>

        {s.taperEnabled && !s.taperStart && (
          <button className="btn" style={{ marginTop: "0.75rem", width: "100%" }} onClick={startTaper}>
            Start taper from today
          </button>
        )}

        {s.taperEnabled && s.taperStart && (
          <div className="wt-taper-status">
            <div className="wt-taper-row"><span>Current cap</span><strong>{effectiveCap.toFixed(2)}g/day</strong></div>
            <div className="wt-taper-row">
              <span>Next reduction</span>
              <strong>{nextReduction === 1 ? "tomorrow" : `in ${nextReduction} days`}</strong>
            </div>
            <div className="wt-taper-row">
              <span>Goal (in {Math.ceil(s.dailyCapG / SCOTT_TAPER_STEP) * SCOTT_TAPER_INTERVAL}d)</span>
              <strong>0.1g/day</strong>
            </div>
            <button className="wt-ghost-btn" style={{ marginTop: "0.5rem" }}
              onClick={() => { if (confirm("Reset taper timer?")) onUpdate(d => { d.scott.taperStart = null; }); }}>
              Reset taper
            </button>
          </div>
        )}
      </div>

      {/* History */}
      <div className="wt-card">
        <div className="wt-card-title">History</div>
        {s.logs.length === 0 ? (
          <p className="wt-empty">No sessions logged yet.</p>
        ) : (
          <ul className="wt-hist">
            {[...s.logs].reverse().slice(0, 25).map(l => (
              <li key={l.id} className="wt-hist-item">
                <span className="wt-hist-ic">{l.type === "pen" ? "💨" : "🌿"}</span>
                <span className="wt-hist-desc">
                  {l.type === "pen"
                    ? `${l.penHits} hit${l.penHits !== 1 ? "s" : ""} · ≈${(l.grams || 0).toFixed(2)}g`
                    : `${l.grams}g`}
                </span>
                <span className="wt-hist-time">{timeAgo(l.ts)}</span>
                <button className="wt-hist-del"
                  onClick={() => onUpdate(d => { d.scott.logs = d.scott.logs.filter(x => x.id !== l.id); })}>
                  ✕
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Log modal */}
      {logModal && (
        <>
          <div className="admin-pop-backdrop" onClick={closeModal} />
          <div className="wt-modal">
            <div className="wt-modal-header">
              <span className="wt-modal-title">Log session — Scott</span>
              <button className="icon-x" onClick={closeModal}><i className="fa-solid fa-xmark" /></button>
            </div>
            <div className="wt-modal-body">
              {/* Type toggle */}
              <div className="wt-log-type-toggle">
                <button
                  className={`wt-log-type-btn${logType === "joint" ? " active" : ""}`}
                  onClick={() => setLogType("joint")}
                >
                  🌿 Joint (grams)
                </button>
                <button
                  className={`wt-log-type-btn${logType === "pen" ? " active pen" : ""}`}
                  onClick={() => setLogType("pen")}
                >
                  💨 Pen hit
                </button>
              </div>

              {logType === "joint" && (
                <>
                  <div className="wt-gram-grid">
                    {GRAM_PRESETS.map(g => (
                      <button key={g}
                        className={`wt-gram-btn${selectedG === g ? " active" : ""}`}
                        onClick={() => { setSelectedG(g); setCustomG(""); }}>
                        {g}g
                      </button>
                    ))}
                  </div>
                  <input type="number" step="0.01" min="0.01" max="5" className="field"
                    placeholder="Custom (g)…"
                    value={customG}
                    onChange={e => { setCustomG(e.target.value); setSelectedG(null); }} />
                </>
              )}

              {logType === "pen" && (
                <div className="wt-pen-hits-wrap">
                  <div className="wt-ctrl-label" style={{ textAlign: "center", marginBottom: "0.5rem" }}>
                    How many hits?
                  </div>
                  <div className="wt-stepper lg">
                    <button onClick={() => setPenHits(h => Math.max(1, h - 1))}>−</button>
                    <span>{penHits}</span>
                    <button onClick={() => setPenHits(h => h + 1)}>+</button>
                  </div>
                  <div className="wt-pen-conv-note">
                    {penHits} hit{penHits !== 1 ? "s" : ""} ≈ <strong>{+(penHits * conv).toFixed(2)}g</strong> equivalent
                    <span className="wt-pen-conv-sub"> (1 hit = {conv.toFixed(2)}g)</span>
                  </div>
                </div>
              )}

              <button className="btn" style={{ width: "100%", marginTop: "0.25rem" }} onClick={doLog}
                disabled={logType === "joint" && selectedG === null && !customG}>
                <i className="fa-solid fa-leaf" /> {logLabel}
              </button>
            </div>
          </div>
        </>
      )}
    </>
  );
}

// ── Maria View ────────────────────────────────────────────
function MariaView({ state, onUpdate }) {
  const [showJointLog, setShowJointLog] = useState(false);
  const [jointGrams, setJointGrams] = useState("");

  const m = state.maria;
  const conv = state.penGramEquiv;
  const mgPerHit = +(m.mgPerSec * m.hitSec).toFixed(1);

  const usedThisPen = useMemo(
    () => m.logs.filter(l => l.ts >= m.penStart && (l.type === "hit" || !l.type)).reduce((a, l) => a + (l.mg || 0), 0),
    [m.logs, m.penStart]
  );

  const remain = Math.max(0, m.cartridgeMg - usedThisPen);
  const pct = Math.max(0, Math.min(100, (remain / m.cartridgeMg) * 100));

  const baseHitsPerDay = m.hitsPerDayCap;
  const effectiveHitsPerDay = mariaTaperedHitsPerDay(m, baseHitsPerDay);
  const daysElapsed = taperDays(m.taperStart);
  const nextReduction = m.taperEnabled && m.taperStart
    ? MARIA_TAPER_INTERVAL - (daysElapsed % MARIA_TAPER_INTERVAL)
    : null;

  // Count hits: pen entries = 1 hit each, joint entries = grams / conv
  const todayLogs = useMemo(() => m.logs.filter(l => toDateStr(l.ts) === today()), [m.logs]);
  const todayHitCount = useMemo(() =>
    todayLogs.reduce((a, l) => {
      if (l.type === "joint") return a + (l.hits || 0);
      return a + 1; // legacy or type="hit"
    }, 0),
    [todayLogs]
  );
  const todayMg = todayLogs.filter(l => !l.type || l.type === "hit").reduce((a, l) => a + (l.mg || 0), 0);
  const hitBarPct = Math.min(100, (todayHitCount / effectiveHitsPerDay) * 100);
  const isOver = todayHitCount > effectiveHitsPerDay;

  // Pace
  const elapsed = Math.max(0, (Date.now() - m.penStart) / DAY);
  const idealRemain = m.cartridgeMg * Math.max(0, 1 - elapsed / m.daysTarget);
  const diff = remain - idealRemain;
  let paceLabel, paceColor;
  if (remain <= 0) { paceLabel = "pen empty"; paceColor = "#f87171"; }
  else if (diff >= m.cartridgeMg * 0.06) { paceLabel = "ahead — nicely paced"; paceColor = "#4ade80"; }
  else if (diff >= -m.cartridgeMg * 0.06) { paceLabel = "on track"; paceColor = "#4ade80"; }
  else if (diff >= -m.cartridgeMg * 0.18) { paceLabel = "a bit fast"; paceColor = "#f59e0b"; }
  else { paceLabel = "burning too fast"; paceColor = "#f87171"; }

  // Projected empty
  let emptyTxt = "Runs out ~—";
  const daysUsed = Math.max(0.5, elapsed);
  const ratePerDay = usedThisPen / daysUsed;
  if (usedThisPen > 0 && ratePerDay > 0) {
    const daysLeft = remain / ratePerDay;
    const when = new Date(Date.now() + daysLeft * DAY);
    emptyTxt = `At this rate, empties ${when.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" })} (~${daysLeft.toFixed(1)}d)`;
  } else if (remain <= 0) {
    emptyTxt = "Pen is empty — start a fresh one.";
  }

  const logHit = () => onUpdate(d => {
    d.maria.logs.push({ id: genId(), ts: Date.now(), type: "hit", sec: m.hitSec, mg: mgPerHit });
  });

  const logJoint = () => {
    const g = parseFloat(jointGrams);
    if (!g || g <= 0) return;
    const hitsEquiv = +(g / conv).toFixed(2);
    onUpdate(d => {
      d.maria.logs.push({ id: genId(), ts: Date.now(), type: "joint", grams: g, hits: hitsEquiv });
    });
    setShowJointLog(false);
    setJointGrams("");
  };

  const startTaper = () => onUpdate(d => { d.maria.taperStart = Date.now(); });

  return (
    <>
      {/* Reservoir */}
      <div className="wt-card">
        <div className="wt-card-head">
          <div>
            <div className="wt-card-title">The pen</div>
            <div className="wt-card-sub">{m.cartridgeMg}mg cartridge · making it last {m.daysTarget} days.</div>
          </div>
          {m.taperEnabled && m.taperStart && (
            <div className="wt-taper-badge" style={{ "--tb": "#b68bd6" }}>
              Day {daysElapsed + 1}
              {nextReduction === 1 && <span className="wt-taper-soon">↓ tomorrow</span>}
            </div>
          )}
        </div>
        <div className="wt-reservoir">
          <div className="wt-tank" style={{ "--tank-color": "#b68bd6", "--tank-glow": "#cda6e8" }}>
            <div className="wt-tank-pct">{Math.round(pct)}%</div>
            <div className="wt-tank-ticks">{[0,1,2,3,4].map(i => <span key={i} />)}</div>
            <div className="wt-tank-fill" style={{ height: `${pct}%` }} />
          </div>
          <div className="wt-gauge-info">
            <div className="wt-stat">
              <div className="wt-stat-val" style={{ color: "#b68bd6" }}>{Math.round(remain)}mg</div>
              <div className="wt-stat-lbl">oil left of {m.cartridgeMg}mg</div>
            </div>
            <div className="wt-pace-pill" style={{ color: paceColor, borderColor: `${paceColor}66`, background: `${paceColor}14` }}>
              <span className="wt-pace-dot" style={{ background: paceColor }} />
              {paceLabel}
            </div>
            <div className="wt-empty-txt">{emptyTxt}</div>
          </div>
        </div>
      </div>

      {/* Today's progress bar */}
      <div className="wt-card">
        <div className="wt-card-title">Today&apos;s hits</div>
        <div className="wt-card-sub">
          Daily cap: <strong>{effectiveHitsPerDay} hits</strong>
          {m.taperEnabled && m.taperStart && effectiveHitsPerDay < baseHitsPerDay && (
            <span className="wt-taper-reduced"> (tapered down from {baseHitsPerDay})</span>
          )}
          {" "}· each pen hit ≈{mgPerHit}mg · joints converted at {conv.toFixed(2)}g/hit.
        </div>
        <div className="wt-bar-wrap">
          <div className="wt-bar-track">
            <div className="wt-bar-fill" style={{
              width: `${hitBarPct}%`,
              background: isOver
                ? "linear-gradient(90deg,#f59e0b,#f87171)"
                : "linear-gradient(90deg,#b68bd6,#cda6e8)"
            }} />
          </div>
          <div className="wt-bar-labels">
            <span>{todayHitCount.toFixed(1)} of {effectiveHitsPerDay} hits</span>
            <span style={{ color: isOver ? "#f87171" : "#b68bd6" }}>{Math.round(todayMg)}mg pen today</span>
          </div>
        </div>
        {/* Breakdown */}
        {todayLogs.length > 0 && (
          <div className="wt-today-types">
            {todayLogs.filter(l => !l.type || l.type === "hit").length > 0 && (
              <span className="wt-type-chip pen">
                💨 {todayLogs.filter(l => !l.type || l.type === "hit").length} pen hits
              </span>
            )}
            {todayLogs.filter(l => l.type === "joint").length > 0 && (
              <span className="wt-type-chip joint">
                🌿 {todayLogs.filter(l => l.type === "joint").reduce((a,l)=>a+(l.grams||0),0).toFixed(2)}g joint
                {" "}(≈{todayLogs.filter(l => l.type === "joint").reduce((a,l)=>a+(l.hits||0),0).toFixed(1)} hits)
              </span>
            )}
          </div>
        )}
      </div>

      {/* Log buttons */}
      <div className="wt-card">
        <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
          <button className="wt-logbtn" style={{ "--lb": "#b68bd6", "--lb-glow": "#cda6e8", flex: 1 }}
            onClick={logHit}>
            💨 Log a hit
            <small>{m.hitSec}s @ 3.5V · ≈{mgPerHit}mg</small>
          </button>
          <button className="wt-logbtn" style={{ "--lb": "#e8915b", "--lb-glow": "#f0a87a", flex: 1 }}
            onClick={() => setShowJointLog(v => !v)}>
            🌿 Log a joint
            <small>grams → hit equivalent</small>
          </button>
        </div>

        {showJointLog && (
          <div className="wt-joint-inline">
            <div className="wt-gram-grid">
              {[0.1, 0.2, 0.3, 0.5, 0.75, 1.0].map(g => (
                <button key={g}
                  className={`wt-gram-btn${jointGrams === String(g) ? " active" : ""}`}
                  onClick={() => setJointGrams(String(g))}>
                  {g}g
                </button>
              ))}
            </div>
            <input type="number" step="0.01" min="0.01" max="5" className="field"
              placeholder="Custom (g)…"
              value={jointGrams}
              onChange={e => setJointGrams(e.target.value)} />
            {jointGrams && parseFloat(jointGrams) > 0 && (
              <div className="wt-pen-conv-note">
                {jointGrams}g ≈ <strong>{+(parseFloat(jointGrams) / conv).toFixed(1)} hits</strong> equivalent
              </div>
            )}
            <button className="btn" style={{ width: "100%" }} onClick={logJoint} disabled={!jointGrams || parseFloat(jointGrams) <= 0}>
              <i className="fa-solid fa-leaf" /> Log {jointGrams || "?"}g joint
            </button>
          </div>
        )}

        <button className="wt-undo-btn" onClick={() => {
          if (m.logs.length) onUpdate(d => { d.maria.logs.pop(); });
        }}>Undo last</button>
      </div>

      {/* Taper */}
      <div className="wt-card">
        <div className="wt-card-title">Hit taper — dab pen</div>
        <div className="wt-card-sub">Auto-reduces daily hit cap by {MARIA_TAPER_STEP} every {MARIA_TAPER_INTERVAL} days.</div>
        <div className="wt-ctrl">
          <div>
            <div className="wt-ctrl-label">Auto-taper</div>
            <div className="wt-ctrl-sub">−{MARIA_TAPER_STEP} hit every {MARIA_TAPER_INTERVAL} days</div>
          </div>
          <button
            className={`wt-toggle${m.taperEnabled ? " on" : ""}`}
            style={m.taperEnabled ? { "--tg": "#b68bd6" } : undefined}
            onClick={() => onUpdate(d => { d.maria.taperEnabled = !d.maria.taperEnabled; })}
          >
            {m.taperEnabled ? "On" : "Off"}
          </button>
        </div>
        {m.taperEnabled && !m.taperStart && (
          <button className="btn" style={{ marginTop: "0.75rem", width: "100%", background: "#b68bd6" }} onClick={startTaper}>
            Start taper from today
          </button>
        )}
        {m.taperEnabled && m.taperStart && (
          <div className="wt-taper-status">
            <div className="wt-taper-row"><span>Current daily limit</span><strong>{effectiveHitsPerDay} hits</strong></div>
            <div className="wt-taper-row">
              <span>Next reduction</span>
              <strong>{nextReduction === 1 ? "tomorrow" : `in ${nextReduction} days`}</strong>
            </div>
            <button className="wt-ghost-btn" style={{ marginTop: "0.5rem" }}
              onClick={() => { if (confirm("Reset taper timer?")) onUpdate(d => { d.maria.taperStart = null; }); }}>
              Reset taper
            </button>
          </div>
        )}
      </div>

      {/* Settings */}
      <div className="wt-card">
        <div className="wt-card-title">Settings &amp; calibration</div>
        <div className="wt-card-sub">Nudge these until the gauge matches reality.</div>
        {[
          { label: "Daily hit cap", sub: "hits per day", val: `${m.hitsPerDayCap}`, dec: () => onUpdate(d => { d.maria.hitsPerDayCap = Math.max(1, d.maria.hitsPerDayCap - 1); }), inc: () => onUpdate(d => { d.maria.hitsPerDayCap++; }) },
          { label: "Make it last", sub: "days per cartridge", val: `${m.daysTarget}d`, dec: () => onUpdate(d => { d.maria.daysTarget = Math.max(1, d.maria.daysTarget - 1); }), inc: () => onUpdate(d => { d.maria.daysTarget++; }) },
          { label: "Hit length", sub: "seconds", val: `${m.hitSec}s`, dec: () => onUpdate(d => { d.maria.hitSec = Math.max(1, d.maria.hitSec - 1); }), inc: () => onUpdate(d => { d.maria.hitSec++; }) },
          { label: "mg per second", sub: "at 3.5V — calibration", val: `${m.mgPerSec.toFixed(1)}`, dec: () => onUpdate(d => { d.maria.mgPerSec = Math.max(0.1, +(d.maria.mgPerSec - 0.1).toFixed(1)); }), inc: () => onUpdate(d => { d.maria.mgPerSec = +(d.maria.mgPerSec + 0.1).toFixed(1); }) },
          { label: "Cartridge size", sub: "milligrams of oil", val: `${m.cartridgeMg}mg`, dec: () => onUpdate(d => { d.maria.cartridgeMg = Math.max(100, d.maria.cartridgeMg - 100); }), inc: () => onUpdate(d => { d.maria.cartridgeMg += 100; }) },
        ].map(row => (
          <div key={row.label} className="wt-ctrl">
            <div><div className="wt-ctrl-label">{row.label}</div><div className="wt-ctrl-sub">{row.sub}</div></div>
            <div className="wt-stepper">
              <button onClick={row.dec}>−</button>
              <span>{row.val}</span>
              <button onClick={row.inc}>+</button>
            </div>
          </div>
        ))}
        <button className="wt-ghost-btn" style={{ marginTop: "0.875rem" }}
          onClick={() => { if (confirm("Start a fresh pen? This resets the reservoir.")) onUpdate(d => { d.maria.penStart = Date.now(); }); }}>
          Start a fresh pen
        </button>
      </div>

      {/* History */}
      <div className="wt-card">
        <div className="wt-card-title">History</div>
        {m.logs.length === 0 ? (
          <p className="wt-empty">No hits logged on this pen yet.</p>
        ) : (
          <ul className="wt-hist">
            {[...m.logs].reverse().slice(0, 25).map(l => (
              <li key={l.id} className="wt-hist-item">
                <span className="wt-hist-ic">{l.type === "joint" ? "🌿" : "💨"}</span>
                <span className="wt-hist-desc">
                  {l.type === "joint"
                    ? `${l.grams}g joint · ≈${(l.hits || 0).toFixed(1)} hits`
                    : `${l.sec}s hit · ${Math.round(l.mg || 0)}mg`}
                </span>
                <span className="wt-hist-time">{timeAgo(l.ts)}</span>
                <button className="wt-hist-del"
                  onClick={() => onUpdate(d => { d.maria.logs = d.maria.logs.filter(x => x.id !== l.id); })}>
                  ✕
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}

// ── Context View ──────────────────────────────────────────
function ContextView({ state, onUpdate, activeProfile }) {
  const [input, setInput] = useState("");
  const [search, setSearch] = useState("");
  const verdict = useMemo(() => classify(input), [input]);

  const saveCtx = () => {
    if (!input.trim()) return;
    const c = classify(input.trim());
    onUpdate(d => {
      d.context.push({ id: genId(), ts: Date.now(), by: activeProfile, text: c.fact, tags: c.tags, why: c.why || "saved manually" });
    });
    setInput("");
  };

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    const items = [...state.context].reverse();
    return q ? items.filter(i => i.text.toLowerCase().includes(q) || i.tags.join(" ").toLowerCase().includes(q)) : items;
  }, [state.context, search]);

  const verdictColor = { idle: "var(--text-muted)", keep: "var(--accent,#4ade80)", maybe: "#f59e0b" };

  return (
    <>
      <div className="wt-card">
        <div className="wt-card-title">Add to context</div>
        <div className="wt-card-sub">Type anything worth remembering — say &ldquo;remember that…&rdquo; to force-save it.</div>
        <textarea
          className="wt-ctx-textarea"
          rows={3}
          placeholder={`e.g. "remember that ${activeProfile === "scott" ? "Scott" : "Maria"} prefers sativa strains"`}
          value={input}
          onChange={e => setInput(e.target.value)}
        />
        <div className="wt-verdict" style={{ color: verdictColor[verdict.kind] }}>
          {verdict.kind === "idle" && "Start typing…"}
          {verdict.kind === "keep" && <><strong>Worth keeping</strong> — {verdict.why}</>}
          {verdict.kind === "maybe" && <><strong>Looks like chatter</strong> — save it anyway if it matters</>}
        </div>
        {verdict.kind !== "idle" && verdict.fact && (
          <div className="wt-chips">
            <span className="wt-chip">will store: &ldquo;{verdict.fact.slice(0, 48)}{verdict.fact.length > 48 ? "…" : ""}&rdquo;</span>
            {(verdict.tags || []).map(tag => (
              <span key={tag} className={`wt-chip${["Scott", "Maria"].includes(tag) ? " accent" : ""}`}>#{tag}</span>
            ))}
          </div>
        )}
        <div className="wt-ctx-actions">
          <button className="btn" onClick={saveCtx} disabled={verdict.kind === "idle"}>
            {verdict.kind === "keep" ? "Save to context" : "Save anyway"}
          </button>
          <button className="wt-ghost-btn" onClick={() => setInput("")}>Clear</button>
        </div>
      </div>

      <div className="wt-card">
        <div className="wt-card-title">Saved context</div>
        <div className="wt-card-sub">Facts worth remembering about you both. Shared across profiles.</div>
        <input className="wt-search" placeholder="Search context…" value={search} onChange={e => setSearch(e.target.value)} />
        {filtered.length === 0 ? (
          <p className="wt-empty">{search ? "Nothing matches." : "No context saved yet."}</p>
        ) : filtered.map(item => (
          <div key={item.id} className="wt-ctx-item">
            <div className="wt-ctx-fact">{item.text}</div>
            {item.tags.length > 0 && (
              <div className="wt-chips" style={{ marginTop: "0.5rem" }}>
                {item.tags.map(tag => (
                  <span key={tag} className={`wt-chip${["Scott", "Maria"].includes(tag) ? " accent" : ""}`}>#{tag}</span>
                ))}
              </div>
            )}
            <div className="wt-ctx-meta">
              <span style={{ color: item.by === "scott" ? "#e8915b" : "#b68bd6", display: "flex", alignItems: "center", gap: "5px" }}>
                <span style={{ width: 7, height: 7, borderRadius: "50%", background: "currentColor", display: "inline-block" }} />
                {item.by === "scott" ? "Scott" : "Maria"}
              </span>
              <span>{timeAgo(item.ts)}</span>
              <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.why}</span>
              <button className="wt-ctx-del"
                onClick={() => onUpdate(d => { d.context = d.context.filter(x => x.id !== item.id); })}>
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

// ── Main Page ─────────────────────────────────────────────
export default function WeedTrackerPage() {
  const [state, setState] = useState(loadData);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state]);

  const onUpdate = (fn) => {
    setState(prev => {
      const next = JSON.parse(JSON.stringify(prev));
      fn(next);
      return next;
    });
  };

  const { activeProfile, activeTab } = state;

  return (
    <div className="module-page">
      <div className="module-header" style={{ flexWrap: "wrap", gap: "0.75rem" }}>
        <h1>🌿 Wind Down</h1>
        <div className="wt-profile-switcher">
          <button
            className={`wt-profile-btn scott${activeProfile === "scott" ? " active" : ""}`}
            onClick={() => onUpdate(d => { d.activeProfile = "scott"; })}
          >
            <span className="wt-profile-dot" />
            Scott
          </button>
          <button
            className={`wt-profile-btn maria${activeProfile === "maria" ? " active" : ""}`}
            onClick={() => onUpdate(d => { d.activeProfile = "maria"; })}
          >
            <span className="wt-profile-dot" />
            Maria
          </button>
        </div>
      </div>

      <div className="wt-tabs">
        <button className={activeTab === "tracker" ? "active" : ""}
          onClick={() => onUpdate(d => { d.activeTab = "tracker"; })}>
          Tracker
        </button>
        <button className={activeTab === "context" ? "active" : ""}
          onClick={() => onUpdate(d => { d.activeTab = "context"; })}>
          Context
        </button>
      </div>

      {activeTab === "tracker" && activeProfile === "scott" && (
        <ScottyView state={state} onUpdate={onUpdate} />
      )}
      {activeTab === "tracker" && activeProfile === "maria" && (
        <MariaView state={state} onUpdate={onUpdate} />
      )}
      {activeTab === "context" && (
        <ContextView state={state} onUpdate={onUpdate} activeProfile={activeProfile} />
      )}
    </div>
  );
}
