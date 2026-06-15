/**
 * Production stub for the vault sync. The deployed app cannot read a local
 * folder, so "Sync from vault" only works under `npm run dev` on the Mac
 * (handled by a Vite dev middleware). On the live site the Brain graph reads
 * its data from Supabase instead.
 */
import { verifySupabaseUser } from "./_utils.js";

export default async function handler(req, res) {
  if (!(await verifySupabaseUser(req))) return res.status(401).json({ error: "Not authenticated" });
  return res.status(200).json({
    error: "server_unavailable",
    message: "Vault sync runs in local dev only (npm run dev on your Mac). The live site reads the Brain from Supabase.",
  });
}
