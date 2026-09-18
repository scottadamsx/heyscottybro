/**
 * Newsletter sign-up for the public site.
 *
 * Writes one row to `newsletter_signups` (email, source) with the public
 * Supabase client. The anon role may INSERT only — no select — so the insert
 * must not ask for the row back. A duplicate address hits the unique index
 * (Postgres 23505 / HTTP 409) and counts as "already on the list": that is a
 * success for the visitor, not an error. Any other failure is thrown with a
 * readable message; the form never shows success it didn't get.
 *
 * Pure apart from the injected client, so it runs under `node --test`.
 */

const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/; // same shape the table's CHECK enforces

/** Trimmed email check matching the DB constraint (5–254 chars). */
export function validateEmail(raw) {
  const email = String(raw ?? "").trim();
  if (!email) return { ok: false, email, error: "Enter your email address." };
  if (email.length < 5 || email.length > 254 || !EMAIL.test(email)) {
    return { ok: false, email, error: "That doesn't look like an email address — check for typos." };
  }
  return { ok: true, email };
}

export function isDuplicateError(error) {
  if (!error) return false;
  return error.code === "23505" || error.status === 409 || /duplicate key/i.test(error.message || "");
}

/**
 * @returns {Promise<{ status: "subscribed" | "already" }>}
 * @throws Error with a message fit for the form.
 */
export async function subscribe(client, rawEmail, source = "site") {
  const v = validateEmail(rawEmail);
  if (!v.ok) throw new Error(v.error);
  let result;
  try {
    result = await client.from("newsletter_signups").insert({ email: v.email, source: String(source).slice(0, 60) });
  } catch (err) {
    throw new Error(`Couldn't reach the sign-up service${err?.message ? ` (${err.message})` : ""}. Check your connection and try again.`, { cause: err });
  }
  const { error, status } = result || {};
  if (!error) return { status: "subscribed" };
  if (isDuplicateError({ ...error, status: error.status ?? status })) return { status: "already" };
  // supabase-js reports a dropped connection as an error object, not a throw.
  if (/failed to fetch|network|load failed/i.test(error.message || "")) {
    throw new Error(`Couldn't reach the sign-up service (${error.message}). Check your connection and try again.`);
  }
  throw new Error(`Sign-up failed: ${error.message || "unknown error"}. Please try again, or email scottadamsx@gmail.com.`);
}
