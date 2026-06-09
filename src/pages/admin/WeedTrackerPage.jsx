import { useState, useEffect, useMemo } from "react";

const STORAGE_KEY = "weed_tracker_v1";

const PROFILES = [
  { id: "scott", name: "Scott", color: "#4f7cff", initial: "S" },
  { id: "maria", name: "Maria", color: "#f472b6", initial: "M" },
];

// 33-day plan: 4 reduction weeks + 5-day reset
const PLAN = [
  {
    phase: 0,
    label: "Week 1 — Baseline",
    duration: 7,
    startDay: 0,
    dailyGrams: 1.5,
    smokeDays: 7,
    desc: "Track your current use together. 1.5g shared per session, every day.",
  },
  {
    phase: 1,
    label: "Week 2 — Pull Back",
    duration: 7,
    startDay: 7,
    dailyGrams: 1.0,
    smokeDays: 5,
    desc: "Drop to 5 days this week. Share a gram each time you smoke.",
  },
  {
    phase: 2,
    label: "Week 3 — Cutting Down",
    duration: 7,
    startDay: 14,
    dailyGrams: 0.75,
    smokeDays: 4,
    desc: "4 smoking days max this week. ¾g shared per session.",
  },
  {
    phase: 3,
    label: "Week 4 — Goal Pace",
    duration: 7,
    startDay: 21,
    dailyGrams: 0.5,
    smokeDays: 3,
    desc: "3 days this week — this is your target! ½g shared per session.",
  },
  {
    phase: 4,
    label: "Reset — 5 Days Clean",
    duration: 5,
    startDay: 28,
    dailyGrams: 0,
    smokeDays: 0,
    desc: "No weed for 5 days straight. Clears tolerance and breaks the habit loop.",
  },
];

const TOTAL_PLAN_DAYS = 33;
const GRAM_PRESETS = [0.1, 0.2, 0.25, 0.3, 0.5, 0.75, 1.0];

function toDateStr(d) {
  return d.toISOString().slice(0, 10);
}

function addDays(dateStr, n) {
  const d = new Date(dateStr + "T12:00:00");
  d.setDate(d.getDate() + n);
  return toDateStr(d);
}

function daysBetween(a, b) {
  const da = new Date(a + "T12:00:00");
  const db = new Date(b + "T12:00:00");
  return Math.round((db - da) / 86400000);
}

function loadData() {
  try {
    const d = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (d && Array.isArray(d.logs)) return d;
  } catch {
    /* ignore */
  }
  return { startDate: null, logs: [] };
}

