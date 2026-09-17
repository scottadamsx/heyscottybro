// src/utils/plates.js — barbell maths for the Health space (DR-018). Pure and tested.
// Weights are always stored as the TOTAL on the bar (so history, estimated maxes and
// progress compare like for like); for a barbell exercise the app shows what that means
// in practice: the bar plus what goes on each side.

export const DEFAULT_BAR_LB = 45;
/** Plates a normal gym has, heaviest first (lb). */
export const PLATES_LB = [45, 35, 25, 10, 5, 2.5];

const round2 = (n) => Math.round(n * 100) / 100;

/** What goes on each side, or null when the total doesn't even make the bar. */
export function perSide(totalLb, barLb = DEFAULT_BAR_LB) {
  const side = (Number(totalLb) - Number(barLb)) / 2;
  return side >= 0 ? round2(side) : null;
}

/** Total on the bar for a given per-side load. */
export const totalFor = (sideLb, barLb = DEFAULT_BAR_LB) => round2(Number(barLb) + 2 * Number(sideLb));

/**
 * Nearest loadable total at or below `totalLb` (plates come in pairs, smallest 2.5 lb,
 * so totals move in 5 lb steps from the bar). Never goes below the bar itself.
 */
export function loadableTotal(totalLb, barLb = DEFAULT_BAR_LB) {
  const bar = Number(barLb);
  if (!(Number(totalLb) > bar)) return bar;
  return round2(bar + Math.round((Number(totalLb) - bar) / 5) * 5);
}

/** Plates for one side, heaviest first: 47.5 → [45, 2.5]. Leftover (no plate fits) is ignored. */
export function platesForSide(sideLb) {
  let left = round2(sideLb);
  const out = [];
  for (const p of PLATES_LB) {
    while (left >= p - 0.001) {
      out.push(p);
      left = round2(left - p);
    }
  }
  return out;
}

/** "45s, 10, 2.5" — the plates for one side, grouped. */
export function platesText(sideLb) {
  const list = platesForSide(sideLb);
  if (!list.length) return "";
  const counts = [];
  for (const p of list) {
    const last = counts[counts.length - 1];
    if (last && last.plate === p) last.n += 1;
    else counts.push({ plate: p, n: 1 });
  }
  return counts.map(({ plate, n }) => (n > 1 ? `${n}×${plate}` : `${plate}`)).join(" + ");
}

/**
 * How to load a barbell for a total: "45 lb bar + 47.5 a side (45 + 2.5)".
 * Returns null unless this is a barbell exercise with a workable weight.
 */
export function loadHint(totalLb, { barbell, barLb = DEFAULT_BAR_LB } = {}) {
  if (!barbell || !(Number(totalLb) > 0)) return null;
  const side = perSide(totalLb, barLb);
  if (side === null) return `Less than the ${barLb} lb bar on its own`;
  if (side === 0) return `Just the ${barLb} lb bar`;
  const plates = platesText(side);
  return `${barLb} lb bar + ${side} a side${plates ? ` (${plates})` : ""}`;
}
