import { useCallback, useRef, useState } from "react";

/**
 * Lightweight form state manager with dirty tracking and per-field errors.
 *
 * Usage:
 *   const { values, errors, dirty, set, reset, validate, props } = useForm(initial, rules);
 *   validate() → true if clean, sets errors and returns false otherwise
 *   props(field) → { value, onChange } spread directly onto an input
 */
export function useForm(initial = {}, rules = {}) {
  const initialRef = useRef(initial);
  const [values, setValues] = useState(initial);
  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState({});

  const dirty = Object.keys(values).some((k) => values[k] !== initialRef.current[k]);

  const set = useCallback((field, value) => {
    setValues((v) => ({ ...v, [field]: value }));
    setTouched((t) => ({ ...t, [field]: true }));
    setErrors((e) => ({ ...e, [field]: undefined }));
  }, []);

  const setAll = useCallback((patch) => {
    setValues((v) => ({ ...v, ...patch }));
  }, []);

  const reset = useCallback((next = null) => {
    const base = next ?? initialRef.current;
    if (next) initialRef.current = next;
    setValues(base);
    setErrors({});
    setTouched({});
  }, []);

  const validate = useCallback(() => {
    const errs = {};
    for (const [field, rule] of Object.entries(rules)) {
      const msg = typeof rule === "function" ? rule(values[field], values) : null;
      if (msg) errs[field] = msg;
    }
    setErrors(errs);
    setTouched(Object.fromEntries(Object.keys(rules).map((k) => [k, true])));
    return Object.keys(errs).length === 0;
  }, [values, rules]);

  const props = useCallback((field) => ({
    value: values[field] ?? "",
    onChange: (e) => set(field, e.target.value),
  }), [values, set]);

  return { values, errors, dirty, touched, set, setAll, reset, validate, props };
}
