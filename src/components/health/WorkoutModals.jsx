import { useId, useState } from "react";
import { FormModal, Field } from "../ui";
import { buildWorkout } from "../../api/aiHealth";
import { cleanExercises } from "../../api/healthApi";
import { DEFAULT_TARGET } from "../../utils/overload";

const blankExercise = () => ({ name: "", sets: DEFAULT_TARGET.sets, repMin: DEFAULT_TARGET.repMin, repMax: DEFAULT_TARGET.repMax, restSec: DEFAULT_TARGET.restSec, note: "" });

/** A datalist of every exercise name you've used, so names stay consistent (history matches by name). */
export function ExerciseNames({ id, names }) {
  return (
    <datalist id={id}>
      {names.map((n) => <option key={n} value={n} />)}
    </datalist>
  );
}

/**
 * Create or edit a workout (manual), or review an AI draft before saving.
 * initial: { id?, name, notes, source, prompt, exercises }
 */
export function PlanEditorModal({ initial, knownNames = [], onClose, onSave }) {
  const listId = useId();
  const [name, setName] = useState(initial?.name || "");
  const [notes, setNotes] = useState(initial?.notes || "");
  const [rows, setRows] = useState(() => (initial?.exercises?.length ? initial.exercises.map((e) => ({ ...blankExercise(), ...e })) : [blankExercise()]));
  const update = (i, k, v) => setRows((r) => r.map((row, j) => (j === i ? { ...row, [k]: v } : row)));
  const move = (i, d) => setRows((r) => {
    const j = i + d;
    if (j < 0 || j >= r.length) return r;
    const next = [...r];
    [next[i], next[j]] = [next[j], next[i]];
    return next;
  });
  const title = initial?.id ? "Edit workout" : initial?.source === "ai" ? "Review AI workout" : "New workout";

  return (
    <FormModal
      title={title}
      width={720}
      submitLabel={initial?.id ? "Save" : "Save workout"}
      onClose={onClose}
      onSubmit={() => onSave({
        id: initial?.id,
        name,
        notes,
        source: initial?.source || "manual",
        prompt: initial?.prompt || null,
        exercises: cleanExercises(rows.filter((r) => String(r.name).trim())),
      })}
    >
      <ExerciseNames id={listId} names={knownNames} />
      {initial?.source === "ai" && initial?.prompt && <p className="field-hint">Built from: “{initial.prompt}”. Change anything before saving.</p>}
      <div className="form-row">
        <Field label="Name" className="field-grow"><input value={name} onChange={(e) => setName(e.target.value)} placeholder="Push day" required data-autofocus /></Field>
      </div>
      <Field label="Notes (optional)"><input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Warm up with 2 light sets" /></Field>
      <div className="plan-rows" role="list" aria-label="Exercises">
        {rows.map((r, i) => (
          <div className="plan-row" role="listitem" key={i}>
            <div className="plan-row-head">
              <span className="plan-row-num">{i + 1}</span>
              <input className="plan-row-name" list={listId} value={r.name} onChange={(e) => update(i, "name", e.target.value)} placeholder="Exercise (e.g. Bench Press)" aria-label={`Exercise ${i + 1} name`} />
              <div className="plan-row-tools">
                <button type="button" className="icon-btn" onClick={() => move(i, -1)} disabled={i === 0} aria-label={`Move exercise ${i + 1} up`}><i className="fa-solid fa-arrow-up" /></button>
                <button type="button" className="icon-btn" onClick={() => move(i, 1)} disabled={i === rows.length - 1} aria-label={`Move exercise ${i + 1} down`}><i className="fa-solid fa-arrow-down" /></button>
                <button type="button" className="icon-btn" onClick={() => setRows((x) => x.filter((_, j) => j !== i))} disabled={rows.length === 1} aria-label={`Remove exercise ${i + 1}`}><i className="fa-solid fa-trash" /></button>
              </div>
            </div>
            <div className="plan-row-nums">
              <Field label="Sets"><input type="number" min="1" max="20" inputMode="numeric" value={r.sets} onChange={(e) => update(i, "sets", e.target.value)} /></Field>
              <Field label="Reps from"><input type="number" min="1" max="100" inputMode="numeric" value={r.repMin} onChange={(e) => update(i, "repMin", e.target.value)} /></Field>
              <Field label="to"><input type="number" min="1" max="100" inputMode="numeric" value={r.repMax} onChange={(e) => update(i, "repMax", e.target.value)} /></Field>
              <Field label="Rest (s)"><input type="number" min="0" max="900" step="15" inputMode="numeric" value={r.restSec} onChange={(e) => update(i, "restSec", e.target.value)} /></Field>
            </div>
            {r.note ? <p className="field-hint">{r.note}</p> : null}
          </div>
        ))}
      </div>
      <button type="button" className="btn btn-secondary" onClick={() => setRows((x) => [...x, blankExercise()])}>
        <i className="fa-solid fa-plus" aria-hidden="true" /> Add exercise
      </button>
    </FormModal>
  );
}

