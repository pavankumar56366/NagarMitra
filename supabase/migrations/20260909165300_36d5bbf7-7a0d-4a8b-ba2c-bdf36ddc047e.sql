
CREATE OR REPLACE FUNCTION public.is_staff()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_role(auth.uid(),'commissioner') OR public.has_role(auth.uid(),'zonal_officer');
$$;
REVOKE ALL ON FUNCTION public.is_staff() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.is_staff() TO authenticated;

DROP POLICY IF EXISTS "complaint photos insert own folder" ON storage.objects;
CREATE POLICY "complaint photos insert own folder" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'complaint-photos' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "complaint photos readable" ON storage.objects;
CREATE POLICY "complaint photos readable" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'complaint-photos'
         AND ((storage.foldername(name))[1] = auth.uid()::text OR public.is_staff()));
