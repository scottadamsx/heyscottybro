// Where the Orbit front end finds its API. Local Orbit uses the defaults; a host app that embeds
// Orbit (heyScottyBro's People space) calls configureOrbit() once before rendering.
const runtime = {
  apiBase: '/api',
  /** async () => headers to add to every API call (e.g. the signed-in user's token). */
  headers: async () => ({}),
  /** Inside a host app: the host owns the theme and the page title. */
  embedded: false,
  title: 'Orbit',
  /**
   * Optional host-supplied storage for person pictures:
   * { upload(file, personId) -> path, sign(path) -> url, remove(path) }.
   * Orbit itself stores no image bytes; without this, pictures stay initials.
   */
  media: null,
}

export function configureOrbit({ apiBase, headers, embedded, title, media } = {}) {
  if (apiBase) runtime.apiBase = apiBase
  if (headers) runtime.headers = headers
  if (embedded !== undefined) runtime.embedded = embedded
  if (title) runtime.title = title
  if (media !== undefined) runtime.media = media
}

export const isEmbedded = () => runtime.embedded
export const appTitle = () => runtime.title
export const mediaStore = () => runtime.media

export const apiUrl = (path) => `${runtime.apiBase}${path}`
export const apiHeaders = () => runtime.headers()
