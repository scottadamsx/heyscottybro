import { useState } from "react";
import { FormModal, Field } from "../ui";
import DatePicker from "../DatePicker";
import { MEALS } from "../../api/healthApi";
import { estimateFood } from "../../api/aiHealth";
import { toDateStr } from "../../utils/dates";

const MEAL_LABEL = { breakfast: "Breakfast", lunch: "Lunch", dinner: "Dinner", snack: "Snack" };
const num = (v) => (v === "" || v == null ? "" : String(v));

/** Pick a meal type from the clock (what most people are logging right now). */
export function mealForNow(d = new Date()) {
  const h = d.getHours();
  if (h < 11) return "breakfast";
  if (h < 15) return "lunch";
  if (h >= 17 && h < 21) return "dinner";
  return "snack";
}

/**
 * Log or edit food. Describe it and let AI estimate, or type the numbers.
 * initial: an existing food_logs row (edit) or undefined (new).
 */
export function FoodModal({ initial, defaultDate, onClose, onSave }) {
  const [f, setF] = useState(() => ({
    date: initial?.date || defaultDate || toDateStr(),
    meal_type: initial?.meal_type || mealForNow(),
    name: initial?.name || "",
    description: initial?.description || "",
    calories: num(initial?.calories),
    protein_g: num(initial?.protein_g),
    carbs_g: num(initial?.carbs_g),
    fat_g: num(initial?.fat_g),
    source: initial?.source || "manual",
    items: initial?.items || [],
  }));
  const [describe, setDescribe] = useState("");
  const [estimating, setEstimating] = useState(false);
  const [estimateError, setEstimateError] = useState(null);
  const [checked, setChecked] = useState(null); // { assumptions, source, url, searches }
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));

  const estimate = async () => {
    setEstimating(true);
    setEstimateError(null);
    try {
      const out = await estimateFood(describe, { mealType: f.meal_type });
      setF((x) => ({
        ...x,
        name: out.name || x.name,
        description: [describe.trim(), out.source ? `Source: ${out.source}` : ""].filter(Boolean).join(" · "),
        meal_type: out.meal_type && MEALS.includes(out.meal_type) ? out.meal_type : x.meal_type,
        calories: String(out.calories), protein_g: String(out.protein_g), carbs_g: String(out.carbs_g), fat_g: String(out.fat_g),
        items: out.items || [], source: "ai",
      }));
      setChecked({ assumptions: out.assumptions || "", source: out.source || "", url: out.source_url || "", searches: out.searches || [] });
    } catch (err) {
      setEstimateError(err.message);
    } finally {
      setEstimating(false);
    }
  };

  return (
    <FormModal
      title={initial ? "Edit food" : "Log food"}
      submitLabel={initial ? "Save" : "Log it"}
      submitDisabled={estimating || !f.name.trim() || f.calories === ""}
      onClose={onClose}
      onSubmit={() => onSave({ ...f, calories: Number(f.calories), protein_g: Number(f.protein_g || 0), carbs_g: Number(f.carbs_g || 0), fat_g: Number(f.fat_g || 0) })}
    >
      {!initial && (
        <div className="health-estimate">
          <Field label="What did you eat?" hint="Describe it and let AI fill in the numbers — you can adjust them before saving.">
            <textarea rows={2} value={describe} onChange={(e) => setDescribe(e.target.value)} placeholder="e.g. two slices of pepperoni pizza and a Coke" data-autofocus />
          </Field>
          <button type="button" className="btn btn-secondary" onClick={estimate} disabled={estimating || !describe.trim()}>
            <i className="fa-solid fa-wand-magic-sparkles" aria-hidden="true" /> {estimating ? "Estimating…" : "Estimate with AI"}
          </button>
          {estimateError && <p className="form-error" role="alert">{estimateError}</p>}
          {checked && (
            <div className="health-checked">
              {checked.source && (
                <p className="field-hint">
                  <i className="fa-solid fa-magnifying-glass" aria-hidden="true" /> Checked against {checked.url ? <a href={checked.url} target="_blank" rel="noreferrer">{checked.source}</a> : checked.source}
                </p>
              )}
              {checked.assumptions && <p className="field-hint">Assumed: {checked.assumptions}</p>}
              {checked.searches.length > 0 && <p className="field-hint">Searched: {checked.searches.join("; ")}</p>}
            </div>
          )}
        </div>
      )}
      <div className="form-row">
        <Field label="Meal">
          <select value={f.meal_type} onChange={set("meal_type")}>
            {MEALS.map((m) => <option key={m} value={m}>{MEAL_LABEL[m]}</option>)}
          </select>
        </Field>
        <Field label="Date">
          <DatePicker value={f.date} onChange={(v) => setF((x) => ({ ...x, date: v || toDateStr() }))} />
        </Field>
      </div>
      <Field label="Name">
        <input value={f.name} onChange={set("name")} placeholder="Pizza and a Coke" required />
      </Field>
      <div className="health-macros">
        <Field label="Calories"><input type="number" inputMode="numeric" min="0" value={f.calories} onChange={set("calories")} required /></Field>
        <Field label="Protein (g)"><input type="number" inputMode="numeric" min="0" value={f.protein_g} onChange={set("protein_g")} /></Field>
        <Field label="Carbs (g)"><input type="number" inputMode="numeric" min="0" value={f.carbs_g} onChange={set("carbs_g")} /></Field>
        <Field label="Fat (g)"><input type="number" inputMode="numeric" min="0" value={f.fat_g} onChange={set("fat_g")} /></Field>
      </div>
    </FormModal>
  );
}

