ALTER TABLE public.workers ADD COLUMN IF NOT EXISTS user_id uuid UNIQUE;

CREATE OR REPLACE FUNCTION public.current_worker_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT id FROM public.workers WHERE user_id = auth.uid() LIMIT 1;
$$;
REVOKE ALL ON FUNCTION public.current_worker_id() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.current_worker_id() TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
FOR SELECT TO authenticated
USING (user_id = auth.uid());

DROP POLICY IF EXISTS "worker reads assigned complaints" ON public.complaints;
CREATE POLICY "worker reads assigned complaints" ON public.complaints
FOR SELECT TO authenticated
USING (assigned_worker_id = public.current_worker_id());

DROP POLICY IF EXISTS "worker updates assigned complaints" ON public.complaints;
CREATE POLICY "worker updates assigned complaints" ON public.complaints
FOR UPDATE TO authenticated
USING (assigned_worker_id = public.current_worker_id())
WITH CHECK (assigned_worker_id = public.current_worker_id());

DROP POLICY IF EXISTS "worker reads assigned events" ON public.complaint_events;
CREATE POLICY "worker reads assigned events" ON public.complaint_events
FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.complaints c
  WHERE c.id = complaint_events.complaint_id
    AND c.assigned_worker_id = public.current_worker_id()
));

DROP POLICY IF EXISTS "worker adds assigned events" ON public.complaint_events;
CREATE POLICY "worker adds assigned events" ON public.complaint_events
FOR INSERT TO authenticated
WITH CHECK (EXISTS (
  SELECT 1 FROM public.complaints c
  WHERE c.id = complaint_events.complaint_id
    AND c.assigned_worker_id = public.current_worker_id()
));

DROP POLICY IF EXISTS "worker reads assigned complaint photos" ON storage.objects;
CREATE POLICY "worker reads assigned complaint photos" ON storage.objects
FOR SELECT TO authenticated
USING (
  bucket_id = 'complaint-photos'
  AND EXISTS (
    SELECT 1 FROM public.complaints c
    WHERE c.photo_url = storage.objects.name
      AND c.assigned_worker_id = public.current_worker_id()
  )
);