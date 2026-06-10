import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || "https://placeholder.supabase.co";
const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY || "placeholder";

export const supabase = createClient(supabaseUrl, supabaseKey);

/**
 * Authorization header for our own /api/* serverless functions, which verify
 * the caller is a logged-in Supabase user. Empty object if not logged in.
 */
export async function getAuthHeaders() {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {};
  } catch {
    return {};
  }
}
