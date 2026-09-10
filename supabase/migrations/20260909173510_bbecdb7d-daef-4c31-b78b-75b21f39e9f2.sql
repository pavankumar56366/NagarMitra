REVOKE ALL ON FUNCTION public.citizen_verify(uuid, boolean, text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.citizen_verify(uuid, boolean, text) TO service_role;