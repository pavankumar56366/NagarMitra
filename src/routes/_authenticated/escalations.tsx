import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { StatusBadge, PriorityBadge } from "@/components/status-badge";
import { SlaChip } from "@/components/sla-chip";
import { StatCard } from "@/components/stat-card";
import { complaintsQuery, escalationsQuery, zonesQuery } from "@/lib/queries";
import { formatDateTime, isOpen } from "@/lib/waste";

export const Route = createFileRoute("/_authenticated/escalations")({
  head: () => ({
    meta: [
      { title: "Escalations — NagarMitra Waste Dashboard" },
      {
        name: "description",
        content:
          "Every SLA breach and escalation level with the complaint, ward and time overdue, ordered by severity.",
      },
      { property: "og:title", content: "Escalations — NagarMitra Waste Dashboard" },
      {
        property: "og:description",
        content: "Track SLA breaches and escalation levels across the city.",
      },
    ],
  }),
  component: EscalationsPage,
});

function EscalationsPage() {
  const { data: complaints = [] } = useQuery(complaintsQuery);
  const { data: escalations = [] } = useQuery(escalationsQuery);
  const { data: zones = [] } = useQuery(zonesQuery);

  const byId = new Map(complaints.map((c) => [c.id, c]));
  const zoneName = (id: string | null) => zones.find((z) => z.id === id)?.name ?? "Unzoned";

  const openEscalated = complaints.filter((c) => c.escalation_level > 0 && isOpen(c.status));
  const rate = complaints.length
    ? Math.round((complaints.filter((c) => c.escalation_level > 0).length / complaints.length) * 100)
    : 0;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-2xl font-bold">Escalations</h1>
        <p className="text-sm text-muted-foreground">
          SLA breaches automatically escalate and extend the next deadline
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Open escalated" value={openEscalated.length} />
        <StatCard
          label="Escalation rate"
          value={`${rate}%`}
          hint="Target below 15%"
          accent={rate < 15 ? "#2A7C13" : "#C00707"}
        />
        <StatCard label="Escalation events" value={escalations.length} />
      </div>

      <div className="card-surface divide-y divide-border">
        {escalations.length === 0 ? (
          <div className="px-5 py-12 text-center">
            <p className="font-display text-base font-semibold">No escalations logged</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Complaints are being resolved inside their SLA windows.
            </p>
          </div>
        ) : (
          escalations.map((e) => {
            const c = byId.get(e.complaint_id);
            if (!c) return null;
            return (
              <Link
                key={e.id}
                to="/complaints/$id"
                params={{ id: c.id }}
                className="flex flex-wrap items-center gap-3 px-5 py-4 transition-colors hover:bg-accent"
              >
                <span className="rounded-full bg-destructive/10 px-2.5 py-1 text-[11px] font-bold uppercase text-destructive">
                  L{e.from_level} → L{e.to_level}
                </span>
                <span className="w-28 shrink-0 font-mono text-xs text-muted-foreground">
                  {c.reference}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{c.address}</span>
                  <span className="block text-xs text-muted-foreground">
                    {zoneName(c.zone_id)} · {e.reason}
                  </span>
                </span>
                <PriorityBadge priority={c.priority} />
                <StatusBadge status={c.status} />
                <SlaChip start={c.sla_start} deadline={c.sla_deadline} />
                <span className="text-xs text-muted-foreground">
                  {formatDateTime(e.escalated_at)}
                </span>
              </Link>
            );
          })
        )}
      </div>
    </div>
  );
}
