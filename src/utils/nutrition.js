// src/utils/nutrition.js — unit conversion + calorie/macro math (no deps)

export const KG_PER_LB = 0.45359237;
export const toLb = (kg) => (kg == null ? null : kg / KG_PER_LB);
export const toKg = (lb) => (lb == null ? null : lb * KG_PER_LB);

export const todayStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

export const addDaysStr = (str, delta) => {
  const [y, m, d] = str.split("-").map(Number);
  const dt = new Date(y, m - 1, d + delta);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
};

export const prettyDate = (str) => {
  const [y, m, d] = str.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
};

/** Display a kg value in the user's preferred unit (pounds by default). */
export function formatWeight(kg, unit = "lb", digits = 1) {
  if (kg == null || Number.isNaN(kg)) return "—";
  const v = unit === "lb" ? toLb(kg) : kg;
  return `${v.toFixed(digits)} ${unit}`;
}

const ACTIVITY = { sedentary: 1.2, light: 1.375, moderate: 1.55, active: 1.725, very_active: 1.9 };

export function ageFromBirthYear(birthYear) {
  if (!birthYear) return null;
  return new Date().getFullYear() - Number(birthYear);
}

/** Mifflin-St Jeor BMR (kcal/day). Returns null if data is insufficient. */
export function bmr({ sex, weight_kg, height_cm, age }) {
  if (!weight_kg || !height_cm || !age || !sex) return null;
  const base = 10 * weight_kg + 6.25 * height_cm - 5 * age;
  if (sex === "male") return base + 5;
  if (sex === "female") return base - 161;
  return base - 78; // neutral midpoint
}

/** Total daily energy expenditure estimate. */
export function tdee(profile, latestWeightKg) {
  const weight = latestWeightKg ?? profile.start_weight_kg;
  const b = bmr({
    sex: profile.sex,
    weight_kg: weight,
    height_cm: profile.height_cm,
    age: ageFromBirthYear(profile.birth_year),
  });
  if (b == null) return null;
  return Math.round(b * (ACTIVITY[profile.activity_level] || 1.55));
}

/** Suggested daily calorie target based on goal, if no explicit target set. */
export function suggestedTarget(profile, latestWeightKg) {
  if (profile.target_calories) return profile.target_calories;
  const t = tdee(profile, latestWeightKg);
  if (t == null) return null;
  if (profile.goal === "lose") return t - 500;
  if (profile.goal === "gain") return t + 300;
  return t;
}

/** Sum calories + macros across food log rows (respecting quantity). */
export function sumMacros(logs) {
  return logs.reduce(
    (acc, l) => {
      const q = Number(l.quantity) || 1;
      acc.calories += (Number(l.calories) || 0) * q;
      acc.protein_g += (Number(l.protein_g) || 0) * q;
      acc.carbs_g += (Number(l.carbs_g) || 0) * q;
      acc.fat_g += (Number(l.fat_g) || 0) * q;
      return acc;
    },
    { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0 }
  );
}

export const round = (n) => Math.round(Number(n) || 0);

/** Linear-regression slope (kg/day) over weigh-ins; null if <2 points. */
export function weightTrendPerWeek(weights) {
  if (!weights || weights.length < 2) return null;
  const base = new Date(weights[0].date).getTime();
  const xs = weights.map((w) => (new Date(w.date).getTime() - base) / 86400000);
  const ys = weights.map((w) => Number(w.weight_kg));
  const n = xs.length;
  const sx = xs.reduce((a, b) => a + b, 0);
  const sy = ys.reduce((a, b) => a + b, 0);
  const sxx = xs.reduce((a, b) => a + b * b, 0);
  const sxy = xs.reduce((a, b, i) => a + b * ys[i], 0);
  const denom = n * sxx - sx * sx;
  if (denom === 0) return null;
  const slope = (n * sxy - sx * sy) / denom; // kg/day
  return slope * 7; // kg/week
}

export const MEAL_TYPES = [
  { key: "breakfast", label: "Breakfast", icon: "fa-mug-saucer" },
  { key: "lunch", label: "Lunch", icon: "fa-bowl-food" },
  { key: "dinner", label: "Dinner", icon: "fa-utensils" },
  { key: "snack", label: "Snack", icon: "fa-cookie-bite" },
];
