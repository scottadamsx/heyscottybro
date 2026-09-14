// Lightweight, dependency-free charts for the nutrition module.
// Marks are drawn in an SVG that stretches to the plot; every piece of text
// (axis labels, the latest value) is HTML so it stays a real 12px at any
// width instead of scaling with the viewBox.

const pct = (v) => `${Math.max(0, Math.min(100, v))}%`;

/** Weight line chart. data: [{date, value}] ascending. goal optional (same unit). */
export function LineChart({ data, goal, unit = "kg", color = "var(--accent)", height = 200 }) {
  if (!data || data.length === 0) {
    return <div className="chart-empty">No data yet.</div>;
  }
  const W = 600, H = height, padY = 18;
  const values = data.map((d) => d.value);
  let min = Math.min(...values, goal ?? Infinity);
  let max = Math.max(...values, goal ?? -Infinity);
  if (min === max) { min -= 1; max += 1; }
  const range = max - min || 1;
  const x = (i) => (data.length === 1 ? W / 2 : (i / (data.length - 1)) * W);
  const y = (v) => padY + (1 - (v - min) / range) * (H - padY * 2);
  const xp = (i) => (x(i) / W) * 100;
  const yp = (v) => (y(v) / H) * 100;

  const points = data.map((d, i) => `${x(i)},${y(d.value)}`).join(" ");
  const areaPath = `M ${x(0)},${y(data[0].value)} ` +
    data.map((d, i) => `L ${x(i)},${y(d.value)}`).join(" ") +
    ` L ${x(data.length - 1)},${H} L ${x(0)},${H} Z`;

  const ticks = [max, (max + min) / 2, min];
  const last = data[data.length - 1];

  return (
    // --chart-h / --series are the only dynamic values: the height prop and the profile's own colour.
    <div className="nut-chart" style={{ "--chart-h": `${H}px`, "--series": color }}>
      <div className="nut-chart-y" aria-hidden="true">
        {ticks.map((t, i) => <span key={i} style={{ top: pct(yp(t)) }}>{t.toFixed(0)}</span>)}
      </div>
      <div className="nut-chart-plot" role="img" aria-label={`Weight over time, latest ${last.value.toFixed(1)} ${unit}${goal != null ? `, goal ${goal.toFixed(1)} ${unit}` : ""}`}>
        {ticks.map((t, i) => <span key={i} className="nut-grid" style={{ top: pct(yp(t)) }} />)}
        {goal != null && <span className="nut-goal-line" style={{ top: pct(yp(goal)) }} />}
        <svg className="nut-chart-svg" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-hidden="true">
          <path d={areaPath} className="nut-area" />
          <polyline points={points} className="nut-line" vectorEffect="non-scaling-stroke" />
        </svg>
        {data.length <= 40 && data.map((d, i) => (
          <span key={i} className="nut-point" style={{ left: pct(xp(i)), top: pct(yp(d.value)) }} />
        ))}
        <span className="nut-chart-last" style={{ top: pct(yp(last.value)) }}>
          {last.value.toFixed(1)} {unit}
        </span>
      </div>
    </div>
  );
}

/** Calorie bar chart. data: [{label, value}]. target optional. */
export function CalorieBars({ data, target, height = 200 }) {
  if (!data || data.length === 0) return <div className="chart-empty">No data yet.</div>;
  const max = Math.max(...data.map((d) => d.value), target ?? 0) * 1.1 || 1;
  const yp = (v) => (1 - v / max) * 100;

  return (
    <div className="nut-chart has-x" style={{ "--chart-h": `${height}px` }}>
      <div className="nut-chart-y" aria-hidden="true">
        {[max, max / 2, 0].map((t, i) => <span key={i} style={{ top: pct(yp(t)) }}>{Math.round(t)}</span>)}
      </div>
      <div className="nut-chart-plot" role="img" aria-label={`Calories by day${target != null ? `, target ${target}` : ""}`}>
        {[max, max / 2, 0].map((t, i) => <span key={i} className="nut-grid" style={{ top: pct(yp(t)) }} />)}
        {target != null && <span className="nut-goal-line" style={{ top: pct(yp(target)) }} />}
        <div className="nut-bars">
          {data.map((d, i) => {
            const over = target != null && d.value > target;
            return (
              <div key={i} className="nut-bar-col" title={`${d.label}: ${Math.round(d.value)} kcal`}>
                <span className={over ? "nut-bar over" : "nut-bar"} style={{ height: pct(100 - yp(d.value)) }} />
              </div>
            );
          })}
        </div>
      </div>
      <div className="nut-chart-x" aria-hidden="true">
        {data.map((d, i) => <span key={i}>{d.label}</span>)}
      </div>
    </div>
  );
}

/** Macro donut. protein/carbs/fat in grams. */
export function MacroRing({ protein = 0, carbs = 0, fat = 0, size = 152 }) {
  const pCal = protein * 4, cCal = carbs * 4, fCal = fat * 9;
  const total = pCal + cCal + fCal;
  const r = size / 2 - 12;
  const c = 2 * Math.PI * r;
  const segs = total > 0
    ? [
        { key: "protein", frac: pCal / total },
        { key: "carbs", frac: cCal / total },
        { key: "fat", frac: fCal / total },
      ]
    : [];
  let offset = 0;
  return (
    <div className="macro-ring-wrap">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="macro-ring" role="img"
        aria-label={`Macros: protein ${Math.round(protein)} grams, carbs ${Math.round(carbs)} grams, fat ${Math.round(fat)} grams`}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" className="macro-track" strokeWidth="12" />
        {segs.map((s) => {
          const dash = s.frac * c;
          const el = (
            <circle
              key={s.key}
              cx={size / 2}
              cy={size / 2}
              r={r}
              fill="none"
              className={`macro-seg is-${s.key}`}
              strokeWidth="12"
              strokeDasharray={`${dash} ${c - dash}`}
              strokeDashoffset={-offset}
              transform={`rotate(-90 ${size / 2} ${size / 2})`}
              strokeLinecap="butt"
            />
          );
          offset += dash;
          return el;
        })}
        {/* 4/4/9 kcal per gram of P/C/F — this is what the macros ADD UP to,
            which legitimately differs from the logged kcal shown beside it
            (fibre, alcohol, rounding, entries logged without macros). */}
        <text x="50%" y="47%" textAnchor="middle" className="macro-ring-cal">{Math.round(total / 1)}</text>
        <text x="50%" y="61%" textAnchor="middle" className="macro-ring-lbl">kcal from macros</text>
      </svg>
      <div className="macro-legend">
        <span><i className="nut-dot is-protein" aria-hidden="true" /> P {Math.round(protein)}g</span>
        <span><i className="nut-dot is-carbs" aria-hidden="true" /> C {Math.round(carbs)}g</span>
        <span><i className="nut-dot is-fat" aria-hidden="true" /> F {Math.round(fat)}g</span>
      </div>
    </div>
  );
}
