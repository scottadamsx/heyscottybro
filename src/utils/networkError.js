// A request that never reached the server (offline, Wi-Fi drop, Safari's "Load failed").
// fetch() throws a TypeError for these, but supabase-js catches it and hands back an
// ordinary error object whose message is the TypeError's text, so check both shapes.
const NETWORK_TEXT = /^(TypeError:\s*)?(load failed|failed to fetch|fetch failed|networkerror when attempting to fetch resource|network request failed|the network connection was lost)/i;

export function isNetworkError(err) {
  if (!err) return false;
  const msg = String(err.message ?? "");
  if (err instanceof TypeError && /fetch|network|failed/i.test(msg)) return true;
  return NETWORK_TEXT.test(msg.trim());
}