/** Describe a workout; the AI drafts it; the draft opens in PlanEditorModal to review. */
export function BuildWithAIModal({ known, profile, onClose, onDraft }) {
  const [prompt, setPrompt] = useState("");
  return (
    <FormModal
      title="Build a workout with AI"
      submitLabel="Build it"
      submitDisabled={!prompt.trim()}
      onClose={onClose}
      onSubmit={async () => {
        const draft = await buildWorkout(prompt, { known, profile });
        onDraft({ ...draft, source: "ai", prompt: prompt.trim() });
        return false; // onDraft swaps this modal for the review modal
      }}
    >
      <Field label="What do you want to train?" hint="Include time, equipment and focus. Weights are set from your history when you start it.">
        <textarea rows={4} value={prompt} onChange={(e) => setPrompt(e.target.value)} data-autofocus
          placeholder="e.g. 45 minute push day for chest and shoulders, full gym, building size" />
      </Field>
    </FormModal>
  );
}

/** Add an exercise to a workout in progress. */
export function AddExerciseModal({ knownNames = [], onClose, onSave }) {
  const listId = useId();
  const [r, setR] = useState(blankExercise());
  const set = (k) => (e) => setR((x) => ({ ...x, [k]: e.target.value }));
  return (
    <FormModal title="Add exercise" submitLabel="Add" submitDisabled={!r.name.trim()} onClose={onClose}
      onSubmit={() => onSave(cleanExercises([r])[0])}>
      <ExerciseNames id={listId} names={knownNames} />
      <Field label="Exercise"><input list={listId} value={r.name} onChange={set("name")} placeholder="Bench Press" data-autofocus required /></Field>
      <div className="plan-row-nums">
        <Field label="Sets"><input type="number" min="1" max="20" inputMode="numeric" value={r.sets} onChange={set("sets")} /></Field>
        <Field label="Reps from"><input type="number" min="1" max="100" inputMode="numeric" value={r.repMin} onChange={set("repMin")} /></Field>
        <Field label="to"><input type="number" min="1" max="100" inputMode="numeric" value={r.repMax} onChange={set("repMax")} /></Field>
        <Field label="Rest (s)"><input type="number" min="0" max="900" step="15" inputMode="numeric" value={r.restSec} onChange={set("restSec")} /></Field>
      </div>
    </FormModal>
  );
}

function Stepper({ label, value, onChange, step, min = 0, suffix, inputMode = "decimal" }) {
  const n = Number(value) || 0;
  const bump = (d) => onChange(String(Math.max(min, Math.round((n + d) * 100) / 100)));
  return (
    <div className="stepper">
      <span className="field-label">{label}</span>
      <div className="stepper-row">
        <button type="button" className="stepper-btn" onClick={() => bump(-step)} aria-label={`${label} minus ${step}`}>−</button>
        <input className="stepper-input" type="number" inputMode={inputMode} min={min} step="any" value={value}
          onChange={(e) => onChange(e.target.value)} aria-label={label} />
        <button type="button" className="stepper-btn" onClick={() => bump(step)} aria-label={`${label} plus ${step}`}>+</button>
      </div>
      {suffix && <span className="stepper-suffix">{suffix}</span>}
    </div>
  );
}

/**
 * Log (or edit) one set. prefill: { setNumber, weightLb, reps }; reason: why this weight.
 */
export function LogSetModal({ exercise, prefill, reason, editing, onClose, onSave, onDelete }) {
  const [weight, setWeight] = useState(prefill?.weightLb == null ? "" : String(prefill.weightLb));
  const [reps, setReps] = useState(String(prefill?.reps ?? ""));
  const [rpe, setRpe] = useState(editing?.rpe == null ? "" : String(editing.rpe));
  const w = Number(weight);
  const step = w >= 20 || weight === "" ? 5 : 2.5;
  return (
    <FormModal
      title={`${exercise} · set ${prefill?.setNumber ?? 1}`}
      submitLabel={editing ? "Save set" : "Log set"}
      submitDisabled={reps === "" || weight === ""}
      onClose={onClose}
      extraActions={editing && onDelete ? <button type="button" className="btn btn-ghost btn-danger-text" onClick={onDelete}>Delete set</button> : null}
      onSubmit={() => onSave({ weightLb: roundTo(w), reps: Number(reps), rpe: rpe === "" ? null : Number(rpe) })}
    >
      {reason && <p className="set-reason"><i className="fa-solid fa-arrow-trend-up" aria-hidden="true" /> {reason}</p>}
      <div className="set-steppers">
        <Stepper label="Weight" value={weight} onChange={setWeight} step={step} suffix="lb" />
        <Stepper label="Reps" value={reps} onChange={setReps} step={1} inputMode="numeric" />
      </div>
      <Field label="How hard? RPE 1–10 (optional)" hint="10 = nothing left, 8 = two reps left in the tank.">
        <select value={rpe} onChange={(e) => setRpe(e.target.value)}>
          <option value="">—</option>
          {[6, 6.5, 7, 7.5, 8, 8.5, 9, 9.5, 10].map((v) => <option key={v} value={v}>{v}</option>)}
        </select>
      </Field>
    </FormModal>
  );
}

// Weights you type are kept to 0.25 lb; plate math is only applied to suggestions.
const roundTo = (w) => (Number.isFinite(w) ? Math.round(w * 4) / 4 : 0);
