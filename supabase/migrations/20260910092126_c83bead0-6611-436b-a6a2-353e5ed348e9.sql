ALTER TABLE public.complaints
  ADD COLUMN IF NOT EXISTS location_name text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS reported_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS report_quality jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS report_quality_score integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS report_validation_status text NOT NULL DEFAULT 'ACCEPT',
  ADD COLUMN IF NOT EXISTS validation_reason text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS issue_detected boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS waste_amount text NOT NULL DEFAULT 'UNKNOWN',
  ADD COLUMN IF NOT EXISTS severity text NOT NULL DEFAULT 'UNKNOWN',
  ADD COLUMN IF NOT EXISTS duplicate_status text NOT NULL DEFAULT 'UNIQUE',
  ADD COLUMN IF NOT EXISTS duplicate_of_complaint_id uuid REFERENCES public.complaints(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS duplicate_confidence numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS duplicate_detection_reason text NOT NULL DEFAULT '';

CREATE TABLE IF NOT EXISTS public.completion_evidence (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  complaint_id uuid NOT NULL REFERENCES public.complaints(id) ON DELETE CASCADE,
  worker_id uuid REFERENCES public.workers(id) ON DELETE SET NULL,
  worker_user_id uuid,
  image_path text NOT NULL DEFAULT '',
  latitude double precision NOT NULL DEFAULT 0,
  longitude double precision NOT NULL DEFAULT 0,
  location_name text NOT NULL DEFAULT '',
  captured_at timestamptz NOT NULL DEFAULT now(),
  gps_verified boolean NOT NULL DEFAULT false,
  distance_from_reported_location numeric NOT NULL DEFAULT 0,
  completion_validation_status text NOT NULL DEFAULT 'PENDING',
  validation_reason text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.completion_evidence TO authenticated;
GRANT ALL ON public.completion_evidence TO service_role;
ALTER TABLE public.completion_evidence ENABLE ROW LEVEL SECURITY;

CREATE POLICY "completion evidence readable by ward staff"
  ON public.completion_evidence FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.complaints c WHERE c.id = complaint_id AND public.can_view_zone(c.zone_id)));

CREATE POLICY "completion evidence readable by worker"
  ON public.completion_evidence FOR SELECT TO authenticated
  USING (worker_user_id = auth.uid());

CREATE POLICY "completion evidence readable by citizen"
  ON public.completion_evidence FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.complaints c WHERE c.id = complaint_id AND c.citizen_id = auth.uid()));

CREATE TABLE IF NOT EXISTS public.complaint_supports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  complaint_id uuid NOT NULL REFERENCES public.complaints(id) ON DELETE CASCADE,
  citizen_id uuid NOT NULL,
  note text NOT NULL DEFAULT '',
  lat double precision NOT NULL DEFAULT 0,
  lng double precision NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (complaint_id, citizen_id)
);

GRANT SELECT, INSERT ON public.complaint_supports TO authenticated;
GRANT ALL ON public.complaint_supports TO service_role;
ALTER TABLE public.complaint_supports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own support insertable"
  ON public.complaint_supports FOR INSERT TO authenticated
  WITH CHECK (citizen_id = auth.uid());

CREATE POLICY "own support readable"
  ON public.complaint_supports FOR SELECT TO authenticated
  USING (citizen_id = auth.uid());

CREATE POLICY "supports readable by ward staff"
  ON public.complaint_supports FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.complaints c WHERE c.id = complaint_id AND public.can_view_zone(c.zone_id)));