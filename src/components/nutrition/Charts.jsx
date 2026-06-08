// Lightweight, dependency-free SVG charts for the nutrition module.

/** Weight line chart. data: [{date, value}] ascending. goal optional (same unit). */
export function LineChart({ data, goal, unit = "kg", color = "#6366f1", height = 200 }) {
  if (!data || data.length === 0) {
    return <div className="chart-empty">No data yet.</div>;
  }
  const W = 600, H = height, padX = 38, padY = 18;
  const values = data.map((d) => d.value);
  let min = Math.min(...values, goal ?? Infinity);
  let max = Math.max(...values, goal ?? -Infinity);
  if (min === max) { min -= 1; max += 1; }
  const range = max - min || 1;
  const x = (i) => padX + (i / Math.max(1, data.length - 1)) * (W - padX - padY);
  const y = (v) => padY + (1 - (v - min) / range) * (H - padY * 2);

  const points = data.map((d, i) => `${x(i)},${y(d.value)}`).join(" ");
  const areaPath = `M ${x(0)},${y(data[0].value)} ` +
    data.map((d, i) => `L ${x(i)},${y(d.value)}`).join(" ") +
    ` L ${x(data.length - 1)},${H - padY} L ${x(0)},${H - padY} Z`;

  const ticks = [max, (max + min) / 2, min];

  return (
    <svg className="nut-chart" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" role="img">
      {ticks.map((t, i) => (
        <g key={i}>
          <line x1={padX} x2={W - padY} y1={y(t)} y2={y(t)} className="nut-grid" />
          <text x={4} y={y(t) + 4} className="nut-axis">{t.toFixed(0)}</text>
        </g>
      ))}
      {goal != null && (
        <line x1={padX} x2={W - padY} y1={y(goal)} y2={y(goal)} className="nut-goal-line" />
      )}
      <defs>
        <linearGradient id="lcfill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.28" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={areaPath} fill="url(#lcfill)" />
      <polyline points={points} fill="none" stroke={color} strokeWidth="2.5"
        strokeLinejoin="round" strokeLinecap="round" />
      {data.map((d, i) => (
        <circle key={i} cx={x(i)} cy={y(d.value)} r={data.length > 40 ? 0 : 3} fill={color} />
      ))}
      <text x={W - padY} y={y(data[data.length - 1].value) - 8} textAnchor="end" className="nut-axis-strong">
        {data[data.length - 1].value.toFixed(1)} {unit}
      </text>
    </svg>
  );
}

/** Calorie bar chart. data: [{label, value}]. target optional. */
export function CalorieBars({ data, target, height = 200 }) {
  if (!data || data.length === 0) return <div className="chart-empty">No data yet.</div>;
  const W = 600, H = height, padX = 38, padBottom = 22, padTop = 12;
  const max = Math.max(...data.map((d) => d.value), target ?? 0) * 1.1 || 1;
  const y = (v) => padTop + (1 - v / max) * (H - padTop - padBottom);
  const slot = (W - padX) / data.length;
  const bw = Math.min(34, slot * 0.6);

  return (
    <svg className="nut-chart" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" role="img">
      {[max, max / 2, 0].map((t, i) => (
        <g key={i}>
          <line x1={padX} x2={W} y1={y(t)} y2={y(t)} className="nut-grid" />
          <text x={4} y={y(t) + 4} className="nut-axis">{Math.round(t)}</text>
        </g>
      ))}
      {target != null && (
        <line x1={padX} x2={W} y1={y(target)} y2={y(target)} className="nut-goal-line" />
      )}
      {data.map((d, i) => {
        const cx = padX + slot * i + slot / 2;
        const over = target != null && d.value > target;
        return (
          <g key={i}>
            <rect
              x={cx - bw / 2}
              y={y(d.value)}
              width={bw}
              height={Math.max(0, H - padBottom - y(d.value))}
              rx="4"
              className={over ? "nut-bar over" : "nut-bar"}
            />
            <text x={cx} y={H - 7} textAnchor="middle" className="nut-axis">{d.label}</text>
          </g>
        );
      })}
    </svg>
  );
}

/** Macro donut. protein/carbs/fat in grams. */
export function MacroRing({ protein = 0, carbs = 0, fat = 0, size = 132 }) {
  const pCal = protein * 4, cCal = carbs * 4, fCal = fat * 9;
  const total = pCal + cCal + fCal;
  const r = size / 2 - 12;
  const c = 2 * Math.PI * r;
  const segs = total > 0
    ? [
        { key: "protein", color: "#22c55e", frac: pCal / total },
        { key: "carbs", color: "#38bdf8", frac: cCal / total },
        { key: "fat", color: "#f59e0b", frac: fCal / total },
      ]
    : [];
  let offset = 0;
  return (
    <div className="macro-ring-wrap">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="macro-ring">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--border,#333)" strokeWidth="12" />
        {segs.map((s) => {
          const dash = s.frac * c;
          const el = (
            <circle
              key={s.key}
              cx={size / 2}
              cy={size / 2}
              r={r}
              fill="none"
              stroke={s.color}
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
        <text x="50%" y="46%" textAnchor="middle" className="macro-ring-cal">{Math.round(total / 1)}</text>
        <text x="50%" y="62%" textAnchor="middle" className="macro-ring-lbl">kcal</text>
      </svg>
      <div className="macro-legend">
        <span><i className="dot" style={{ background: "#22c55e" }} /> P {Math.round(protein)}g</span>
        <span><i className="dot" style={{ background: "#38bdf8" }} /> C {Math.round(carbs)}g</span>
        <span><i className="dot" style={{ background: "#f59e0b" }} /> F {Math.round(fat)}g</span>
      </div>
    </div>
  );
}
