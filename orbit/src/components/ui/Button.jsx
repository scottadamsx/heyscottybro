/** The closed button set from housestyle-ui §6: primary · secondary · quiet · ghost · danger. */
export default function Button({ variant = 'quiet', size, className = '', type = 'button', ...rest }) {
  const cls = ['btn', `btn-${variant}`, size && `btn-${size}`, className].filter(Boolean).join(' ')
  return <button type={type} className={cls} {...rest} />
}

export function IconButton({ label, className = '', ...rest }) {
  return <button type="button" className={`icon-btn ${className}`} aria-label={label} title={label} {...rest} />
}
