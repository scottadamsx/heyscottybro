import { useId, useState } from "react";

/**
 * LineChart — one smooth series, the reference's "Activity" chart.
 * Pure SVG + HTML overlay (no chart library). The curve uses monotone cubic
 * interpolation so it never overshoots below zero or above a peak. Each point
 * is a real, focusable button: hover or Tab to read its value.
 *
 * data:   [{ key, label, value, title? }]   label = x-axis text, title = tooltip heading
 * format: value → display string
 */
const W = 1000;

function niceMax(v) {
  if (!(v > 0)) return 1;
  const p = 10 ** Math.floor(Math.log10(v));
  return [1, 2, 2.5, 5, 10].map((m) => m * p).find((n) => n >= v);
}

// Fritsch–Carlson monotone cubic → SVG path through the points.
function monotonePath(pts) {
  if (pts.length === 0) return "";
  if (pts.length === 1) return `M${pts[0][0]},${pts[0][1]}`;
  const n = pts.length;
  const d = [];
  for (let i = 0; i < n - 1; i++) d.push((pts[i + 1][1] - pts[i][1]) / (pts[i + 1][0] - pts[i][0]));
  const m = [d[0]];
  for (let i = 1; i < n - 1; i++) m.push(d[i - 1] * d[i] > 0 ? (d[i - 1] + d[i]) / 2 : 0);
  m.push(d[n - 2]);
  for (let i = 0; i < n - 1; i++) {
    if (d[i] === 0) { m[i] = 0; m[i + 1] = 0; continue; }
    const a = m[i] / d[i], b = m[i + 1] / d[i], s = a * a + b * b;
    if (s > 9) { const t = 3 / Math.sqrt(s); m[i] = t * a * d[i]; m[i + 1] = t * b * d[i]; }
  }
  let path = `M${pts[0][0]},${pts[0][1]}`;
  for (let i = 0; i < n - 1; i++) {
    const h = (pts[i + 1][0] - pts[i][0]) / 3;
    path += ` C${pts[i][0] + h},${pts[i][1] + m[i] * h} ${pts[i + 1][0] - h},${pts[i + 1][1] - m[i + 1] * h} ${pts[i + 1][0]},${pts[i + 1][1]}`;
  }
  return path;
}

/** zeroBased=false fits the axis to the data (e.g. body weight) instead of starting at 0. */
export default function LineChart({ data, height = 192, format = String, ariaLabel, defaultIndex, zeroBased = true }) {
  const gradId = useId();
  const [active, setActive] = useState(null);
  if (!data?.length) return null;

  const hi = Math.max(...data.map((p) => p.value));
  const lo = Math.min(...data.map((p) => p.value));
  let min = 0;
  let max = niceMax(hi);
  if (!zeroBased) {
    const step = niceMax(Math.max((hi - lo) / 4, 1));
    min = Math.floor(lo / step) * step - (hi === lo ? step : 0);
    max = Math.ceil(hi / step) * step + (hi === lo ? step : 0);
    if (max === min) max = min + step;
  }
  const ticks = [1, 0.75, 0.5, 0.25, 0].map((f) => min + f * (max - min));
  const x = (i) => (data.length === 1 ? W / 2 : (i / (data.length - 1)) * W);
  const y = (v) => height - ((v - min) / (max - min)) * height;
  const pts = data.map((p, i) => [x(i), y(p.value)]);
  const line = monotonePath(pts);
  const area = `${line} L${W},${height} L0,${height} Z`;
  const shown = active ?? defaultIndex ?? data.length - 1;
  const pt = data[shown];
  const leftPct = (x(shown) / W) * 100;
  const topPx = y(pt.value);

  return (
    <div className="lc" role="group" aria-label={ariaLabel}>
      <div className="lc-y" aria-hidden="true">
        {ticks.map((t) => <span key={t} style={{ top: `${y(t)}px` }}>{format(t, true)}</span>)}
      </div>
      <div className="lc-plot" style={{ height: `${height}px` }}>
        <svg className="lc-svg" viewBox={`0 0 ${W} ${height}`} preserveAspectRatio="none" aria-hidden="true">
          <defs>
            <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--amber)" stopOpacity="0.18" />
              <stop offset="100%" stopColor="var(--amber)" stopOpacity="0" />
            </linearGradient>
          </defs>
          {ticks.map((t) => <line key={t} className="lc-grid" x1="0" x2={W} y1={y(t)} y2={y(t)} vectorEffect="non-scaling-stroke" />)}
          <path d={area} fill={`url(#${gradId})`} />
          <path d={line} className="lc-line" vectorEffect="non-scaling-stroke" />
        </svg>
        <span className="lc-dot" style={{ left: `${leftPct}%`, top: `${topPx}px` }} aria-hidden="true" />
        <div className={`lc-tip${leftPct > 75 ? " is-left" : leftPct < 25 ? " is-right" : ""}${topPx > height * 0.55 ? " is-above" : ""}`} style={{ left: `${leftPct}%`, top: `${topPx}px` }} aria-hidden="true">
          <strong>{format(pt.value)}</strong>
          <span>{pt.title || pt.label}</span>
        </div>
        <div className="lc-hits">
          {data.map((p, i) => (
            <button
              key={p.key ?? i}
              type="button"
              className="lc-hit"
              aria-label={`${p.title || p.label}: ${format(p.value)}`}
              onMouseEnter={() => setActive(i)}
              onFocus={() => setActive(i)}
              onMouseLeave={() => setActive(null)}
              onBlur={() => setActive(null)}
            />
          ))}
        </div>
      </div>
      <div className="lc-x" aria-hidden="true">
        {data.map((p, i) => <span key={p.key ?? i} className={i === shown ? "is-active" : ""} style={{ left: `${(x(i) / W) * 100}%` }}>{p.label}</span>)}
      </div>
    </div>
  );
}
