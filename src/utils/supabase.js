import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY;

// Belt-and-braces with main.jsx's REQUIRED_ENV check: never fall back to a
// placeholder client that would fail on every call with an unhelpful message (QF-3).
const missingEnv = [
  ["VITE_SUPABASE_URL", supabaseUrl],
  ["VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY", supabaseKey],
].filter(([, v]) => !v).map(([k]) => k);
if (missingEnv.length > 0) {
  throw new Error(`Missing required environment variables: ${missingEnv.join(", ")}. Check your .env file.`);
}

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
