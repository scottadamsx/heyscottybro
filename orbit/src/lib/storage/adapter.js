import { fileAdapter } from './fileAdapter.js'

// One adapter: it talks to Orbit's API. Whether the API keeps data in local files or in Supabase
// is the server's choice (ORBIT_BACKEND), reported by /health as `storage`.
export const storage = fileAdapter
