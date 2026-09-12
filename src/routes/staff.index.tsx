import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ChevronRight, Navigation, Timer } from "lucide-react";
import { complaintsQuery, myWorkerQuery, zonesQuery } from "@/lib/queries";
import { StatusBadge, PriorityBadge } from "@/components/status-badge";
import { SlaChip } from "@/components/sla-chip";
import { DutyToggle } from "@/components/duty-toggle";
import { CATEGORY_LABEL, PRIORITY_ORDER, isOpen, relativeTime, slaState } from "@/lib/waste";
import { ScoreCard, ScoreHistory, useMyScore } from "@/components/score-panel";

export const Route = createFileRoute("/staff/")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Shift Board — NagarMitra Field Crew" },
      {
        name: "description",
        content:
          "Your shift board: duty status, your next cleanup job, directions to the site and deadlines you must beat.",
      },
      { property: "og:title", content: "Shift Board — NagarMitra Field Crew" },
      {
        property: "og:description",
        content: "Duty status, next job and directions for the cleanup crew.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: WorkerShift,
});

function WorkerShift() {
  const { data: worker } = useQuery(myWorkerQuery);
  const { data: complaints = [] } = useQuery(complaintsQuery);
  const { data: zones = [] } = useQuery(zonesQuery);
  const score = useMyScore();

  const open = complaints.filter((c) => isOpen(c.status));
  const breached = open.filter((c) => slaState(c.sla_start, c.sla_deadline)?.breached);
  const doneToday = complaints.filter(
    (c) =>
      (c.status === "resolved" || c.status === "closed") &&
      c.resolved_at &&
      new Date(c.resolved_at).toDateString() === new Date().toDateString(),
  );

  const queue = [...open].sort((a, b) => {
    const p = PRIORITY_ORDER.indexOf(a.priority) - PRIORITY_ORDER.indexOf(b.priority);
    if (p !== 0) return p;
    return (a.sla_deadline ?? "").localeCompare(b.sla_deadline ?? "");
  });
  const next = queue[0];
  const zoneName = zones.find((z) => z.id === worker?.zone_id)?.name ?? "Awaiting ward assignment";

  return (
    <div className="space-y-5">
      <section className="card-surface space-y-3 p-4">
        <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
          Duty status · {zoneName}
        </p>
        <DutyToggle />
      </section>

      <ScoreCard
        title="Performance score"
        points={score.points}
        stats={[
          { label: "Complaints completed", value: score.completedJobs },
          { label: "Done today", value: doneToday.length },
        ]}
      />

      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="card-surface p-3">
          <p className="font-display text-2xl font-bold">{open.length}</p>
          <p className="text-[11px] uppercase tracking-wide text-muted-foreground">To clear</p>
        </div>
        <div className="card-surface p-3">
          <p className="font-display text-2xl font-bold text-destructive">{breached.length}</p>
          <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Late</p>
        </div>
        <div className="card-surface p-3">
          <p className="font-display text-2xl font-bold">{doneToday.length}</p>
          <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Done today</p>
        </div>
      </div>

      <section className="space-y-2">
        <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
          Next job
        </h2>
        {next ? (
          <div className="card-surface space-y-3 border-2 border-primary/70 p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-display text-lg font-bold">
                  {next.ai_label || CATEGORY_LABEL[next.waste_category]}
                </p>
                <p className="text-xs text-muted-foreground">
                  {next.address || `${next.lat.toFixed(4)}, ${next.lng.toFixed(4)}`}
                </p>
              </div>
              <PriorityBadge priority={next.priority} />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge status={next.status} />
              <SlaChip start={next.sla_start} deadline={next.sla_deadline} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <a
                href={`https://www.google.com/maps/dir/?api=1&destination=${next.lat},${next.lng}`}
                target="_blank"
                rel="noreferrer"
                className="flex h-12 items-center justify-center gap-2 rounded-xl border-2 border-border font-bold"
              >
                <Navigation className="h-4 w-4" /> Navigate
              </a>
              <Link
                to="/staff/reports/$id"
                params={{ id: next.id }}
                className="flex h-12 items-center justify-center gap-2 rounded-xl bg-primary font-bold text-primary-foreground"
              >
                Open job <ChevronRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        ) : (
          <p className="card-surface p-5 text-sm text-muted-foreground">
            No jobs assigned to you right now. Keep your duty status on so the ward can dispatch you.
          </p>
        )}
      </section>

      {queue.length > 1 && (
        <section className="space-y-2">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Rest of the run
            </h2>
            <Link to="/staff/reports" className="text-sm font-bold text-primary">
              Job list
            </Link>
          </div>
          <ul className="space-y-2">
            {queue.slice(1, 5).map((c) => (
              <li key={c.id}>
                <Link
                  to="/staff/reports/$id"
                  params={{ id: c.id }}
                  className="card-surface flex items-center gap-3 p-4"
                >
                  <Timer className="h-5 w-5 text-primary" />
                  <span className="flex-1">
                    <span className="block text-sm font-bold">
                      {c.ai_label || CATEGORY_LABEL[c.waste_category]}
                    </span>
                    <span className="block text-xs text-muted-foreground">
                      {c.address || c.reference} · {relativeTime(c.created_at)}
                    </span>
                  </span>
                  <ChevronRight className="h-5 w-5 text-muted-foreground" />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
