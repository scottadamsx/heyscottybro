-- ═══════════════════════════════════════════════════════════
-- storage_usage() — report DB + file-storage size to the app (2026-06-14)
--
-- supabase-js (anon or service-role) can only call PostgREST/RPC, never raw
-- admin SQL like pg_database_size(). This SECURITY DEFINER function runs as its
-- owner so the client can read aggregate sizes via supabase.rpc("storage_usage").
--
-- It returns ONLY names + byte counts (database size, per-table sizes, and
-- per-bucket file sizes) — never any row data. Execute is granted to
-- `authenticated` only, so it is not exposed to anonymous visitors.
-- ═══════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.storage_usage()
RETURNS json
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT json_build_object(
    'db_bytes', pg_database_size(current_database()),
    'tables', (
      SELECT coalesce(json_agg(t ORDER BY t.bytes DESC), '[]'::json)
      FROM (
        SELECT relname AS name, pg_total_relation_size(relid) AS bytes
        FROM pg_catalog.pg_statio_user_tables
      ) t
    ),
    'buckets', (
      SELECT coalesce(json_agg(b ORDER BY b.bytes DESC), '[]'::json)
      FROM (
        SELECT bucket_id AS name,
               count(*) AS files,
               coalesce(sum((metadata->>'size')::bigint), 0) AS bytes
        FROM storage.objects
        GROUP BY bucket_id
      ) b
    ),
    'measured_at', now()
  );
$$;

-- Lock down: only signed-in users may call it (not the public anon role).
REVOKE EXECUTE ON FUNCTION public.storage_usage() FROM anon, public;
GRANT  EXECUTE ON FUNCTION public.storage_usage() TO authenticated;

-- Verify
SELECT 'storage_usage()' AS fn,
       CASE WHEN EXISTS (
         SELECT 1 FROM pg_proc WHERE proname = 'storage_usage'
       ) THEN 'ok' ELSE 'MISSING' END AS status;
