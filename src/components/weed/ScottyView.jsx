import { useState, useMemo } from "react";
import { useConfirm } from "../../hooks/useConfirm";
import { GRAM_PRESETS, TAPER_INTERVAL, TAPER_STEP, TAPER_FLOOR_G, FLOWER_THC_PCT, DAY, genId, toDateStr, today, timeAgo, taperDays, taperedCapG, daysToTaperFloor } from "../../utils/weedCalc";

export default function ScottyView({ state, onUpdate }) {
  const [logModal, setLogModal] = useState(false);
  const [logType, setLogType] = useState("joint");
  const [selectedG, setSelectedG] = useState(null);
  const [customG, setCustomG] = useState("");
  const [penHits, setPenHits] = useState(1);
  const { confirm, dialog } = useConfirm();

  const s = state.scott;
  const conv = state.penGramEquiv;
  const effectiveCap = taperedCapG(state.sharedDailyCapG, s);
  const daysElapsed = taperDays(s.taperStart);
  const nextReduction = s.taperEnabled && s.taperStart
    ? TAPER_INTERVAL - (daysElapsed % TAPER_INTERVAL)
    : null;
  // Counts down from the CURRENT tapered cap, so it moves as reductions land.
  const daysToGoal = daysToTaperFloor(effectiveCap, s);

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

  const capStatus = isOver ? "over" : todayTotal >= effectiveCap ? "at" : "under";
  const jointLogs = todayLogs.filter(l => !l.type || l.type === "joint");
  const penLogs = todayLogs.filter(l => l.type === "pen");

  return (
    <>
      {dialog}
      <div className="wt">
        <section className="db-card wt-today" aria-label="Today">
          <div className="db-card-header wt-card-head">
            <div className="wt-card-titles">
              <h3 className="db-card-title">Today</h3>
              <p className="wt-card-sub">
                Cap is <strong>{effectiveCap.toFixed(2)}g</strong> flower (~{FLOWER_THC_PCT}% THC) — joints + pen hits counted together.
              </p>
            </div>
            {s.taperEnabled && s.taperStart && (
              <span className="uik-badge tone-good wt-taper-badge">
                Day {daysElapsed + 1}
                {nextReduction === 1 && <span className="wt-taper-soon"> · ↓ tomorrow</span>}
              </span>
            )}
          </div>

          <div className="wt-stats-row">
            <div className="wt-stat">
              <span className="wt-stat-lbl">Smoked today</span>
              <span className="wt-stat-val">{todayTotal.toFixed(2)}g</span>
            </div>
            <div className="wt-stat">
              <span className="wt-stat-lbl">Remaining</span>
              <span className={`wt-stat-val${isOver ? " is-over" : ""}`}>{remaining.toFixed(2)}g</span>
            </div>
            <div className="wt-stat">
              <span className="wt-stat-lbl">This week</span>
              <span className="wt-stat-val">{weekTotal.toFixed(2)}g</span>
            </div>
          </div>

          <div className="wt-bar-wrap">
            <div className="wt-bar-track" role="progressbar" aria-label="Today against your cap" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progressPct)}>
              {/* width is the only inline value: today's share of the cap */}
              <div className={`wt-bar-fill is-${capStatus}`} style={{ width: `${progressPct}%` }} />
            </div>
            <div className="wt-bar-labels">
              <span>{todayTotal.toFixed(2)}g of {effectiveCap.toFixed(2)}g cap</span>
              <span className={`wt-cap-status is-${capStatus}`}>
                {isOver ? "over cap" : todayTotal >= effectiveCap ? "at cap" : "under cap"}
              </span>
            </div>
          </div>

          {todayLogs.length > 0 && (
            <div className="wt-today-types">
              {jointLogs.length > 0 && (
                <span className="wt-type-chip joint">
                  <i className="wt-type-dot" aria-hidden="true" />
                  {jointLogs.reduce((a,l)=>a+(l.grams||0),0).toFixed(2)}g joints
                </span>
              )}
              {penLogs.length > 0 && (
                <span className="wt-type-chip pen">
                  <i className="wt-type-dot" aria-hidden="true" />
                  {penLogs.reduce((a,l)=>a+(l.penHits||0),0)} hits
                  {" "}(≈{penLogs.reduce((a,l)=>a+(l.grams||0),0).toFixed(2)}g)
                </span>
              )}
            </div>
          )}

          <div className="wt-log-actions">
            <button type="button" className="btn wt-logbtn" onClick={() => setLogModal(true)}>
              <i className="fa-solid fa-plus" aria-hidden="true" /> Log a session
            </button>
            <button type="button" className="btn btn-ghost wt-undo-btn" onClick={() => {
              if (s.logs.length) onUpdate(d => { d.scott.logs.pop(); });
            }}>Undo last</button>
            <span className="wt-log-hint">Joint or pen hit — all on one bar.</span>
          </div>
        </section>

        <div className="wt-grid">
          <section className="db-card wt-taper" aria-label="Taper plan">
            <div className="db-card-header wt-card-head">
              <div className="wt-card-titles">
                <h3 className="db-card-title">Taper plan</h3>
                <p className="wt-card-sub">Auto-reduces your cap by {TAPER_STEP}g every {TAPER_INTERVAL} days.</p>
              </div>
            </div>

            <div className="wt-ctrl">
              <div>
                <div className="wt-ctrl-label">Shared daily cap</div>
                <div className="wt-ctrl-sub">grams per day — your daily limit</div>
              </div>
              <div className="wt-stepper">
                <button type="button" aria-label="Lower the daily cap" onClick={() => onUpdate(d => { d.sharedDailyCapG = Math.max(0.25, +(d.sharedDailyCapG - 0.25).toFixed(2)); })}>−</button>
                <span>{state.sharedDailyCapG}g</span>
                <button type="button" aria-label="Raise the daily cap" onClick={() => onUpdate(d => { d.sharedDailyCapG = +(d.sharedDailyCapG + 0.25).toFixed(2); })}>+</button>
              </div>
            </div>

            <div className="wt-ctrl">
              <div>
                <div className="wt-ctrl-label">1 pen hit =</div>
                <div className="wt-ctrl-sub">grams equivalent (shared setting)</div>
              </div>
              <div className="wt-stepper">
                <button type="button" aria-label="Lower grams per pen hit" onClick={() => onUpdate(d => { d.penGramEquiv = Math.max(0.05, +(d.penGramEquiv - 0.05).toFixed(2)); })}>−</button>
                <span>{conv.toFixed(2)}g</span>
                <button type="button" aria-label="Raise grams per pen hit" onClick={() => onUpdate(d => { d.penGramEquiv = +(d.penGramEquiv + 0.05).toFixed(2); })}>+</button>
              </div>
            </div>

            <div className="wt-ctrl">
              <div>
                <div className="wt-ctrl-label" id="wt-autotaper-label">Auto-taper</div>
                <div className="wt-ctrl-sub">−{TAPER_STEP}g every {TAPER_INTERVAL} days</div>
              </div>
              <div className="wt-switch-wrap">
                <span className="wt-switch-state" aria-hidden="true">{s.taperEnabled ? "On" : "Off"}</span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={Boolean(s.taperEnabled)}
                  aria-labelledby="wt-autotaper-label"
                  className={`settings-switch${s.taperEnabled ? " on" : ""}`}
                  onClick={() => onUpdate(d => { d.scott.taperEnabled = !d.scott.taperEnabled; })}
                >
                  <span className="settings-switch-knob" />
                </button>
              </div>
            </div>

            {s.taperEnabled && !s.taperStart && (
              <button type="button" className="btn wt-start-btn" onClick={() => onUpdate(d => { d.scott.taperStart = Date.now(); })}>
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
                  <span>{daysToGoal === 0 ? "Goal reached" : `Goal (in ${daysToGoal}d)`}</span>
                  <strong>{TAPER_FLOOR_G}g/day</strong>
                </div>
                <button type="button" className="btn-sm btn-secondary-sm wt-reset-btn"
                  onClick={async () => { if (await confirm("Reset taper timer?", { title: "Reset taper", confirmLabel: "Reset" })) onUpdate(d => { d.scott.taperStart = null; }); }}>
                  Reset taper
                </button>
              </div>
            )}
          </section>

          <section className="db-card wt-history-card" aria-label="History">
            <div className="db-card-header">
              <h3 className="db-card-title">History</h3>
            </div>
            {s.logs.length === 0 ? (
              <p className="no-entries">No sessions logged yet.</p>
            ) : (
              <ul className="wt-hist">
                {[...s.logs].reverse().slice(0, 25).map(l => (
                  <li key={l.id} className="wt-hist-item">
                    <span className={`wt-type-chip ${l.type === "pen" ? "pen" : "joint"}`}>
                      <i className="wt-type-dot" aria-hidden="true" />{l.type === "pen" ? "pen" : "joint"}
                    </span>
                    <span className="wt-hist-desc">
                      {l.type === "pen"
                        ? `${l.penHits} hit${l.penHits !== 1 ? "s" : ""} · ≈${(l.grams || 0).toFixed(2)}g`
                        : `${l.grams}g`}
                    </span>
                    <span className="wt-hist-time">{timeAgo(l.ts)}</span>
                    <button type="button" className="icon-x sm" aria-label={`Delete ${l.type === "pen" ? "pen" : "joint"} session from ${timeAgo(l.ts)}`}
                      onClick={() => onUpdate(d => { d.scott.logs = d.scott.logs.filter(x => x.id !== l.id); })}>
                      <i className="fa-solid fa-xmark" aria-hidden="true" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>

      {logModal && (
        <>
          <div className="wt-backdrop" onClick={closeModal} />
          <div className="wt-modal" role="dialog" aria-modal="true" aria-label="Log session">
            <div className="wt-modal-header">
              <h3 className="wt-modal-title">Log session — Scott</h3>
              <button type="button" className="icon-x" onClick={closeModal} aria-label="Close"><i className="fa-solid fa-xmark" aria-hidden="true" /></button>
            </div>
            <div className="wt-modal-body">
              <div className="segmented wt-log-type-toggle" role="radiogroup" aria-label="Session type">
                <button type="button" role="radio" aria-checked={logType === "joint"} className={`segmented-opt${logType === "joint" ? " active" : ""}`} onClick={() => setLogType("joint")}>
                  Joint (grams)
                </button>
                <button type="button" role="radio" aria-checked={logType === "pen"} className={`segmented-opt${logType === "pen" ? " active" : ""}`} onClick={() => setLogType("pen")}>
                  Pen hit
                </button>
              </div>

              {logType === "joint" && (
                <>
                  <div className="wt-gram-grid" role="group" aria-label="Grams">
                    {GRAM_PRESETS.map(g => (
                      <button key={g} type="button" className={`chip wt-gram-btn${selectedG === g ? " active" : ""}`} aria-pressed={selectedG === g}
                        onClick={() => { setSelectedG(g); setCustomG(""); }}>
                        {g}g
                      </button>
                    ))}
                  </div>
                  <input type="number" step="0.01" min="0.01" max="5" className="field"
                    placeholder="Custom (g)…" aria-label="Custom grams" value={customG}
                    onChange={e => { setCustomG(e.target.value); setSelectedG(null); }} />
                </>
              )}

              {logType === "pen" && (
                <div className="wt-pen-hits-wrap">
                  <div className="wt-ctrl-label">How many hits?</div>
                  <div className="wt-stepper lg">
                    <button type="button" aria-label="One fewer hit" onClick={() => setPenHits(h => Math.max(1, h - 1))}>−</button>
                    <span aria-live="polite">{penHits}</span>
                    <button type="button" aria-label="One more hit" onClick={() => setPenHits(h => h + 1)}>+</button>
                  </div>
                  <div className="wt-pen-conv-note">
                    {penHits} hit{penHits !== 1 ? "s" : ""} ≈ <strong>{+(penHits * conv).toFixed(2)}g</strong> equivalent
                    <span className="wt-pen-conv-sub"> (1 hit = {conv.toFixed(2)}g)</span>
                  </div>
                </div>
              )}

              <button type="button" className="btn wt-modal-go" onClick={doLog}
                disabled={logType === "joint" && selectedG === null && !customG}>
                <i className="fa-solid fa-leaf" aria-hidden="true" /> {logLabel}
              </button>
            </div>
          </div>
        </>
      )}
    </>
  );
}
