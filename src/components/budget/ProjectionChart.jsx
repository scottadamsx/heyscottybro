import { useMemo } from "react";

const PHASE_COLOR = {
  pre: "var(--bud-gold)",
  phase1: "var(--bud-green)",
  phase2: "var(--bud-blue)",
};

const PHASE_LABEL = {
  pre: "Pre-job",
  phase1: "Contract",
  phase2: "Salary",
};

export default function ProjectionChart({ projection, selectedKey, onSelect }) {
  const { min, max } = useMemo(() => {
    const vals = projection.flatMap(m => [m.openingBalance, m.closingBalance]);
    return { min: Math.min(0, ...vals), max: Math.max(...vals) };
  }, [projection]);

  const range = max - min || 1;
  const zeroY = (max / range) * 100;

  return (
    <div className="bud-chart">
      <div className="bud-chart-legend">
        <span><i className="bud-swatch" style={{ background: PHASE_COLOR.pre }} /> Pre-job</span>
        <span><i className="bud-swatch" style={{ background: PHASE_COLOR.phase1 }} /> Contract</span>
        <span><i className="bud-swatch" style={{ background: PHASE_COLOR.phase2 }} /> Salary</span>
        <span className="bud-legend-muted">· click a bar to expand</span>
      </div>
      <div className="bud-chart-bars">
        {projection.map(m => {
          const closing = m.closingBalance;
          const barHeight = Math.abs(closing) / range * 100;
          const negative = closing < 0;
          const fillColor = negative ? "var(--bud-red)" : PHASE_COLOR[m.phase];
          // For current month: actuals solid, projected portion translucent/hatched
          const actualPortion = m.isCurrent && (m.actualIncome + Math.abs(m.actualExpenses)) > 0
            ? Math.max(0, (m.openingBalance + m.actualIncome + m.actualExpenses) - (negative ? closing : 0)) / range * 100
            : 0;
          return (
            <button
              key={m.key}
              type="button"
              className={`bud-chart-bar ${selectedKey === m.key ? "selected" : ""} ${m.isPast ? "past" : m.isCurrent ? "current" : "future"}`}
              onClick={() => onSelect?.(m.key)}
              aria-label={`${m.label}: ${closing < 0 ? "-$" : "$"}${Math.abs(closing).toFixed(0)}`}
            >
              <span className="bud-chart-value">${Math.round(closing).toLocaleString()}</span>
              <span className="bud-chart-track">
                <span
                  className="bud-chart-fill"
                  style={{
                    height: `${barHeight}%`,
                    background: fillColor,
                    bottom: negative ? `${100 - zeroY - barHeight}%` : `${100 - zeroY}%`,
                    opacity: m.isPast ? 1 : m.isCurrent ? 1 : 0.5,
                    backgroundImage: m.isFuture
                      ? `repeating-linear-gradient(45deg, transparent 0 6px, rgba(255,255,255,0.08) 6px 7px), linear-gradient(${fillColor}, ${fillColor})`
                      : undefined,
                  }}
                />
              </span>
              <span className="bud-chart-label">{m.label.split(" ")[0]}</span>
              <span className="bud-chart-phase" style={{ color: PHASE_COLOR[m.phase] }}>{PHASE_LABEL[m.phase]}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
