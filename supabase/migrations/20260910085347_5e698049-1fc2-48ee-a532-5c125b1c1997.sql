CREATE OR REPLACE FUNCTION public.citizen_delete_report(_complaint_id uuid, _reason text DEFAULT NULL)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE c record; uid uuid := auth.uid();
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'You need to be signed in.';
  END IF;

  SELECT * INTO c FROM public.complaints
   WHERE id = _complaint_id AND citizen_id = uid;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Report not found';
  END IF;

  IF c.deleted_at IS NOT NULL OR c.status = 'cancelled' THEN
    RAISE EXCEPTION 'This report has already been withdrawn.';
  END IF;

  IF c.status = 'pending' THEN
    DELETE FROM public.citizen_verifications WHERE complaint_id = c.id;
    DELETE FROM public.escalations WHERE complaint_id = c.id;
    DELETE FROM public.complaint_events WHERE complaint_id = c.id;
    DELETE FROM public.complaints WHERE id = c.id AND citizen_id = uid;
    RETURN 'deleted';
  END IF;

  IF c.status IN ('assigned','in_progress','escalated','reopened','resolved') THEN
    UPDATE public.complaints
       SET status = 'cancelled',
           deleted_at = now(),
           deleted_by = uid,
           deletion_reason = NULLIF(btrim(COALESCE(_reason,'')),''),
           sla_deadline = NULL
     WHERE id = c.id AND citizen_id = uid;

    INSERT INTO public.complaint_events (complaint_id, actor, event_type, detail)
    VALUES (c.id, 'citizen', 'cancelled',
            COALESCE(NULLIF(btrim(COALESCE(_reason,'')),''),
                     'Citizen withdrew this report.'));
    RETURN 'withdrawn';
  END IF;

  RAISE EXCEPTION 'This report is already being processed and cannot be permanently deleted.';
END;
$$;

REVOKE ALL ON FUNCTION public.citizen_delete_report(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.citizen_delete_report(uuid, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.citizen_delete_report(uuid, text) TO authenticated;