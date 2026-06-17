/**
 * Gmail REST helpers for the inbox poller (api/inbox-sync.js).
 * Read-only: we exchange a long-lived refresh token for a short-lived access
 * token, then list + fetch messages. No mailbox state is changed.
 *
 * Env vars (Vercel → Settings → Environment Variables):
 *   GOOGLE_CLIENT_ID
 *   GOOGLE_CLIENT_SECRET
 *   GMAIL_REFRESH_TOKEN   (minted once via scripts/gmail-auth.mjs)
 *   GMAIL_QUERY           (optional; default "is:starred newer_than:30d")
 *
 * `_`-prefixed files in /api are not exposed as routes.
 */

export function gmailConfigured() {
  return !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET && process.env.GMAIL_REFRESH_TOKEN);
}

export const GMAIL_QUERY = process.env.GMAIL_QUERY || "is:starred newer_than:30d";

/** Exchange the stored refresh token for a short-lived access token. */
export async function getAccessToken() {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      refresh_token: process.env.GMAIL_REFRESH_TOKEN,
      grant_type: "refresh_token",
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`Gmail token refresh ${res.status}: ${data.error_description || data.error || "failed"}`);
  return data.access_token;
}

/** List up to `max` message ids matching `query` (most recent first). */
export async function listMessageIds(token, query = GMAIL_QUERY, max = 25) {
  const url = `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${encodeURIComponent(query)}&maxResults=${max}`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  const data = await res.json();
  if (!res.ok) throw new Error(`Gmail list ${res.status}: ${data.error?.message || "failed"}`);
  return data.messages || []; // [{ id, threadId }]
}

/** Fetch a full message and flatten it to { externalId, threadId, sender, subject, body, receivedAt }. */
export async function getMessage(token, id) {
  const url = `https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}?format=full`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  const data = await res.json();
  if (!res.ok) throw new Error(`Gmail get ${res.status}: ${data.error?.message || "failed"}`);

  const headers = data.payload?.headers || [];
  const h = (name) => headers.find((x) => x.name.toLowerCase() === name.toLowerCase())?.value || "";

  return {
    externalId: data.id,
    threadId: data.threadId,
    sender: h("From"),
    subject: h("Subject"),
    body: extractBody(data.payload) || data.snippet || "",
    receivedAt: data.internalDate ? new Date(Number(data.internalDate)).toISOString() : new Date().toISOString(),
  };
}

/**
 * Look up what we need to reply to a stored message: the recipient address
 * (Reply-To, else From), a clean subject, and the RFC822 Message-ID for
 * threading. Read-only (needs the gmail.readonly scope we already have).
 */
export async function getReplyTarget(token, gmailId) {
  const url = `https://gmail.googleapis.com/gmail/v1/users/me/messages/${gmailId}` +
    `?format=metadata&metadataHeaders=From&metadataHeaders=Reply-To&metadataHeaders=Subject&metadataHeaders=Message-ID`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  const data = await res.json();
  if (!res.ok) throw new Error(`Gmail metadata ${res.status}: ${data.error?.message || "failed"}`);
  const headers = data.payload?.headers || [];
  const h = (name) => headers.find((x) => x.name.toLowerCase() === name.toLowerCase())?.value || "";
  return {
    to: addressOf(h("Reply-To") || h("From")),
    subject: h("Subject"),
    messageId: h("Message-ID"),
    threadId: data.threadId,
  };
}

/** Pull the bare email out of a header value like '"Name" <a@b.com>'. */
function addressOf(s) {
  const m = String(s).match(/<([^>]+)>/);
  return (m ? m[1] : s).trim();
}

/**
 * Send a plain-text reply as the authenticated user (gmail.send scope).
 * Threads into the original via threadId + In-Reply-To/References headers.
 */
export async function sendReply(token, { to, subject, body, threadId, inReplyTo }) {
  if (!to) throw new Error("No recipient address to reply to.");
  const subj = /^re:/i.test(subject || "") ? subject : `Re: ${subject || ""}`.trim();
  const headers = [
    `To: ${to}`,
    `Subject: ${subj}`,
    'Content-Type: text/plain; charset="UTF-8"',
    "MIME-Version: 1.0",
  ];
  if (inReplyTo) { headers.push(`In-Reply-To: ${inReplyTo}`, `References: ${inReplyTo}`); }
  const mime = headers.join("\r\n") + "\r\n\r\n" + (body || "");
  const raw = Buffer.from(mime, "utf8").toString("base64url");

  const res = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(threadId ? { raw, threadId } : { raw }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`Gmail send ${res.status}: ${data.error?.message || "failed"}`);
  return data; // { id, threadId, labelIds }
}

/** Mark a Gmail message read by removing the UNREAD label (needs gmail.modify). */
export async function markRead(token, gmailId) {
  const res = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${gmailId}/modify`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ removeLabelIds: ["UNREAD"] }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(`Gmail mark-read ${res.status}: ${data.error?.message || "failed"}`);
  }
  return true;
}

/** Walk the MIME tree for the best text body: prefer text/plain, fall back to stripped text/html. */
function extractBody(payload) {
  if (!payload) return "";
  const plain = findPart(payload, "text/plain");
  if (plain) return decode(plain).trim();
  const html = findPart(payload, "text/html");
  if (html) return stripHtml(decode(html)).trim();
  if (payload.body?.data) return decode(payload).trim();
  return "";
}

function findPart(part, mime) {
  if (part.mimeType === mime && part.body?.data) return part;
  for (const p of part.parts || []) {
    const found = findPart(p, mime);
    if (found) return found;
  }
  return null;
}

function decode(part) {
  try {
    return Buffer.from(part.body.data, "base64url").toString("utf8");
  } catch {
    return "";
  }
}

function stripHtml(html) {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<\/(p|div|br|li|tr|h[1-6])>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/\n{3,}/g, "\n\n");
}
