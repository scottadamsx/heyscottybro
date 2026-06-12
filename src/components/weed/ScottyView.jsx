import { useState, useMemo } from "react";
import { GRAM_PRESETS, TAPER_INTERVAL, TAPER_STEP, FLOWER_THC_PCT, DAY, genId, toDateStr, today, timeAgo, taperDays, taperedCapG } from "../../utils/weedCalc";

export default function ScottyView({ state, onUpdate }) {
  const [logModal, setLogModal] = useState(false);
  const [logType, setLogType] = useState("joint");
  const [selectedG, setSelectedG] = useState(null);
  const [customG, setCustomG] = useState("");
  const [penHits, setPenHits] = useState(1);

  const s = state.scott;
  const conv = state.penGramEquiv;
  const effectiveCap = taperedCapG(state.sharedDailyCapG, s);
  const daysElapsed = taperDays(s.taperStart);
  const nextReduction = s.taperEnabled && s.taperStart
    ? TAPER_INTERVAL - (daysElapsed % TAPER_INTERVAL)
    : null;

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

  const logLabel = logType === "pen"
    ? `Log ${penHits} hit${penHits !== 1 ? "s" : ""} (≈${+(penHits * conv).toFixed(2)}g)`
    : `Log ${(selectedG ?? customG) || "?"}g`;

  return (
    <>
      <div className="wt-card">
        <div className="wt-card-head">
          <div>
            <div className="wt-card-title">Today</div>
            <div className="wt-card-sub">
              Cap is <strong>{effectiveCap.toFixed(2)}g</strong> flower (~{FLOWER_THC_PCT}% THC) — shared with Maria, joints + pen hits counted together.
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
            <div className="wt-bar-fill" style={{ width: `${progressPct}%`, background: isOver ? "linear-gradient(90deg,#f59e0b,#f87171)" : undefined }} />
          </div>
          <div className="wt-bar-labels">
            <span>{todayTotal.toFixed(2)}g of {effectiveCap.toFixed(2)}g cap</span>
            <span style={{ color: isOver ? "#f87171" : todayTotal >= effectiveCap ? "#f59e0b" : "#4ade80" }}>
              {isOver ? "over cap" : todayTotal >= effectiveCap ? "at cap" : "under cap"}
            </span>
          </div>
        </div>
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

      <div className="wt-card">
        <button className="wt-logbtn" onClick={() => setLogModal(true)}>
          Log a session
          <small>joint or pen hit — all on one bar</small>
        </button>
        <button className="wt-undo-btn" onClick={() => {
          if (s.logs.length) onUpdate(d => { d.scott.logs.pop(); });
        }}>Undo last</button>
      </div>

      <div className="wt-card">
        <div className="wt-card-title">Taper plan</div>
        <div className="wt-card-sub">Auto-reduces your cap by {TAPER_STEP}g every {TAPER_INTERVAL} days.</div>

        <div className="wt-ctrl">
          <div>
            <div className="wt-ctrl-label">Shared daily cap</div>
            <div className="wt-ctrl-sub">grams per day — same limit for you and Maria</div>
          </div>
          <div className="wt-stepper">
            <button onClick={() => onUpdate(d => { d.sharedDailyCapG = Math.max(0.25, +(d.sharedDailyCapG - 0.25).toFixed(2)); })}>−</button>
            <span>{state.sharedDailyCapG}g</span>
            <button onClick={() => onUpdate(d => { d.sharedDailyCapG = +(d.sharedDailyCapG + 0.25).toFixed(2); })}>+</button>
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
            <div className="wt-ctrl-sub">−{TAPER_STEP}g every {TAPER_INTERVAL} days</div>
          </div>
          <button
            className={`wt-toggle${s.taperEnabled ? " on" : ""}`}
            onClick={() => onUpdate(d => { d.scott.taperEnabled = !d.scott.taperEnabled; })}
          >
            {s.taperEnabled ? "On" : "Off"}
          </button>
        </div>

        {s.taperEnabled && !s.taperStart && (
          <button className="btn" style={{ marginTop: "0.75rem", width: "100%" }} onClick={() => onUpdate(d => { d.scott.taperStart = Date.now(); })}>
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
              <span>Goal (in {Math.ceil(state.sharedDailyCapG / TAPER_STEP) * TAPER_INTERVAL}d)</span>
              <strong>0.1g/day</strong>
            </div>
            <button className="wt-ghost-btn" style={{ marginTop: "0.5rem" }}
              onClick={() => { if (confirm("Reset taper timer?")) onUpdate(d => { d.scott.taperStart = null; }); }}>
              Reset taper
            </button>
          </div>
        )}
      </div>

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

      {logModal && (
        <>
          <div className="admin-pop-backdrop" onClick={closeModal} />
          <div className="wt-modal">
            <div className="wt-modal-header">
              <span className="wt-modal-title">Log session — Scott</span>
              <button className="icon-x" onClick={closeModal}><i className="fa-solid fa-xmark" /></button>
            </div>
            <div className="wt-modal-body">
              <div className="wt-log-type-toggle">
                <button className={`wt-log-type-btn${logType === "joint" ? " active" : ""}`} onClick={() => setLogType("joint")}>
                  🌿 Joint (grams)
                </button>
                <button className={`wt-log-type-btn${logType === "pen" ? " active pen" : ""}`} onClick={() => setLogType("pen")}>
                  💨 Pen hit
                </button>
              </div>

              {logType === "joint" && (
                <>
                  <div className="wt-gram-grid">
                    {GRAM_PRESETS.map(g => (
                      <button key={g} className={`wt-gram-btn${selectedG === g ? " active" : ""}`}
                        onClick={() => { setSelectedG(g); setCustomG(""); }}>
                        {g}g
                      </button>
                    ))}
                  </div>
                  <input type="number" step="0.01" min="0.01" max="5" className="field"
                    placeholder="Custom (g)…" value={customG}
                    onChange={e => { setCustomG(e.target.value); setSelectedG(null); }} />
                </>
              )}

              {logType === "pen" && (
                <div className="wt-pen-hits-wrap">
                  <div className="wt-ctrl-label" style={{ textAlign: "center", marginBottom: "0.5rem" }}>How many hits?</div>
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
