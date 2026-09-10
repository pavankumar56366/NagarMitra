import { createFileRoute, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/")({
  ssr: false,
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw redirect({ to: "/auth" });
    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", data.user.id);
    const isStaff = (roles ?? []).some(
      (r) => r.role === "commissioner" || r.role === "zonal_officer",
    );
    const isWorker = (roles ?? []).some((r) => r.role === "worker");
    throw redirect({ to: isStaff ? "/overview" : isWorker ? "/staff" : "/app" });
  },
  component: () => null,
});
