// src/api/messagesApi.js — flagged messages + AI reply drafts (Inbox tool).
// The `channel` field is the seam for future connectors: an email/Slack/Discord
// ingester just inserts rows with channel set; the UI + AI drafting are
// channel-agnostic. Today's usable path is channel "manual" (paste a message).
import { supabase, getAuthHeaders } from "../utils/supabase";

async function uid() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user?.id) throw new Error("Not authenticated");
  return session.user.id;
}

export async function loadMessages() {
  const userId = await uid();
  const { data, error } = await supabase
    .from("messages")
    .select("*")
    .eq("user_id", userId)
    .order("received_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function createMessage({ channel = "manual", sender = "", subject = "", body }) {
  const userId = await uid();
  const { data, error } = await supabase
    .from("messages")
    .insert({ user_id: userId, channel, sender: sender.trim(), subject: subject.trim(), body, status: "needs_reply", flagged: true })
    .select().single();
  if (error) throw error;
  return data;
}

export async function updateMessage(id, fields) {
  const { data, error } = await supabase.from("messages").update(fields).eq("id", id).select().single();
  if (error) throw error;
  return data;
}

export async function deleteMessage(id) {
  const { error } = await supabase.from("messages").delete().eq("id", id);
  if (error) throw error;
}

/**
 * Pull matching Gmail messages into the inbox via the server-side poller
 * (api/inbox-sync). Returns { scanned, imported }. Throws with a readable
 * message if Gmail isn't connected yet.
 */
export async function syncGmail() {
  const res = await fetch("/api/inbox-sync", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(await getAuthHeaders()) },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Sync failed (${res.status})`);
  return data;
}
