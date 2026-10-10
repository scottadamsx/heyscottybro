const authHeaders = async () => (await import("../utils/supabase")).getAuthHeaders();
const parseResponse = async (response) => response.json().catch(() => ({}));

export async function loadEventDraftingStatus({ request = fetch, headers = authHeaders } = {}) {
  try {
    const response = await request("/api/chat", { headers: await headers() });
    const body = await parseResponse(response);
    return Boolean(response.ok && body?.eventDrafting?.available);
  } catch { return false; }
}

export async function requestEventDraft(description, { request = fetch, headers = authHeaders, now = new Date() } = {}) {
  const response = await request("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(await headers()) },
    body: JSON.stringify({ feature: "event_draft", description, referenceDate: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC" }),
  });
  const body = await parseResponse(response);
  if (!response.ok) throw new Error(body?.error || `Event drafting failed (${response.status})`);
  if (!body?.draft || !body?.provenance) throw new Error("Event drafting returned an invalid result. Try again.");
  return body;
}
