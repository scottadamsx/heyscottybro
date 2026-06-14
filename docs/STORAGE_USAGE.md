# Storage Usage

Shows how much of your Supabase quota you're using — **database size** and
**file storage** — right on the admin dashboard, with a per-table and
per-bucket breakdown.

Supabase has two independent quotas:

| Quota | What it holds | Free-tier limit |
|-------|---------------|-----------------|
| **Database** | Postgres tables (transactions, journal, reminders, …) | 500 MB |
| **File storage** | Storage buckets — documents, nutrition images | 1 GB |

## How it works

`supabase-js` can only call PostgREST and RPC functions — it can't run admin SQL
like `pg_database_size()` directly. So a single Postgres function does the
measuring and the client calls it:

```
storage_usage()  ──rpc──>  { db_bytes, tables[], buckets[], measured_at }
```

- **Definition:** `MIGRATION_2026-06-14-storage-usage.sql` (also baked into
  `SUPABASE_SETUP.sql` for fresh installs).
- It's `SECURITY DEFINER`, so it runs with the privileges needed to read
  `pg_database_size`, `pg_statio_user_tables`, and `storage.objects`.
- It returns **only names and byte counts** — never any row data.
- `EXECUTE` is granted to `authenticated` only (revoked from `anon`/`public`),
  so it isn't exposed to anonymous visitors.

### Pieces

| Layer | File |
|-------|------|
| SQL function | `MIGRATION_2026-06-14-storage-usage.sql`, `SUPABASE_SETUP.sql` |
| API call | `loadStorageUsage()` in `src/api/plannerApi.js` |
| UI card | `src/components/StorageUsage.jsx` |
| Mounted on | `src/pages/admin/DashboardPage.jsx` |

## Setup

Run the migration once in the Supabase SQL editor (project `mogoybejtmkoheqvfvuc`):

```sql
-- MIGRATION_2026-06-14-storage-usage.sql
```

Until it's run, the dashboard card shows a hint to run it. The app otherwise
works fine — the card just can't measure.

## Changing the quota limits

The progress bars compare usage against the Free-tier limits by default. If you
upgrade (Pro = 8 GB DB, 100 GB storage), override via env in `.env`:

```
VITE_SUPABASE_DB_LIMIT_MB=8192
VITE_SUPABASE_STORAGE_LIMIT_MB=102400
```

Bars turn amber at 75% and red at 90%.

## Checking usage without the app

Run these in the Supabase SQL editor:

```sql
-- Total database size
select pg_size_pretty(pg_database_size(current_database()));

-- Biggest tables
select relname as table, pg_size_pretty(pg_total_relation_size(relid)) as size
from pg_catalog.pg_statio_user_tables
order by pg_total_relation_size(relid) desc limit 20;

-- File storage, per bucket
select bucket_id, count(*) as files,
       pg_size_pretty(coalesce(sum((metadata->>'size')::bigint), 0)) as size
from storage.objects group by bucket_id;
```

Or skip SQL entirely: Supabase Dashboard → **Reports** / **Settings → Usage**.

## Troubleshooting

- **"storage_usage() isn't in the database yet"** — run the migration.
- **Card says "unavailable"** — you're in local-data mode or signed out; the RPC
  needs an authenticated session.
- **Numbers differ slightly from Supabase's dashboard** — `pg_database_size`
  reports live on-disk size; Supabase's billing view samples periodically. Close
  enough to act on, not penny-exact.
