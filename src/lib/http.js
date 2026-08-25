/**
 * Guarded JSON parsing for fetch responses.
 *
 * `res.json()` on a non-JSON body (a Vercel 500 page, a 404 HTML shell, a
 * proxy timeout page) throws "Unexpected token '<'" / "unexpected MIME type",
 * which tells the user nothing about what actually failed. This reads the
 * body as text first and, when it isn't JSON, throws an Error that carries the
 * real status, the URL, the content type and a tag-stripped snippet.
 */
export async function parseJsonResponse(res) {
  const url = res.url || "";
  const contentType = (res.headers?.get?.("content-type") || "").split(";")[0].trim();
  const text = await res.text();
  try {
    return text ? JSON.parse(text) : {};
  } catch {
    const snippet = text.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim().slice(0, 120);
    throw new Error(`API ${res.status} from ${url}: server returned ${contentType || "non-JSON"}${snippet ? ` (${snippet})` : ""}`);
  }
}

/** Parse the body, then throw a readable Error when the status isn't 2xx. */
export async function readJsonOrThrow(res, fallbackLabel = "API error") {
  const data = await parseJsonResponse(res);
  if (!res.ok) throw new Error(data?.error?.message || data?.message || (typeof data?.error === "string" ? data.error : "") || `${fallbackLabel} ${res.status}`);
  return data;
}
