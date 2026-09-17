import { useId } from 'react'

/** Label + control + optional hint/error. The control gets the generated id. */
export function Field({ label, hint, error, children, className = '' }) {
  const id = useId()
  return (
    <div className={`field ${className}`}>
      <label htmlFor={id}>{label}</label>
      {children(id)}
      {error ? (
        <p className="field-error" role="alert">
          {error}
        </p>
      ) : (
        hint && <p className="field-hint">{hint}</p>
      )}
    </div>
  )
}

export function TextField({ label, hint, error, value, onChange, className, ...rest }) {
  return (
    <Field label={label} hint={hint} error={error} className={className}>
      {(id) => <input id={id} className="input" value={value ?? ''} onChange={(e) => onChange(e.target.value)} aria-invalid={!!error} {...rest} />}
    </Field>
  )
}

export function TextArea({ label, hint, error, value, onChange, rows = 3, className, ...rest }) {
  return (
    <Field label={label} hint={hint} error={error} className={className}>
      {(id) => <textarea id={id} className="input textarea" rows={rows} value={value ?? ''} onChange={(e) => onChange(e.target.value)} {...rest} />}
    </Field>
  )
}

/** options: [{ value, label }] or groups: [{ label, options }] */
export function SelectField({ label, hint, value, onChange, options, groups, className, ...rest }) {
  const render = (list) => list.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)
  return (
    <Field label={label} hint={hint} className={className}>
      {(id) => (
        <select id={id} className="input" value={value} onChange={(e) => onChange(e.target.value)} {...rest}>
          {groups ? groups.map((g) => <optgroup key={g.label} label={g.label}>{render(g.options)}</optgroup>) : render(options)}
        </select>
      )}
    </Field>
  )
}

export function DateField(props) {
  return <TextField type="date" {...props} />
}
