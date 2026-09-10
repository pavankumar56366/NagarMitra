ALTER TYPE public.complaint_status ADD VALUE IF NOT EXISTS 'cancelled';

ALTER TABLE public.complaints
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz,
  ADD COLUMN IF NOT EXISTS deleted_by uuid,
  ADD COLUMN IF NOT EXISTS deletion_reason text;