import { type ReactNode, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  FileBarChart,
  LayoutDashboard,
  ListChecks,
  LogOut,
  Map as MapIcon,
  Menu,
  Settings,
  Trash2,
  Users,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { myAccessQuery, zonesQuery } from "@/lib/queries";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "/overview", label: "Overview", icon: LayoutDashboard },
  { to: "/complaints", label: "Complaints", icon: ListChecks },
  { to: "/map", label: "Waste Map", icon: MapIcon },
  { to: "/workers", label: "Workers", icon: Users },
  { to: "/zones", label: "Zones", icon: Trash2 },
  { to: "/escalations", label: "Escalations", icon: AlertTriangle },
  { to: "/reports", label: "Reports", icon: FileBarChart },
  { to: "/settings", label: "SLA Settings", icon: Settings },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const { data: access } = useQuery(myAccessQuery);
  const { data: zones } = useQuery(zonesQuery);

  const zoneName =
    access?.role === "zonal_officer"
      ? (zones?.find((z) => z.id === access.zoneId)?.name ?? "Unassigned ward")
      : "City-wide";

  async function signOut() {
    await supabase.auth.signOut();
    navigate({ to: "/auth" });
  }

  return (
    <div className="min-h-screen bg-background">
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 w-60 shrink-0 border-r border-border bg-sidebar transition-transform lg:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex h-16 items-center gap-2 px-6">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Trash2 className="h-4 w-4" />
          </span>
          <span className="font-display text-base font-semibold leading-tight">
            NagarMitra
            <span className="block text-[11px] font-normal text-muted-foreground">
              Authority Dashboard
            </span>
          </span>
        </div>
        <nav className="mt-2 space-y-1 px-3">
          {NAV.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              onClick={() => setOpen(false)}
              className="flex items-center gap-3 rounded-md border-l-[3px] border-transparent px-3 py-2.5 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              activeProps={{
                className:
                  "flex items-center gap-3 rounded-md border-l-[3px] border-primary bg-accent px-3 py-2.5 text-sm font-semibold text-foreground",
              }}
              activeOptions={{ exact: false }}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </Link>
          ))}
        </nav>
      </aside>

      {open ? (
        <button
          aria-label="Close menu"
          className="fixed inset-0 z-30 bg-foreground/40 lg:hidden"
          onClick={() => setOpen(false)}
        />
      ) : null}

      <div className="lg:pl-60">
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between gap-4 border-b border-border bg-card px-4 lg:px-6">
          <button
            className="rounded-md p-2 text-muted-foreground hover:bg-accent lg:hidden"
            onClick={() => setOpen(true)}
            aria-label="Open menu"
          >
            <Menu className="h-5 w-5" />
          </button>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">{zoneName}</p>
            <p className="truncate text-xs text-muted-foreground">
              {access?.role === "zonal_officer" ? "Zonal Officer" : "Municipal Commissioner"}
              {access?.email ? ` · ${access.email}` : ""}
            </p>
          </div>
          <button
            onClick={signOut}
            className="inline-flex items-center gap-2 rounded-xl border border-border px-3 py-2 text-sm font-semibold transition-colors hover:bg-accent"
          >
            <LogOut className="h-4 w-4" />
            <span className="hidden sm:inline">Sign out</span>
          </button>
        </header>
        <main className="mx-auto w-full max-w-[1440px] px-4 py-6 lg:px-6">{children}</main>
      </div>
    </div>
  );
}
