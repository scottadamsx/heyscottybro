// ── Connected Pages: recipe ingredient structure (connected-pages.md §2.2) ──
//
// Version 2 ingredient line:
//   { name, normalized_name, quantity_milliunits, unit_kind, display_quantity,
//     preparation, optional, costable, parse_status }
// Quantities are integer milliunits of the base unit (grams, millilitres, or
// each). Only unit math is converted (kg→g, cups→ml, …). A volume-to-mass
// conversion needs a density this module does not guess: such lines are
// needs_review and are never silently priced.

export const UNIT_KINDS = ["mass", "volume", "count"];

const MASS = { g: 1, gram: 1, grams: 1, kg: 1000, kilogram: 1000, kilograms: 1000, oz: 28.3495, ounce: 28.3495, ounces: 28.3495, lb: 453.592, lbs: 453.592, pound: 453.592, pounds: 453.592 };
const VOLUME = { ml: 1, millilitre: 1, millilitres: 1, milliliter: 1, milliliters: 1, l: 1000, litre: 1000, litres: 1000, liter: 1000, liters: 1000, tsp: 5, teaspoon: 5, teaspoons: 5, tbsp: 15, tablespoon: 15, tablespoons: 15, cup: 250, cups: 250, floz: 29.5735 };
const COUNT = { "": 1, each: 1, ea: 1, pc: 1, piece: 1, pieces: 1, whole: 1, can: 1, cans: 1, clove: 1, cloves: 1 };

export function normalizeIngredientName(name) {
  return String(name || "")
    .toLowerCase()
    .replace(/[’']/g, "")
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function parseAmount(text) {
  const t = String(text || "").trim();
  const frac = t.match(/^(\d+)\s*\/\s*(\d+)$/);
  if (frac) return Number(frac[1]) / Number(frac[2]);
  const mixed = t.match(/^(\d+)\s+(\d+)\s*\/\s*(\d+)$/);
  if (mixed) return Number(mixed[1]) + Number(mixed[2]) / Number(mixed[3]);
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

/**
 * Propose a version 2 line from a legacy { item, quantity } pair. Ambiguous
 * quantities come back parse_status "needs_review" with no quantity — visible
 * for review, never priced by guesswork.
 */
export function parseLegacyIngredient(legacy) {
  const name = String(legacy?.item || legacy?.name || "").trim();
  const display = String(legacy?.quantity ?? "").trim();
  const base = {
    name,
    normalized_name: normalizeIngredientName(name),
    quantity_milliunits: null,
    unit_kind: null,
    display_quantity: display,
    preparation: "",
    optional: false,
    costable: false,
    parse_status: "needs_review",
  };
  if (!name) return base;
  if (!display) return base; // no quantity at all: review decides
  if (/\d\s*[-–]\s*\d/.test(display)) return base; // a range is a judgement call
  const m = display.match(/^([\d\s/.]+)\s*([a-zA-Z]*)\s*(.*)$/);
  if (!m) return base;
  const amount = parseAmount(m[1]);
  if (amount == null || amount <= 0) return base;
  const unit = (m[2] || "").toLowerCase();
  const rest = (m[3] || "").trim();
  let kind = null;
  let factor = null;
  if (unit in MASS) { kind = "mass"; factor = MASS[unit]; }
  else if (unit in VOLUME) { kind = "volume"; factor = VOLUME[unit]; }
  else if (unit in COUNT) { kind = "count"; factor = COUNT[unit]; }
  if (!kind) return base;
  return {
    ...base,
    quantity_milliunits: Math.round(amount * factor * 1000),
    unit_kind: kind,
    preparation: rest,
    costable: true,
    parse_status: "ready",
  };
}

/** Map a legacy ingredients array to version 2 lines. */
export function structuredFromLegacy(ingredients) {
  return (Array.isArray(ingredients) ? ingredients : []).map(parseLegacyIngredient);
}

/** Validate + normalise a version 2 line for saving. Throws on nonsense. */
export function cleanIngredientLine(line) {
  const name = String(line?.name || "").trim();
  if (!name) throw new Error("An ingredient line needs a name.");
  const kind = line.unit_kind;
  if (!UNIT_KINDS.includes(kind)) throw new Error(`"${name}": unit kind must be mass, volume, or count.`);
  const ready = line.parse_status !== "needs_review";
  const qty = line.quantity_milliunits == null ? null : Math.round(Number(line.quantity_milliunits));
  if (ready && !(qty > 0)) throw new Error(`"${name}": a ready line needs a positive quantity.`);
  return {
    name,
    normalized_name: normalizeIngredientName(line.normalized_name || name),
    quantity_milliunits: ready ? qty : null,
    unit_kind: kind,
    display_quantity: String(line.display_quantity || ""),
    preparation: String(line.preparation || ""),
    optional: !!line.optional,
    costable: ready ? line.costable !== false : false,
    parse_status: ready ? "ready" : "needs_review",
  };
}

/** A recipe's effective version 2 lines, converting legacy JSON on the fly. */
export function recipeLines(recipe) {
  if (!recipe) return [];
  if ((recipe.ingredients_schema_version || 1) >= 2) {
    return Array.isArray(recipe.ingredients) ? recipe.ingredients : [];
  }
  return structuredFromLegacy(recipe.ingredients);
}
