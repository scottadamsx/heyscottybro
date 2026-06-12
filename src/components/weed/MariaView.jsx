import { useState, useMemo } from "react";
import { TAPER_INTERVAL, TAPER_STEP, FLOWER_THC_PCT, DAY, genId, toDateStr, today, timeAgo, taperDays, taperedCapG, gramsOf } from "../../utils/weedCalc";

export default function MariaView({ state, onUpdate }) {
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

  const effectiveCapG = taperedCapG(state.sharedDailyCapG, m);
  const capHitsEquiv = conv > 0 ? +(effectiveCapG / conv).toFixed(1) : 0;
  const daysElapsed = taperDays(m.taperStart);
  const nextReduction = m.taperEnabled && m.taperStart
    ? TAPER_INTERVAL - (daysElapsed % TAPER_INTERVAL)
    : null;

  const todayLogs = useMemo(() => m.logs.filter(l => toDateStr(l.ts) === today()), [m.logs]);
  const todayGrams = useMemo(() => gramsOf(todayLogs, conv), [todayLogs, conv]);
  const todayHitCount = conv > 0 ? todayGrams / conv : 0;
  const todayMg = todayLogs.filter(l => !l.type || l.type === "hit").reduce((a, l) => a + (l.mg || 0), 0);
  const hitBarPct = effectiveCapG > 0 ? Math.min(100, (todayGrams / effectiveCapG) * 100) : 0;
  const isOver = todayGrams > effectiveCapG;

  const elapsed = Math.max(0, (Date.now() - m.penStart) / DAY);
  const idealRemain = m.cartridgeMg * Math.max(0, 1 - elapsed / m.daysTarget);
  const diff = remain - idealRemain;
  let paceLabel, paceColor;
  if (remain <= 0) { paceLabel = "pen empty"; paceColor = "#f87171"; }
  else if (diff >= m.cartridgeMg * 0.06) { paceLabel = "ahead — nicely paced"; paceColor = "#4ade80"; }
  else if (diff >= -m.cartridgeMg * 0.06) { paceLabel = "on track"; paceColor = "#4ade80"; }
  else if (diff >= -m.cartridgeMg * 0.18) { paceLabel = "a bit fast"; paceColor = "#f59e0b"; }
  else { paceLabel = "burning too fast"; paceColor = "#f87171"; }

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
    onUpdate(d => { d.maria.logs.push({ id: genId(), ts: Date.now(), type: "joint", grams: g, hits: hitsEquiv }); });
    setShowJointLog(false);
    setJointGrams("");
  };

  const settingRows = [
    { label: "Shared daily cap", sub: "grams per day — same limit as Scott", val: `${state.sharedDailyCapG}g`, dec: () => onUpdate(d => { d.sharedDailyCapG = Math.max(0.25, +(d.sharedDailyCapG - 0.25).toFixed(2)); }), inc: () => onUpdate(d => { d.sharedDailyCapG = +(d.sharedDailyCapG + 0.25).toFixed(2); }) },
    { label: "1 pen hit =", sub: "grams equivalent (shared setting)", val: `${conv.toFixed(2)}g`, dec: () => onUpdate(d => { d.penGramEquiv = Math.max(0.05, +(d.penGramEquiv - 0.05).toFixed(2)); }), inc: () => onUpdate(d => { d.penGramEquiv = +(d.penGramEquiv + 0.05).toFixed(2); }) },
    { label: "Make it last", sub: "days per cartridge", val: `${m.daysTarget}d`, dec: () => onUpdate(d => { d.maria.daysTarget = Math.max(1, d.maria.daysTarget - 1); }), inc: () => onUpdate(d => { d.maria.daysTarget++; }) },
    { label: "Hit length", sub: "seconds", val: `${m.hitSec}s`, dec: () => onUpdate(d => { d.maria.hitSec = Math.max(1, d.maria.hitSec - 1); }), inc: () => onUpdate(d => { d.maria.hitSec++; }) },
    { label: "mg per second", sub: "at 3.5V — calibration", val: `${m.mgPerSec.toFixed(1)}`, dec: () => onUpdate(d => { d.maria.mgPerSec = Math.max(0.1, +(d.maria.mgPerSec - 0.1).toFixed(1)); }), inc: () => onUpdate(d => { d.maria.mgPerSec = +(d.maria.mgPerSec + 0.1).toFixed(1); }) },
    { label: "Cartridge size", sub: "milligrams of oil", val: `${m.cartridgeMg}mg`, dec: () => onUpdate(d => { d.maria.cartridgeMg = Math.max(100, d.maria.cartridgeMg - 100); }), inc: () => onUpdate(d => { d.maria.cartridgeMg += 100; }) },
  ];

  return (
    <>
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

      <div className="wt-card">
        <div className="wt-card-title">Today</div>
        <div className="wt-card-sub">
          Daily cap: <strong>{effectiveCapG.toFixed(2)}g</strong> flower (~{FLOWER_THC_PCT}% THC) — shared with Scott
          {" "}· ≈{capHitsEquiv} pen hits · 1 hit ≈ {conv.toFixed(2)}g · each pen hit ≈{mgPerHit}mg.
        </div>
        <div className="wt-bar-wrap">
          <div className="wt-bar-track">
            <div className="wt-bar-fill" style={{
              width: `${hitBarPct}%`,
              background: isOver ? "linear-gradient(90deg,#f59e0b,#f87171)" : "linear-gradient(90deg,#b68bd6,#cda6e8)"
            }} />
          </div>
          <div className="wt-bar-labels">
            <span>{todayGrams.toFixed(2)}g of {effectiveCapG.toFixed(2)}g (≈{todayHitCount.toFixed(1)} hits)</span>
            <span style={{ color: isOver ? "#f87171" : "#b68bd6" }}>{Math.round(todayMg)}mg pen today</span>
          </div>
        </div>
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

      <div className="wt-card">
        <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
          <button className="wt-logbtn" style={{ "--lb": "#b68bd6", "--lb-glow": "#cda6e8", flex: 1 }} onClick={logHit}>
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
                <button key={g} className={`wt-gram-btn${jointGrams === String(g) ? " active" : ""}`}
                  onClick={() => setJointGrams(String(g))}>
                  {g}g
                </button>
              ))}
            </div>
            <input type="number" step="0.01" min="0.01" max="5" className="field"
              placeholder="Custom (g)…" value={jointGrams}
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

      <div className="wt-card">
        <div className="wt-card-title">Taper plan</div>
        <div className="wt-card-sub">Auto-reduces the shared daily cap by {TAPER_STEP}g every {TAPER_INTERVAL} days.</div>
        <div className="wt-ctrl">
          <div>
            <div className="wt-ctrl-label">Auto-taper</div>
            <div className="wt-ctrl-sub">−{TAPER_STEP}g every {TAPER_INTERVAL} days</div>
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
          <button className="btn" style={{ marginTop: "0.75rem", width: "100%", background: "#b68bd6" }}
            onClick={() => onUpdate(d => { d.maria.taperStart = Date.now(); })}>
            Start taper from today
          </button>
        )}
        {m.taperEnabled && m.taperStart && (
          <div className="wt-taper-status">
            <div className="wt-taper-row"><span>Current daily limit</span><strong>{effectiveCapG.toFixed(2)}g (≈{capHitsEquiv} hits)</strong></div>
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

      <div className="wt-card">
        <div className="wt-card-title">Settings &amp; calibration</div>
        <div className="wt-card-sub">Nudge these until the gauge matches reality.</div>
        {settingRows.map(row => (
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
