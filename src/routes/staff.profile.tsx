import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { HardHat, LogOut, Phone } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { complaintsQuery, myAccessQuery, myWorkerQuery, zonesQuery } from "@/lib/queries";
import { DutyToggle } from "@/components/duty-toggle";
import { AvatarUpload } from "@/components/avatar-upload";

import { isOpen, slaState } from "@/lib/waste";

export const Route = createFileRoute("/staff/profile")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Crew Card — NagarMitra Field Crew" },
      {
        name: "description",
        content: "Your crew card: duty status, ward assignment, cleanup record and sign out.",
      },
      { property: "og:title", content: "Crew Card — NagarMitra Field Crew" },
      { property: "og:description", content: "Duty status, ward and cleanup record for the crew." },
      { property: "og:type", content: "profile" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: CrewCard,
});

function CrewCard() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: me } = useQuery(myAccessQuery);
  const { data: worker } = useQuery(myWorkerQuery);
  const { data: zones = [] } = useQuery(zonesQuery);
  const { data: complaints = [] } = useQuery(complaintsQuery);

  const open = complaints.filter((c) => isOpen(c.status));
  const breached = open.filter((c) => slaState(c.sla_start, c.sla_deadline)?.breached);
  const cleared = complaints.filter((c) => c.status === "resolved" || c.status === "closed");
  const scope = zones.find((z) => z.id === worker?.zone_id)?.name ?? "Awaiting ward assignment";

  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="space-y-5">
      <h1 className="font-display text-xl font-bold uppercase tracking-wide">Crew card</h1>

      <div className="card-surface flex items-start gap-4 border-2 border-primary/60 p-5">
        <AvatarUpload />
        <div className="min-w-0 flex-1 space-y-1">
          <p className="flex items-center gap-2 font-display text-lg font-bold">
            <HardHat className="h-5 w-5 text-primary" />
            {worker?.name || me?.fullName || "Crew member"}
          </p>
          <p className="truncate text-sm text-muted-foreground">{me?.email}</p>
          <p className="text-sm text-muted-foreground">Ward: {scope}</p>
          {worker?.phone ? (
            <p className="flex items-center gap-2 pt-1 text-sm text-muted-foreground">
              <Phone className="h-4 w-4" /> {worker.phone}
            </p>
          ) : null}
        </div>
      </div>


      <section className="card-surface space-y-3 p-4">
        <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
          Duty status
        </p>
        <DutyToggle />
      </section>

      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="card-surface p-4">
          <p className="font-display text-xl font-bold">{open.length}</p>
          <p className="text-[11px] uppercase tracking-wide text-muted-foreground">To clear</p>
        </div>
        <div className="card-surface p-4">
          <p className="font-display text-xl font-bold">{cleared.length}</p>
          <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Cleared</p>
        </div>
        <div className="card-surface p-4">
          <p className="font-display text-xl font-bold text-destructive">{breached.length}</p>
          <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Late</p>
        </div>
      </div>

      <div className="card-surface p-4 text-sm text-muted-foreground">
        Rating from the ward:{" "}
        <span className="font-bold text-foreground">
          {(worker?.performance_score ?? 0).toFixed(1)} / 5
        </span>
      </div>

      <button
        onClick={signOut}
        className="flex h-12 w-full items-center justify-center gap-2 rounded-xl border-2 border-border font-bold"
      >
        <LogOut className="h-4 w-4" /> Sign out
      </button>
    </div>
  );
}
