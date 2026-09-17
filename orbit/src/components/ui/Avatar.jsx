import { groupOf } from '../../lib/constants.js'

export function initials(name = '') {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (!parts.length) return '?'
  const first = parts[0][0]
  const last = parts.length > 1 ? parts.at(-1)[0] : parts[0][1] || ''
  return (first + last).toUpperCase()
}

/** Initials on a tint of the person's group colour. */
export default function Avatar({ person, size = 'md' }) {
  return (
    <span className={`avatar avatar-${size} avatar-${groupOf(person?.group).id}`} aria-hidden>
      {initials(person?.name)}
    </span>
  )
}
