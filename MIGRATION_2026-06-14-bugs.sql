-- Migration: bugs table
-- Run this in your Supabase SQL editor.

CREATE TABLE IF NOT EXISTS public.bugs (
  id          UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     UUID        REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  title       TEXT        NOT NULL,
  description TEXT,
  steps       TEXT,
  page        TEXT,
  priority    TEXT        NOT NULL DEFAULT 'medium'
                CHECK (priority IN ('low','medium','high','critical')),
  status      TEXT        NOT NULL DEFAULT 'open'
                CHECK (status IN ('open','in_progress','resolved','closed')),
  notes       TEXT,
  resolved_at TIMESTAMPTZ,
  created_at  TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at  TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Auto-update updated_at on every row change
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;

CREATE TRIGGER bugs_updated_at
  BEFORE UPDATE ON public.bugs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- RLS: each user only sees their own bugs
ALTER TABLE public.bugs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "bugs_owner" ON public.bugs
  FOR ALL USING (auth.uid() = user_id);

-- Index for fast user queries (most common access pattern)
CREATE INDEX IF NOT EXISTS bugs_user_created ON public.bugs (user_id, created_at DESC);

-- ── Feature requests + screenshots (added 2026-06-14) ──────────────────────
-- type distinguishes bug reports from feature requests in the same tracker.
ALTER TABLE public.bugs
  ADD COLUMN IF NOT EXISTS type TEXT NOT NULL DEFAULT 'bug'
    CHECK (type IN ('bug','feature'));

-- screenshots holds an array of storage paths in the 'bug-screenshots' bucket.
ALTER TABLE public.bugs
  ADD COLUMN IF NOT EXISTS screenshots JSONB NOT NULL DEFAULT '[]'::jsonb;

-- ── Private storage bucket for screenshots ─────────────────────────────────
-- Files are stored under <user_id>/<bug_id>/<file>; RLS scopes each user to
-- their own folder, matching the 'documents' / 'nutrition' bucket pattern.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('bug-screenshots', 'bug-screenshots', false, 10485760,
        ARRAY['image/png','image/jpeg','image/webp','image/gif'])
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "bug shots owner upload" ON storage.objects;
CREATE POLICY "bug shots owner upload" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'bug-screenshots' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "bug shots owner read" ON storage.objects;
CREATE POLICY "bug shots owner read" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'bug-screenshots' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "bug shots owner delete" ON storage.objects;
CREATE POLICY "bug shots owner delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'bug-screenshots' AND (storage.foldername(name))[1] = auth.uid()::text);
