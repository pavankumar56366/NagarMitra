ALTER TABLE public.complaints
  ADD COLUMN IF NOT EXISTS image_hash text NOT NULL DEFAULT '';
CREATE INDEX IF NOT EXISTS complaints_dup_lookup_idx
  ON public.complaints (created_at DESC, waste_category);