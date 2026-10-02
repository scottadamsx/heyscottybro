export const JOURNAL_CLEANUP_LIMIT = 12000;

let statusPromise = null;
const defaultAuthHeaders = async () => (await import("../utils/supabase")).getAuthHeaders();
const parseResponse = async (response) => response.json().catch(() => ({}));

export async function loadJournalCleanupStatus({ request = fetch, authHeaders = defaultAuthHeaders, refresh = false } = {}) {
  if (!statusPromise || refresh) {
    statusPromise = (async () => {
      try {
        const response = await request("/api/chat", { headers: await authHeaders() });
        const data = await parseResponse(response);
        return { available: Boolean(response.ok && data?.journalCleanup?.available) };
      } catch {
        return { available: false };
      }
    })();
  }
  return statusPromise;
}

export function resetJournalCleanupStatusCache() {
  statusPromise = null;
}

export async function requestJournalCleanup(text, { request = fetch, authHeaders = defaultAuthHeaders } = {}) {
  const response = await request("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(await authHeaders()) },
    body: JSON.stringify({ feature: "journal_cleanup", text }),
  });
  const data = await parseResponse(response);
  if (!response.ok) throw new Error(data?.error || `Journal cleanup failed (${response.status})`);
  if (typeof data?.cleanedText !== "string" || !data.cleanedText.trim() || !data.provenance) {
    throw new Error("Journal cleanup returned an invalid result. Try again.");
  }
  return data;
}
