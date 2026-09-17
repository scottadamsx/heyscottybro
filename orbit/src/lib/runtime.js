// Where the Orbit front end finds its API. Local Orbit uses the defaults; a host app that embeds
// Orbit (heyScottyBro's People space) calls configureOrbit() once before rendering.
const runtime = {
  apiBase: '/api',
  /** async () => headers to add to every API call (e.g. the signed-in user's token). */
  headers: async () => ({}),
  /** Inside a host app: the host owns the theme and the page title. */
  embedded: false,
  title: 'Orbit',
}

export function configureOrbit({ apiBase, headers, embedded, title } = {}) {
  if (apiBase) runtime.apiBase = apiBase
  if (headers) runtime.headers = headers
  if (embedded !== undefined) runtime.embedded = embedded
  if (title) runtime.title = title
}

export const isEmbedded = () => runtime.embedded
export const appTitle = () => runtime.title

export const apiUrl = (path) => `${runtime.apiBase}${path}`
export const apiHeaders = () => runtime.headers()
