CREATE TABLE public.score_events (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  role text NOT NULL CHECK (role IN ('citizen','worker')),
  complaint_id uuid REFERENCES public.complaints(id) ON DELETE SET NULL,
  kind text NOT NULL,
  points integer NOT NULL,
  reason text NOT NULL DEFAULT '',
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX score_events_unique_award
  ON public.score_events (user_id, complaint_id, kind)
  WHERE complaint_id IS NOT NULL;
CREATE INDEX score_events_user_idx ON public.score_events (user_id, created_at DESC);

GRANT SELECT ON public.score_events TO authenticated;
GRANT ALL ON public.score_events TO service_role;

ALTER TABLE public.score_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own score history"
  ON public.score_events FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Staff can view all score history"
  ON public.score_events FOR SELECT TO authenticated
  USING (public.is_staff());