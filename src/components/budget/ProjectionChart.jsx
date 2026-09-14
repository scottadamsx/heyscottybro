import { useMemo } from "react";
import "./budget.css";

// Phase colours live in budget.css as .phase-* (chart tokens); a negative
// closing balance is .is-neg (red) whatever the phase.

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
        <span><i className="bud-swatch phase-pre" aria-hidden="true" /> Pre-job</span>
        <span><i className="bud-swatch phase-phase1" aria-hidden="true" /> Contract</span>
        <span><i className="bud-swatch phase-phase2" aria-hidden="true" /> Salary</span>
        <span className="bud-legend-muted">· click a bar to expand</span>
      </div>
      <div className="bud-chart-bars">
        {projection.map(m => {
          const closing = m.closingBalance;
          const barHeight = Math.abs(closing) / range * 100;
          const negative = closing < 0;
          // Future months render translucent (.future); past + current solid.
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
                  className={`bud-chart-fill phase-${m.phase}${negative ? " is-neg" : ""}`}
                  style={{
                    height: `${barHeight}%`,
                    bottom: negative ? `${100 - zeroY - barHeight}%` : `${100 - zeroY}%`,
                  }}
                />
              </span>
              <span className="bud-chart-label">{m.label.split(" ")[0]}</span>
              <span className="bud-chart-phase">{PHASE_LABEL[m.phase]}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
