ALTER TABLE public.segregation_results
  ADD COLUMN IF NOT EXISTS predicted_category text,
  ADD COLUMN IF NOT EXISTS feedback text CHECK (feedback IN ('correct','wrong')),
  ADD COLUMN IF NOT EXISTS corrected_category text,
  ADD COLUMN IF NOT EXISTS feedback_at timestamptz;

DROP POLICY IF EXISTS "own results updatable" ON public.segregation_results;
CREATE POLICY "own results updatable" ON public.segregation_results
  FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.segregation_sessions s WHERE s.id = segregation_results.session_id AND s.citizen_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.segregation_sessions s WHERE s.id = segregation_results.session_id AND s.citizen_id = auth.uid()));

GRANT SELECT, INSERT, UPDATE ON public.segregation_results TO authenticated;
GRANT ALL ON public.segregation_results TO service_role;