export function WeightModal({ latestLb, onClose, onSave }) {
  const [date, setDate] = useState(toDateStr());
  const [weight, setWeight] = useState(latestLb ? String(latestLb) : "");
  const [note, setNote] = useState("");
  return (
    <FormModal title="Log weight" submitLabel="Save" onClose={onClose} submitDisabled={!(Number(weight) > 0)}
      onSubmit={() => onSave({ date, weightLb: Number(weight), note })}>
      <div className="form-row">
        <Field label="Weight (lb)">
          <input type="number" inputMode="decimal" step="0.1" min="0" value={weight} onChange={(e) => setWeight(e.target.value)} data-autofocus required />
        </Field>
        <Field label="Date" hint="One weigh-in per day; saving again replaces it.">
          <DatePicker value={date} onChange={(v) => setDate(v || toDateStr())} />
        </Field>
      </div>
      <Field label="Note (optional)">
        <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Morning, after the gym…" />
      </Field>
    </FormModal>
  );
}

export function TargetsModal({ profile, onClose, onSave }) {
  const [calories, setCalories] = useState(num(profile?.targetCalories));
  const [goal, setGoal] = useState(profile?.goal || "maintain");
  const [goalWeight, setGoalWeight] = useState(num(profile?.goalWeightLb));
  return (
    <FormModal title="Goals" submitLabel="Save" onClose={onClose}
      onSubmit={() => onSave({ targetCalories: Number(calories) || null, goal, goalWeightLb: Number(goalWeight) || null })}>
      <Field label="Goal">
        <select value={goal} onChange={(e) => setGoal(e.target.value)}>
          <option value="lose">Lose fat</option>
          <option value="maintain">Maintain</option>
          <option value="gain">Build muscle</option>
        </select>
      </Field>
      <div className="form-row">
        <Field label="Daily calories"><input type="number" inputMode="numeric" min="0" value={calories} onChange={(e) => setCalories(e.target.value)} /></Field>
        <Field label="Goal weight (lb)"><input type="number" inputMode="decimal" step="0.1" min="0" value={goalWeight} onChange={(e) => setGoalWeight(e.target.value)} /></Field>
      </div>
    </FormModal>
  );
}
