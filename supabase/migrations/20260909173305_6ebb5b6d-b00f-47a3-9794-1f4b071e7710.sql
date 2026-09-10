ALTER TABLE public.complaints ADD COLUMN IF NOT EXISTS assigned_worker_user_id uuid;

UPDATE public.complaints c
SET assigned_worker_user_id = w.user_id
FROM public.workers w
WHERE c.assigned_worker_id = w.id
  AND c.assigned_worker_user_id IS DISTINCT FROM w.user_id;

CREATE OR REPLACE FUNCTION public.sync_complaint_worker_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.assigned_worker_id IS NULL THEN
    NEW.assigned_worker_user_id := NULL;
  ELSE
    SELECT user_id INTO NEW.assigned_worker_user_id
    FROM public.workers
    WHERE id = NEW.assigned_worker_id;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.sync_complaint_worker_user() FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sync_complaint_worker_user() TO service_role;

DROP TRIGGER IF EXISTS complaints_sync_worker_user ON public.complaints;
CREATE TRIGGER complaints_sync_worker_user
BEFORE INSERT OR UPDATE OF assigned_worker_id ON public.complaints
FOR EACH ROW EXECUTE FUNCTION public.sync_complaint_worker_user();

CREATE OR REPLACE FUNCTION public.backfill_worker_assignments()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.user_id IS DISTINCT FROM OLD.user_id THEN
    UPDATE public.complaints
    SET assigned_worker_user_id = NEW.user_id
    WHERE assigned_worker_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.backfill_worker_assignments() FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.backfill_worker_assignments() TO service_role;

DROP TRIGGER IF EXISTS workers_backfill_assignments ON public.workers;
CREATE TRIGGER workers_backfill_assignments
AFTER UPDATE OF user_id ON public.workers
FOR EACH ROW EXECUTE FUNCTION public.backfill_worker_assignments();

DROP POLICY IF EXISTS "worker reads assigned complaints" ON public.complaints;
CREATE POLICY "worker reads assigned complaints" ON public.complaints
FOR SELECT TO authenticated
USING (assigned_worker_user_id = auth.uid());

DROP POLICY IF EXISTS "worker updates assigned complaints" ON public.complaints;
CREATE POLICY "worker updates assigned complaints" ON public.complaints
FOR UPDATE TO authenticated
USING (assigned_worker_user_id = auth.uid())
WITH CHECK (assigned_worker_user_id = auth.uid());

DROP POLICY IF EXISTS "worker reads assigned events" ON public.complaint_events;
CREATE POLICY "worker reads assigned events" ON public.complaint_events
FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.complaints c
  WHERE c.id = complaint_events.complaint_id
    AND c.assigned_worker_user_id = auth.uid()
));

DROP POLICY IF EXISTS "worker adds assigned events" ON public.complaint_events;
CREATE POLICY "worker adds assigned events" ON public.complaint_events
FOR INSERT TO authenticated
WITH CHECK (EXISTS (
  SELECT 1 FROM public.complaints c
  WHERE c.id = complaint_events.complaint_id
    AND c.assigned_worker_user_id = auth.uid()
));

DROP POLICY IF EXISTS "worker reads assigned complaint photos" ON storage.objects;
CREATE POLICY "worker reads assigned complaint photos" ON storage.objects
FOR SELECT TO authenticated
USING (
  bucket_id = 'complaint-photos'
  AND EXISTS (
    SELECT 1 FROM public.complaints c
    WHERE c.photo_url = storage.objects.name
      AND c.assigned_worker_user_id = auth.uid()
  )
);