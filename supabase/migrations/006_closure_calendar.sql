-- Additive migration; existing restaurant records remain open by default.
ALTER TABLE public.restaurants ADD COLUMN IF NOT EXISTS closed_dates jsonb NOT NULL DEFAULT '[]'::jsonb;
