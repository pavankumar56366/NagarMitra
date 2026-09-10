ALTER FUNCTION public.has_role(uuid, public.app_role) SECURITY INVOKER;
ALTER FUNCTION public.current_zone() SECURITY INVOKER;
ALTER FUNCTION public.can_view_zone(uuid) SECURITY INVOKER;
ALTER FUNCTION public.is_staff() SECURITY INVOKER;
REVOKE ALL ON FUNCTION public.citizen_verify(uuid, boolean, text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.citizen_verify(uuid, boolean, text) TO service_role;

ALTER TABLE public.workers ADD COLUMN IF NOT EXISTS user_id uuid UNIQUE;

CREATE OR REPLACE FUNCTION public.current_worker_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  SELECT id FROM public.workers WHERE user_id = auth.uid() LIMIT 1;
$$;
REVOKE ALL ON FUNCTION public.current_worker_id() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.current_worker_id() TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _role public.app_role;
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (NEW.id, COALESCE(NEW.email,''), COALESCE(NEW.raw_user_meta_data->>'full_name',''))
  ON CONFLICT (id) DO NOTHING;

  CASE COALESCE(NEW.raw_user_meta_data->>'account_type','citizen')
    WHEN 'staff' THEN _role := 'commissioner';
    WHEN 'worker' THEN _role := 'worker';
    ELSE _role := 'citizen';
  END CASE;

  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, _role)
  ON CONFLICT DO NOTHING;

  IF _role = 'worker' THEN
    INSERT INTO public.workers (name, phone, user_id, availability)
    VALUES (
      COALESCE(NULLIF(NEW.raw_user_meta_data->>'full_name',''), split_part(COALESCE(NEW.email,'Worker'),'@',1)),
      COALESCE(NEW.raw_user_meta_data->>'phone',''),
      NEW.id,
      'on_duty'
    )
    ON CONFLICT (user_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO service_role;

DROP POLICY IF EXISTS "worker reads own record" ON public.workers;
CREATE POLICY "worker reads own record" ON public.workers
FOR SELECT TO authenticated USING (user_id = auth.uid());

ALTER TABLE public.complaints ADD COLUMN IF NOT EXISTS assigned_worker_user_id uuid;

UPDATE public.complaints c
SET assigned_worker_user_id = w.user_id
FROM public.workers w
WHERE c.assigned_worker_id = w.id
  AND c.assigned_worker_user_id IS DISTINCT FROM w.user_id;

CREATE OR REPLACE FUNCTION public.sync_complaint_worker_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.assigned_worker_id IS NULL THEN
    NEW.assigned_worker_user_id := NULL;
  ELSE
    SELECT user_id INTO NEW.assigned_worker_user_id
    FROM public.workers WHERE id = NEW.assigned_worker_id;
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
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
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
FOR SELECT TO authenticated USING (assigned_worker_user_id = auth.uid());

DROP POLICY IF EXISTS "worker updates assigned complaints" ON public.complaints;
CREATE POLICY "worker updates assigned complaints" ON public.complaints
FOR UPDATE TO authenticated
USING (assigned_worker_user_id = auth.uid())
WITH CHECK (assigned_worker_user_id = auth.uid());

DROP POLICY IF EXISTS "worker reads assigned events" ON public.complaint_events;
CREATE POLICY "worker reads assigned events" ON public.complaint_events
FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.complaints c
  WHERE c.id = complaint_events.complaint_id AND c.assigned_worker_user_id = auth.uid()));

DROP POLICY IF EXISTS "worker adds assigned events" ON public.complaint_events;
CREATE POLICY "worker adds assigned events" ON public.complaint_events
FOR INSERT TO authenticated
WITH CHECK (EXISTS (SELECT 1 FROM public.complaints c
  WHERE c.id = complaint_events.complaint_id AND c.assigned_worker_user_id = auth.uid()));

DROP POLICY IF EXISTS "worker reads assigned complaint photos" ON storage.objects;
CREATE POLICY "worker reads assigned complaint photos" ON storage.objects
FOR SELECT TO authenticated
USING (
  bucket_id = 'complaint-photos'
  AND EXISTS (SELECT 1 FROM public.complaints c
    WHERE c.photo_url = storage.objects.name AND c.assigned_worker_user_id = auth.uid())
);

CREATE POLICY "worker updates own duty status" ON public.workers
FOR UPDATE TO authenticated
USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
GRANT UPDATE (availability) ON public.workers TO authenticated;

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS avatar_url text;

CREATE POLICY "avatars own read" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "avatars own insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "avatars own update" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text)
  WITH CHECK (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "avatars own delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

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