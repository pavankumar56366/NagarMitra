ALTER FUNCTION public.has_role(uuid, public.app_role) SECURITY INVOKER;
ALTER FUNCTION public.current_zone() SECURITY INVOKER;
ALTER FUNCTION public.can_view_zone(uuid) SECURITY INVOKER;
ALTER FUNCTION public.is_staff() SECURITY INVOKER;
REVOKE ALL ON FUNCTION public.citizen_verify(uuid, boolean, text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.citizen_verify(uuid, boolean, text) TO service_role;