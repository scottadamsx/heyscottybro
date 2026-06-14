-- ═══════════════════════════════════════════════════════════
-- Add `reconciled` to the transactions table (2026-06-14)
--
-- The Finance UI now reads/writes the standalone `transactions` table
-- (the same store Frodo uses) instead of the JSON blob in budget_config.
-- The reconcile tab needs a `reconciled` flag to persist. Inserts omit
-- this column, so the app works with or without this migration — but
-- running it makes reconcile state stick across reloads.
-- ═══════════════════════════════════════════════════════════

ALTER TABLE transactions ADD COLUMN IF NOT EXISTS reconciled BOOLEAN DEFAULT FALSE;

-- Verify
SELECT 'transactions.reconciled' AS col,
       CASE WHEN EXISTS (
         SELECT 1 FROM information_schema.columns
         WHERE table_schema = 'public' AND table_name = 'transactions' AND column_name = 'reconciled'
       ) THEN 'ok' ELSE 'MISSING' END AS status;
