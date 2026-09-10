import { createFileRoute, Link, Outlet, redirect, useRouterState } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ClipboardList, HardHat, Truck, UserCog } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { myWorkerQuery } from "@/lib/queries";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/staff")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });
    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", data.user.id);
    const isWorker = (roles ?? []).some((r) => r.role === "worker");
    if (!isWorker) {
      const isOfficer = (roles ?? []).some(
        (r) => r.role === "commissioner" || r.role === "zonal_officer",
      );
      throw redirect({ to: isOfficer ? "/overview" : "/app" });
    }
    return { user: data.user };
  },
  component: StaffShell,
});

const NAV: {
  to: "/staff" | "/staff/reports" | "/staff/profile";
  label: string;
  icon: typeof Truck;
  exact?: boolean;
}[] = [
  { to: "/staff", label: "Shift", icon: Truck, exact: true },
  { to: "/staff/reports", label: "Job list", icon: ClipboardList },
  { to: "/staff/profile", label: "Crew", icon: UserCog },
];

const DUTY_LABEL: Record<string, string> = {
  on_duty: "On duty",
  on_break: "On break",
  off_duty: "Off duty",
};

function StaffShell() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { data: worker } = useQuery(myWorkerQuery);
  const duty = worker?.availability ?? "on_duty";

  return (
    <div className="field-theme mx-auto flex min-h-screen w-full max-w-[520px] flex-col">
      <header className="flex items-center gap-3 border-b-2 border-primary/60 bg-card px-4 py-4">
        <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary text-primary-foreground">
          <HardHat className="h-6 w-6" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-display text-sm font-bold uppercase tracking-[0.14em]">
            Field Crew
          </p>
          <p className="truncate text-xs text-muted-foreground">
            {worker?.name ?? "Crew member"}
          </p>
        </div>
        <span
          className={cn(
            "rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-wider",
            duty === "on_duty"
              ? "bg-primary text-primary-foreground"
              : "border border-border text-muted-foreground",
          )}
        >
          {DUTY_LABEL[duty] ?? duty}
        </span>
      </header>

      <main className="flex-1 px-4 pb-28 pt-5">
        <Outlet />
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-20 mx-auto flex w-full max-w-[520px] items-stretch border-t-2 border-primary/50 bg-card px-2 pb-[env(safe-area-inset-bottom)]">
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
                "flex flex-1 flex-col items-center gap-1 py-3 text-[11px] font-bold uppercase tracking-wide",
                active ? "text-primary" : "text-muted-foreground",
              )}
            >
              <Icon className="h-6 w-6" />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
