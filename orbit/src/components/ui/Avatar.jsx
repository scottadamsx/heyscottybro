import { groupOf } from '../../lib/constants.js'
import { usePhotoUrl } from '../../lib/photoUrl.js'

export function initials(name = '') {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (!parts.length) return '?'
  const first = parts[0][0]
  const last = parts.length > 1 ? parts.at(-1)[0] : parts[0][1] || ''
  return (first + last).toUpperCase()
}

/** The person's picture when they have one, else initials on a tint of their group colour. */
export default function Avatar({ person, size = 'md' }) {
  const url = usePhotoUrl(person?.photo)
  return (
    <span className={`avatar avatar-${size} avatar-${groupOf(person?.group).id}`} aria-hidden>
      {url ? <img src={url} alt="" /> : initials(person?.name)}
    </span>
  )
}
