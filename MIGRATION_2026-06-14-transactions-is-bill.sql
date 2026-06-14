-- ═══════════════════════════════════════════════════════════
-- Add `is_bill` to the transactions table (2026-06-14)
--
-- Lets any logged transaction be flagged as a bill payment, so the
-- Finance dashboard's Bills section can show it as "paid" — independent
-- of whether it matches a recurring-bill definition. Pairs with the
-- existing `fulfills_recurring_id` link (which ties a payment to a
-- specific recurring bill).
--
-- Inserts omit this column and the app reads it as `false` when absent,
-- so the app works with or without this migration — running it just
-- makes the bill flag stick across reloads.
-- ═══════════════════════════════════════════════════════════

ALTER TABLE transactions ADD COLUMN IF NOT EXISTS is_bill BOOLEAN DEFAULT FALSE;

-- Verify
SELECT 'transactions.is_bill' AS col,
       CASE WHEN EXISTS (
         SELECT 1 FROM information_schema.columns
         WHERE table_schema = 'public' AND table_name = 'transactions' AND column_name = 'is_bill'
       ) THEN 'ok' ELSE 'MISSING' END AS status;
