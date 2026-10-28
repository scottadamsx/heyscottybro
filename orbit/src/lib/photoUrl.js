// Resolves a person's stored picture path to a viewable URL through the
// host-supplied media capability (runtime.js). Signed URLs are cached per
// path for most of their lifetime so list rows do not re-sign on every render.
import { useEffect, useState } from 'react'
import { mediaStore } from './runtime.js'

const TTL_MS = 50 * 60 * 1000 // signed URLs last an hour; refresh ahead of expiry
const cache = new Map() // path -> { url, at } | { pending: Promise }

export function resolvePhotoUrl(path) {
  const media = mediaStore()
  if (!path || !media?.sign) return Promise.resolve(null)
  const hit = cache.get(path)
  if (hit?.url && Date.now() - hit.at < TTL_MS) return Promise.resolve(hit.url)
  if (hit?.pending) return hit.pending
  const pending = Promise.resolve()
    .then(() => media.sign(path))
    .then((url) => {
      cache.set(path, url ? { url, at: Date.now() } : { url: null, at: Date.now() })
      return url || null
    })
    .catch(() => {
      cache.delete(path)
      return null
    })
  cache.set(path, { pending })
  return pending
}

/** The picture URL for a stored path, or null (no picture, no host storage, still loading, failed). */
export function usePhotoUrl(path) {
  const [url, setUrl] = useState(null)
  useEffect(() => {
    let live = true
    setUrl(null)
    if (path) resolvePhotoUrl(path).then((u) => { if (live) setUrl(u) })
    return () => { live = false }
  }, [path])
  return url
}
