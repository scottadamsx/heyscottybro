// Orbit's API for a hosted site (heyScottyBro mounts it at /api/orbit). Every request must carry the
// caller's Supabase access token; reads and writes then run as that user, under row security.
import { createApp } from './app.js'
import { userClient, verifyUser } from './cloudStore.js'

export function createHostedApp({ base, url, publicKey }) {
  if (!url || !publicKey) throw new Error('Orbit needs the Supabase URL and public key')
  return createApp({
    base,
    localOnly: false,
    cloud: {
      async getClient(req) {
        const token = /^Bearer\s+(.+)$/i.exec(req.get('authorization') || '')?.[1]
        const userId = await verifyUser({ url, publicKey, token })
        return userClient({ url, publicKey, token, userId })
      },
    },
  })
}
