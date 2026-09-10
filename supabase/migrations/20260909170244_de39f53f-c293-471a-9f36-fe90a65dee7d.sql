
CREATE POLICY "citizen adds events to own complaints" ON public.complaint_events
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.complaints c
    WHERE c.id = complaint_events.complaint_id AND c.citizen_id = auth.uid()
  ));
