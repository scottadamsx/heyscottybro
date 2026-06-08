/**
 * Vercel serverless function — resolves a public document share token.
 *
 * Given { token }, it (using the service-role key, bypassing RLS):
 *   1. looks up the share, rejecting revoked/expired tokens
 *   2. bumps access_count + accessed_at
 *   3. loads the document metadata
 *   4. creates a 1-hour signed URL for the private file
 * and returns { document, signedUrl }. Anonymous viewers never touch the DB
 * directly, so no public RLS policies are required.
 *
 * Required env vars (Vercel → Settings → Environment Variables):
 *   SUPABASE_URL                (your project URL)
 *   SUPABASE_SERVICE_ROLE_KEY   (service role key — keep secret, server-only)
 */
import { createClient } from "@supabase/supabase-js";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const url = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    return res.status(500).json({ error: "Server not configured: set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in Vercel." });
  }

  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
    const token = body?.token;
    if (!token) return res.status(400).json({ error: "Missing token" });

    const supabase = createClient(url, serviceKey, { auth: { persistSession: false } });

    const { data: share, error: shareErr } = await supabase
      .from("document_shares")
      .select("*, documents(*)")
      .eq("token", token)
      .maybeSingle();

    if (shareErr) throw shareErr;
    if (!share || !share.documents) return res.status(404).json({ error: "Link not found." });
    if (share.revoked) return res.status(403).json({ error: "This link has been revoked." });
    if (share.expires_at && new Date(share.expires_at) < new Date()) {
      return res.status(403).json({ error: "This link has expired." });
    }

    // Best-effort access tracking (don't fail the request if it errors).
    await supabase
      .from("document_shares")
      .update({ access_count: (share.access_count || 0) + 1, accessed_at: new Date().toISOString() })
      .eq("id", share.id)
      .then(() => {}, () => {});

    const doc = share.documents;
    const { data: signed, error: signErr } = await supabase.storage
      .from("documents")
      .createSignedUrl(doc.storage_path, 3600);
    if (signErr) throw signErr;

    return res.status(200).json({
      document: {
        name: doc.name,
        filename: doc.filename,
        mime_type: doc.mime_type,
        size_bytes: doc.size_bytes,
        description: doc.description,
      },
      signedUrl: signed.signedUrl,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
