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
