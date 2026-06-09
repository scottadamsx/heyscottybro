import { useState, useEffect, useMemo } from "react";

const STORAGE_KEY = "weed_tracker_v3";
const DAY = 86400000;

// Scotty gram presets
const GRAM_PRESETS = [0.1, 0.2, 0.3, 0.5, 0.75, 1.0, 1.5];

// Taper schedule: every N days reduce by amount
// Scott: every 3 days drop 0.2g. Maria: every 3 days drop 1 hit/day
const SCOTT_TAPER_INTERVAL = 3;  // days
const SCOTT_TAPER_STEP = 0.2;    // grams
const MARIA_TAPER_INTERVAL = 3;  // days
const MARIA_TAPER_STEP = 1;      // hits/day

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
    scott: {
      dailyCapG: 1.5,        // Scott's personal daily cap in grams
      taperEnabled: true,
      taperStart: null,
      logs: [],              // { id, ts, grams }
    },
    maria: {
      hitsPerDayCap: 8,      // Maria's personal daily hit cap
      cartridgeMg: 1000,
      mgPerSec: 1.5,
      hitSec: 6,
      daysTarget: 14,
      taperEnabled: true,
      taperStart: null,
      penStart: Date.now(),
      logs: [],              // { id, ts, sec, mg }
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

function toDateStr(ts) {
  return new Date(ts).toLocaleDateString("en-CA");
}

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

// Days elapsed since taperStart (or 0 if not started)
function taperDays(taperStart) {
  if (!taperStart) return 0;
  return Math.floor((Date.now() - taperStart) / DAY);
}

// ── Scott taper cap calculation ────────────────────────────
// Reduces by SCOTT_TAPER_STEP every SCOTT_TAPER_INTERVAL days
function scottTaperedCap(scott) {
  if (!scott.taperEnabled || !scott.taperStart) return scott.dailyCapG;
  const intervals = Math.floor(taperDays(scott.taperStart) / SCOTT_TAPER_INTERVAL);
  return Math.max(0.1, +(scott.dailyCapG - intervals * SCOTT_TAPER_STEP).toFixed(2));
}

// ── Maria taper hits/day calculation ──────────────────────
function mariaTaperedHitsPerDay(maria, baseHitsPerDay) {
  if (!maria.taperEnabled || !maria.taperStart) return baseHitsPerDay;
  const intervals = Math.floor(taperDays(maria.taperStart) / MARIA_TAPER_INTERVAL);
  return Math.max(1, baseHitsPerDay - intervals * MARIA_TAPER_STEP);
}

// ── Scotty View ───────────────────────────────────────────
function ScottyView({ state, onUpdate }) {
  const [logModal, setLogModal] = useState(false);
  const [selectedG, setSelectedG] = useState(null);
  const [customG, setCustomG] = useState("");

  const s = state.scott;
  const effectiveCap = scottTaperedCap(s);
  const daysElapsed = taperDays(s.taperStart);
  const nextReduction = s.taperEnabled && s.taperStart
    ? SCOTT_TAPER_INTERVAL - (daysElapsed % SCOTT_TAPER_INTERVAL)
    : null;

  const todayLogs = useMemo(() => s.logs.filter(l => toDateStr(l.ts) === today()), [s.logs]);
  const todayTotal = useMemo(() => todayLogs.reduce((a, l) => a + l.grams, 0), [todayLogs]);
  const weekLogs = useMemo(() => {
    const cut = Date.now() - 7 * DAY;
    return s.logs.filter(l => l.ts >= cut);
  }, [s.logs]);
  const weekTotal = weekLogs.reduce((a, l) => a + l.grams, 0);

  const progressPct = effectiveCap > 0 ? Math.min(100, (todayTotal / effectiveCap) * 100) : 0;
  const remaining = Math.max(0, effectiveCap - todayTotal);
  const isOver = todayTotal > effectiveCap;

  const doLog = () => {
    const g = selectedG !== null ? selectedG : parseFloat(customG);
    if (!g || g <= 0) return;
    onUpdate(d => { d.scott.logs.push({ id: genId(), ts: Date.now(), grams: g }); });
    setLogModal(false);
    setSelectedG(null);
    setCustomG("");
  };

  const startTaper = () => {
    onUpdate(d => { d.scott.taperStart = Date.now(); });
  };

  return (
    <>
      {/* Today */}
      <div className="wt-card">
        <div className="wt-card-head">
          <div>
            <div className="wt-card-title">Today</div>
            <div className="wt-card-sub">Track grams — stay under your daily cap.</div>
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
      </div>

      {/* Log */}
      <div className="wt-card">
        <button className="wt-logbtn" onClick={() => setLogModal(true)}>
          Log a session
          <small>tap to record how much you smoked</small>
        </button>
        <button className="wt-undo-btn" onClick={() => {
          if (s.logs.length) onUpdate(d => { d.scott.logs.pop(); });
        }}>Undo last</button>
      </div>

      {/* Taper plan */}
      <div className="wt-card">
        <div className="wt-card-title">Taper plan</div>
        <div className="wt-card-sub">
          Auto-reduces your cap by {SCOTT_TAPER_STEP}g every {SCOTT_TAPER_INTERVAL} days.
        </div>

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
            <div className="wt-taper-row">
              <span>Current cap</span>
              <strong>{effectiveCap.toFixed(2)}g/day</strong>
            </div>
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
                <span className="wt-hist-ic">🌿</span>
                <span className="wt-hist-desc">{l.grams}g</span>
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
          <div className="admin-pop-backdrop" onClick={() => setLogModal(false)} />
          <div className="wt-modal">
            <div className="wt-modal-header">
              <span className="wt-modal-title">Log session — Scott</span>
              <button className="icon-x" onClick={() => setLogModal(false)}><i className="fa-solid fa-xmark" /></button>
            </div>
            <div className="wt-modal-body">
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
              <button className="btn" style={{ width: "100%" }} onClick={doLog}
                disabled={selectedG === null && !customG}>
                <i className="fa-solid fa-leaf" /> Log {selectedG ?? customG || "?"}g
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
  const m = state.maria;
  const mgPerHit = +(m.mgPerSec * m.hitSec).toFixed(1);

  const usedThisPen = useMemo(
    () => m.logs.filter(l => l.ts >= m.penStart).reduce((a, l) => a + l.mg, 0),
    [m.logs, m.penStart]
  );

  const remain = Math.max(0, m.cartridgeMg - usedThisPen);
  const pct = Math.max(0, Math.min(100, (remain / m.cartridgeMg) * 100));

  // Base hits/day is Maria's personal cap, taper reduces it over time
  const baseHitsPerDay = m.hitsPerDayCap;
  const effectiveHitsPerDay = mariaTaperedHitsPerDay(m, baseHitsPerDay);

  const daysElapsed = taperDays(m.taperStart);
  const nextReduction = m.taperEnabled && m.taperStart
    ? MARIA_TAPER_INTERVAL - (daysElapsed % MARIA_TAPER_INTERVAL)
    : null;

  const todayHitLogs = useMemo(() => m.logs.filter(l => toDateStr(l.ts) === today()), [m.logs]);
  const todayHitCount = todayHitLogs.length;
  const todayMg = todayHitLogs.reduce((a, l) => a + l.mg, 0);
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

      {/* Today's hits */}
      <div className="wt-card">
        <div className="wt-card-title">Today&apos;s hits</div>
        <div className="wt-card-sub">
          Daily cap: <strong>{effectiveHitsPerDay} hits</strong>
          {m.taperEnabled && m.taperStart && effectiveHitsPerDay < baseHitsPerDay && (
            <span className="wt-taper-reduced"> (tapered down from {baseHitsPerDay})</span>
          )}
          {" "}· each hit ≈{mgPerHit}mg off the dab pen.
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
            <span>{todayHitCount} of {effectiveHitsPerDay} hits</span>
            <span>{Math.round(todayMg)}mg today</span>
          </div>
        </div>
      </div>

      {/* Log */}
      <div className="wt-card">
        <button className="wt-logbtn" style={{ "--lb": "#b68bd6", "--lb-glow": "#cda6e8" }}
          onClick={() => onUpdate(d => { d.maria.logs.push({ id: genId(), ts: Date.now(), sec: m.hitSec, mg: mgPerHit }); })}>
          Log a hit
          <small>{m.hitSec}s @ 3.5V · ≈{mgPerHit}mg per hit</small>
        </button>
        <button className="wt-undo-btn" onClick={() => {
          if (m.logs.length) onUpdate(d => { d.maria.logs.pop(); });
        }}>Undo last</button>
      </div>

      {/* Taper */}
      <div className="wt-card">
        <div className="wt-card-title">Hit taper — dab pen</div>
        <div className="wt-card-sub">
          Auto-reduces your daily hit cap by {MARIA_TAPER_STEP} every {MARIA_TAPER_INTERVAL} days.
        </div>
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
            <div className="wt-taper-row">
              <span>Current daily limit</span>
              <strong>{effectiveHitsPerDay} hits</strong>
            </div>
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
          { label: "Daily hit cap", sub: "hits per day (your personal limit)", val: `${m.hitsPerDayCap}`, dec: () => onUpdate(d => { d.maria.hitsPerDayCap = Math.max(1, d.maria.hitsPerDayCap - 1); }), inc: () => onUpdate(d => { d.maria.hitsPerDayCap++; }) },
          { label: "Make it last", sub: "days per cartridge", val: `${m.daysTarget}d`, dec: () => onUpdate(d => { d.maria.daysTarget = Math.max(1, d.maria.daysTarget - 1); }), inc: () => onUpdate(d => { d.maria.daysTarget++; }) },
          { label: "Average hit length", sub: "seconds", val: `${m.hitSec}s`, dec: () => onUpdate(d => { d.maria.hitSec = Math.max(1, d.maria.hitSec - 1); }), inc: () => onUpdate(d => { d.maria.hitSec++; }) },
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
                <span className="wt-hist-ic">💨</span>
                <span className="wt-hist-desc">{l.sec}s hit · {Math.round(l.mg)}mg</span>
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
