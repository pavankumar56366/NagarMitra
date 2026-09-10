import { createFileRoute, Link, Outlet, redirect, useRouterState } from "@tanstack/react-router";
import { Camera, Home, Recycle, ClipboardList, User } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { useI18n } from "@/lib/i18n";

export const Route = createFileRoute("/app")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });
    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", data.user.id);
    const isStaff = (roles ?? []).some(
      (r) => r.role === "commissioner" || r.role === "zonal_officer",
    );
    if (isStaff) throw redirect({ to: "/overview" });
    if ((roles ?? []).some((r) => r.role === "worker")) throw redirect({ to: "/staff" });
    return { user: data.user };
  },
  component: CitizenShell,
});

const NAV: {
  to: "/app" | "/app/segregate" | "/app/report" | "/app/reports" | "/app/profile";
  labelKey: string;
  icon: typeof Home;
  exact?: boolean;
}[] = [
  { to: "/app", labelKey: "nav.home", icon: Home, exact: true },
  { to: "/app/segregate", labelKey: "nav.segregate", icon: Recycle },
  { to: "/app/report", labelKey: "nav.report", icon: Camera },
  { to: "/app/reports", labelKey: "nav.reports", icon: ClipboardList },
  { to: "/app/profile", labelKey: "nav.profile", icon: User },
];


function CitizenShell() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { t } = useI18n();

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-[520px] flex-col bg-background">
      <main className="flex-1 px-4 pb-28 pt-6">
        <Outlet />
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-20 mx-auto flex w-full max-w-[520px] items-stretch border-t border-border bg-card px-2 pb-[env(safe-area-inset-bottom)]">
        {NAV.map((item) => {
          const active = item.exact
            ? pathname === item.to
            : pathname === item.to || pathname.startsWith(`${item.to}/`);
          const Icon = item.icon;
          return (
            <Link
              key={item.to}
              to={item.to}
              className={cn(
                "flex flex-1 flex-col items-center gap-1 py-3 text-[11px] font-semibold",
                active ? "text-primary" : "text-muted-foreground",
              )}
            >
              <Icon className="h-5 w-5" />
              {t(item.labelKey)}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
