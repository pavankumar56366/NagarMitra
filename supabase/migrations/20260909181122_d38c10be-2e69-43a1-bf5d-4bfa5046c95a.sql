CREATE POLICY "worker updates own duty status"
ON public.workers
FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

GRANT UPDATE (availability) ON public.workers TO authenticated;