function genId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return `w${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

export default function WeedTrackerPage() {
  const [data, setData] = useState(loadData);
  const [logModal, setLogModal] = useState(null); // { profileId }
  const [selectedGrams, setSelectedGrams] = useState(null);
  const [customGrams, setCustomGrams] = useState("");

  const today = toDateStr(new Date());

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }, [data]);

  const save = (fn) =>
    setData((d) => {
      const next = { ...d, logs: [...d.logs] };
      fn(next);
      return next;
    });

  const startPlan = () => save((d) => { d.startDate = today; });

  const resetPlan = () => {
    if (!confirm("Reset the entire plan? This clears all logs.")) return;
    setData({ startDate: null, logs: [] });
  };

  const { startDate, logs } = data;

  // How many full days since plan started (0 = first day)
  const planDay = startDate ? daysBetween(startDate, today) : null;

  const currentPhase = useMemo(() => {
    if (planDay === null || planDay < 0) return null;
    for (let i = PLAN.length - 1; i >= 0; i--) {
      if (planDay >= PLAN[i].startDay) return PLAN[i];
    }
    return null;
  }, [planDay]);

  const planComplete = planDay !== null && planDay >= TOTAL_PLAN_DAYS;

  // Today's logs + total
  const todayLogs = useMemo(() => logs.filter((l) => l.date === today), [logs, today]);
  const todayTotal = useMemo(() => todayLogs.reduce((s, l) => s + l.grams, 0), [todayLogs]);

  // This week's unique smoking days
  const weekSmokeDays = useMemo(() => {
    if (!startDate || !currentPhase) return 0;
    const weekStart = addDays(startDate, currentPhase.startDay);
    const weekEnd = addDays(weekStart, currentPhase.duration);
    const days = new Set(logs.filter((l) => l.date >= weekStart && l.date < weekEnd).map((l) => l.date));
    return days.size;
  }, [logs, startDate, currentPhase]);

  const profileTodayGrams = (profileId) =>
    todayLogs.filter((l) => l.profile === profileId).reduce((s, l) => s + l.grams, 0);

  const recentLogs = useMemo(
    () => [...logs].sort((a, b) => b.at - a.at).slice(0, 25),
    [logs]
  );

  const doLog = () => {
    const grams =
      selectedGrams !== null ? selectedGrams : parseFloat(customGrams);
    if (!grams || grams <= 0 || !logModal) return;
    save((d) => {
      d.logs.push({
        id: genId(),
        profile: logModal.profileId,
        date: today,
        grams,
        at: Date.now(),
      });
    });
    setLogModal(null);
    setSelectedGrams(null);
    setCustomGrams("");
  };

  const deleteLog = (id) => save((d) => { d.logs = d.logs.filter((l) => l.id !== id); });

  const todaySmoked = todayLogs.length > 0;
  const daysAllowed = currentPhase?.smokeDays ?? 0;
  const canSmokeToday =
    currentPhase &&
    currentPhase.smokeDays > 0 &&
    (todaySmoked || weekSmokeDays < daysAllowed);
  const isResetPhase = currentPhase?.phase === 4;
  const dailyLimit = currentPhase?.dailyGrams ?? 0;
  const progressPct = dailyLimit > 0 ? Math.min((todayTotal / dailyLimit) * 100, 100) : 0;
  const planProgressPct =
    planDay !== null ? Math.min((Math.max(planDay, 0) / TOTAL_PLAN_DAYS) * 100, 100) : 0;

  // Week dots for current phase
  const weekDots = useMemo(() => {
    if (!startDate || !currentPhase) return [];
    const weekStart = addDays(startDate, currentPhase.startDay);
    return Array.from({ length: currentPhase.duration }, (_, i) => {
      const ds = addDays(weekStart, i);
      return {
        date: ds,
        smoked: logs.some((l) => l.date === ds),
        isToday: ds === today,
        isFuture: ds > today,
      };
    });
  }, [startDate, currentPhase, logs, today]);

  // ── Setup / completion screen ────────────────────────────
  if (!startDate || planComplete) {
    return (
      <div className="module-page">
        <div className="module-header">
          <h1>🌿 Smoke Tracker</h1>
        </div>
        {planComplete ? (
          <div className="wt-setup-card">
            <div className="wt-setup-icon">🎉</div>
            <h2>Plan Complete!</h2>
            <p>
              You finished the 33-day reduction plan. Tolerance is reset — you&apos;re at
              the target pace of 3&times;/week, ½g shared.
            </p>
            <button className="btn" onClick={resetPlan}>
              Start a New Plan
            </button>
          </div>
        ) : (
          <div className="wt-setup-card">
            <div className="wt-setup-icon">🌿</div>
            <h2>Scott &amp; Maria&apos;s Reduction Plan</h2>
            <p>
              33 days to go from daily to 3&times;/week — then a full 5-day tolerance
              reset. Track who smoked what and stay on pace together.
            </p>
            <div className="wt-plan-preview">
              {PLAN.map((p) => (
                <div key={p.phase} className="wt-plan-row">
                  <div className="wt-plan-week">{p.label}</div>
                  <div className="wt-plan-detail">
                    {p.smokeDays === 0
                      ? "0 days — full reset"
                      : `${p.smokeDays} day${p.smokeDays > 1 ? "s" : ""}/wk · ${p.dailyGrams}g shared per session`}
                  </div>
                </div>
              ))}
            </div>
            <button className="btn" onClick={startPlan}>
              Start Plan Today
            </button>
          </div>
        )}
      </div>
    );
  }

  // ── Active plan screen ───────────────────────────────────
  return (
    <div className="module-page">
      <div className="module-header">
        <h1>🌿 Smoke Tracker</h1>
        <button className="btn-sm btn-secondary-sm" onClick={resetPlan}>
          Reset Plan
        </button>
      </div>

      {/* Overall plan progress */}
      <div className="wt-plan-bar">
        <div className="wt-plan-bar-header">
          <span className="wt-phase-name">
            {currentPhase ? currentPhase.label : "Plan Complete"}
          </span>
          <span className="wt-plan-day">
            Day {Math.max(planDay + 1, 1)} / {TOTAL_PLAN_DAYS}
          </span>
        </div>
        <div className="wt-progress-track">
          <div
            className="wt-progress-fill wt-plan-fill"
            style={{ width: `${planProgressPct}%` }}
          />
          {PLAN.map((p) => (
            <div
              key={p.phase}
              className={`wt-phase-marker ${planDay >= p.startDay ? "passed" : ""}`}
              style={{ left: `${(p.startDay / TOTAL_PLAN_DAYS) * 100}%` }}
              title={p.label}
            />
          ))}
        </div>
        <div className="wt-phase-labels">
          {PLAN.map((p) => (
            <span
              key={p.phase}
              style={{ left: `${(p.startDay / TOTAL_PLAN_DAYS) * 100}%` }}
            >
              {p.phase < 4 ? `W${p.phase + 1}` : "R"}
            </span>
          ))}
        </div>
        {currentPhase && (
          <p className="wt-phase-desc">{currentPhase.desc}</p>
        )}
      </div>

      {isResetPhase ? (
        /* ── Reset phase ─────────────────────── */
        <div className="wt-reset-card">
          <div className="wt-reset-icon">🚫</div>
          <h2>Reset Week</h2>
          <p>{currentPhase.desc}</p>
          <div className="wt-reset-days">
            {Array.from({ length: 5 }, (_, i) => {
              const ds = addDays(startDate, 28 + i);
              const isToday = ds === today;
              const isPast = ds < today;
              return (
                <div
                  key={i}
                  className={`wt-reset-day${isToday ? " today" : ""}${isPast ? " clean" : ""}${ds > today ? " future" : ""}`}
                >
                  <span className="wt-rd-num">{i + 1}</span>
                  <span className="wt-rd-label">
                    {isPast ? "✓" : isToday ? "Today" : ""}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <>
          {/* ── Today's status ────────────────────── */}
          <div className="wt-today-card">
            <div className="wt-today-header">
              <div>
                <div className="wt-today-label">Today&apos;s Limit</div>
                <div className="wt-today-limit">{dailyLimit}g shared</div>
              </div>
              <div className="wt-today-stats">
                <div className="wt-stat">
                  <div className="wt-stat-val">{todayTotal.toFixed(2)}g</div>
                  <div className="wt-stat-lbl">smoked</div>
                </div>
                <div className="wt-stat">
                  <div
                    className="wt-stat-val"
                    style={{
                      color:
                        dailyLimit - todayTotal < 0
                          ? "var(--red, #f87171)"
                          : undefined,
                    }}
                  >
                    {Math.max(0, dailyLimit - todayTotal).toFixed(2)}g
                  </div>
                  <div className="wt-stat-lbl">left</div>
                </div>
                <div className="wt-stat">
                  <div className="wt-stat-val">
                    {Math.max(0, daysAllowed - weekSmokeDays + (todaySmoked ? 1 : 0))}
                  </div>
                  <div className="wt-stat-lbl">days left</div>
                </div>
              </div>
            </div>

            {/* Daily progress bar */}
            <div className="wt-progress-track" style={{ marginTop: "0.875rem" }}>
              <div
                className={`wt-progress-fill${progressPct >= 100 ? " wt-fill-over" : ""}`}
                style={{ width: `${progressPct}%` }}
              />
            </div>
            <div className="wt-progress-labels">
              <span>0g</span>
              <span
                style={{
                  color: progressPct >= 100 ? "var(--red, #f87171)" : undefined,
                }}
              >
                {todayTotal.toFixed(2)}g / {dailyLimit}g
              </span>
            </div>

            {/* Week smoking days */}
            <div className="wt-week-status">
              <div className="wt-week-label">
                This week:{" "}
                <b>
                  {weekSmokeDays} of {daysAllowed}
                </b>{" "}
                allowed smoking days used
              </div>
              <div className="wt-week-dots">
                {weekDots.map((dot, i) => (
                  <div
                    key={i}
                    className={`wt-dot${dot.smoked ? " smoked" : ""}${dot.isToday ? " today" : ""}${dot.isFuture ? " future" : ""}`}
                    title={dot.date}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* ── Profile cards ─────────────────────── */}
          <div className="wt-profiles">
            {PROFILES.map((p) => {
              const grams = profileTodayGrams(p.id);
              return (
                <div
                  key={p.id}
                  className="wt-profile-card"
                  style={{ "--pc": p.color }}
                >
                  <div className="wt-avatar">{p.initial}</div>
                  <div className="wt-profile-info">
                    <div className="wt-profile-name">{p.name}</div>
                    <div className="wt-profile-sub">
                      {grams > 0 ? `${grams.toFixed(2)}g today` : "Nothing yet today"}
                    </div>
                  </div>
                  <button
                    className="btn btn-sm"
                    onClick={() => {
                      setLogModal({ profileId: p.id });
                      setSelectedGrams(null);
                      setCustomGrams("");
                    }}
                    disabled={!canSmokeToday}
                    title={!canSmokeToday ? "Rest day — no more days allowed this week" : `Log session for ${p.name}`}
                  >
                    <i className="fa-solid fa-plus" /> Log
                  </button>
                </div>
              );
            })}
          </div>

          {!canSmokeToday && (
            <div className="wt-rest-banner">
              <i className="fa-solid fa-moon" /> Rest day — you&apos;ve used all{" "}
              {daysAllowed} smoking days for this week.
            </div>
          )}
        </>
      )}

      {/* ── Recent sessions ───────────────────────── */}
      {recentLogs.length > 0 && (
        <div className="wt-history">
          <div className="section-label-sm">Recent Sessions</div>
          {recentLogs.map((l) => {
            const profile = PROFILES.find((p) => p.id === l.profile);
            return (
              <div
                key={l.id}
                className="wt-log-row"
                style={{ "--pc": profile?.color }}
              >
                <div className="wt-log-avatar">{profile?.initial}</div>
                <div className="wt-log-info">
                  <span className="wt-log-name">{profile?.name}</span>
                  <span className="wt-log-date">
                    {l.date === today ? "Today" : l.date}
                  </span>
                </div>
                <div className="wt-log-grams">{l.grams}g</div>
                <button
                  className="icon-x sm"
                  onClick={() => deleteLog(l.id)}
                  aria-label="Remove"
                >
                  <i className="fa-solid fa-xmark" />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Log session modal ─────────────────────── */}
      {logModal && (
        <>
          <div
            className="admin-pop-backdrop"
            onClick={() => setLogModal(null)}
          />
          <div className="wt-log-modal">
            <div className="wt-modal-header">
              <div className="wt-modal-title">
                Log Session —{" "}
                {PROFILES.find((p) => p.id === logModal.profileId)?.name}
              </div>
              <button
                className="icon-x"
                onClick={() => setLogModal(null)}
                aria-label="Close"
              >
                <i className="fa-solid fa-xmark" />
              </button>
            </div>
            <div className="wt-modal-body">
              <div className="wt-gram-grid">
                {GRAM_PRESETS.map((g) => (
                  <button
                    key={g}
                    className={`wt-gram-btn${selectedGrams === g ? " active" : ""}`}
                    onClick={() => {
                      setSelectedGrams(g);
                      setCustomGrams("");
                    }}
                  >
                    {g}g
                  </button>
                ))}
              </div>
              <input
                type="number"
                step="0.01"
                min="0.01"
                max="5"
                className="field"
                placeholder="Custom amount (g)..."
                value={customGrams}
                onChange={(e) => {
                  setCustomGrams(e.target.value);
                  setSelectedGrams(null);
                }}
              />
              <button
                className="btn"
                style={{ width: "100%" }}
                onClick={doLog}
                disabled={selectedGrams === null && !customGrams}
              >
                <i className="fa-solid fa-leaf" /> Log{" "}
                {selectedGrams ?? (customGrams || "?")}g for{" "}
                {PROFILES.find((p) => p.id === logModal.profileId)?.name}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
