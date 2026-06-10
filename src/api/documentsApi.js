// src/api/documentsApi.js
// Owner-side calls use the authenticated Supabase client (RLS: owner only).
// Public share resolution is fully server-side via /api/doc-share (service role),
// so anonymous viewers never touch the tables directly.
import { supabase, getAuthHeaders } from "../utils/supabase";

const BUCKET = "documents";

async function uid() {
  const { data: { session } } = await supabase.auth.getSession();
  const id = session?.user?.id;
  if (!id) throw new Error("Not authenticated");
  return id;
}

/** List all documents for the current user, newest first. */
export async function loadDocuments() {
  const userId = await uid();
  const { data, error } = await supabase
    .from("documents")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

/** Upload a file to storage and create its metadata row. */
export async function uploadDocument(file, { name, description = "", tags = [] } = {}) {
  const userId = await uid();
  const docId = crypto.randomUUID();
  // Keep the original filename but strip anything weird from the path.
  const safeName = file.name.replace(/[^\w.\-]+/g, "_");
  const storagePath = `${userId}/${docId}/${safeName}`;

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(storagePath, file, { contentType: file.type || "application/octet-stream", upsert: false });
  if (uploadError) throw uploadError;

  const { data, error: dbError } = await supabase
    .from("documents")
    .insert({
      id: docId,
      user_id: userId,
      name: name || file.name,
      filename: file.name,
      storage_path: storagePath,
      mime_type: file.type || "application/octet-stream",
      size_bytes: file.size,
      description,
      tags,
    })
    .select()
    .single();
  if (dbError) {
    await supabase.storage.from(BUCKET).remove([storagePath]); // rollback
    throw dbError;
  }
  return data;
}

/** Delete a document (storage object + DB row; CASCADE removes its shares). */
export async function deleteDocument(doc) {
  const { error: storageError } = await supabase.storage.from(BUCKET).remove([doc.storage_path]);
  if (storageError) throw storageError;
  const { error: dbError } = await supabase.from("documents").delete().eq("id", doc.id);
  if (dbError) throw dbError;
}

/** Update document metadata. */
export async function updateDocument(id, fields) {
  const patch = {};
  ["name", "description", "tags"].forEach((k) => { if (fields[k] !== undefined) patch[k] = fields[k]; });
  const { data, error } = await supabase
    .from("documents").update(patch).eq("id", id).select().single();
  if (error) throw error;
  return data;
}

/** Short-lived signed URL for owner viewing/downloading. */
export async function getSignedUrl(storagePath, expiresIn = 3600) {
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(storagePath, expiresIn);
  if (error) throw error;
  return data.signedUrl;
}

/** Create a share token. expiresInDays: null = never. */
export async function createShareToken(documentId, { sharedWithEmail = null, expiresInDays = null } = {}) {
  const userId = await uid();
  const expires_at = expiresInDays
    ? new Date(Date.now() + expiresInDays * 86400000).toISOString()
    : null;
  const { data, error } = await supabase
    .from("document_shares")
    .insert({ document_id: documentId, created_by: userId, shared_with_email: sharedWithEmail, expires_at })
    .select()
    .single();
  if (error) throw error;
  return data;
}

/** List all shares for a document, newest first. */
export async function loadDocumentShares(documentId) {
  const { data, error } = await supabase
    .from("document_shares")
    .select("*")
    .eq("document_id", documentId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

/** Revoke a share token. */
export async function revokeShare(shareId) {
  const { error } = await supabase.from("document_shares").update({ revoked: true }).eq("id", shareId);
  if (error) throw error;
}

/** Public: resolve a share token → { document, signedUrl }. Server-side, no auth. */
export async function fetchSharedDoc(token) {
  const res = await fetch("/api/doc-share", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "This share link is invalid, expired, or has been revoked.");
  return data; // { document, signedUrl }
}

/** Email a share link via /api/send-share-email (Resend). Throws on failure. */
export async function emailShareLink({ to, documentName, shareUrl }) {
  const res = await fetch("/api/send-share-email", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(await getAuthHeaders()) },
    body: JSON.stringify({ to, document_name: documentName, share_url: shareUrl }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Email failed (${res.status})`);
  return data;
}
