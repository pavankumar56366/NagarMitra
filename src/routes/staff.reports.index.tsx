import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Navigation } from "lucide-react";
import { complaintsQuery } from "@/lib/queries";
import { StatusBadge, PriorityBadge } from "@/components/status-badge";
import { SlaChip } from "@/components/sla-chip";
import { CATEGORY_LABEL, PRIORITY_ORDER, isOpen, relativeTime, slaState } from "@/lib/waste";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/staff/reports/")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Job List — NagarMitra Field Crew" },
      {
        name: "description",
        content:
          "Every cleanup job assigned to you, sorted by priority and deadline, with one-tap directions to each site.",
      },
      { property: "og:title", content: "Job List — NagarMitra Field Crew" },
      { property: "og:description", content: "Your assigned cleanup jobs with directions." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: WorkerJobs,
});

const FILTERS = ["To clear", "Late", "Done", "All"] as const;
type Filter = (typeof FILTERS)[number];

function WorkerJobs() {
  const { data: complaints = [], isLoading } = useQuery(complaintsQuery);
  const [filter, setFilter] = useState<Filter>("To clear");
  const [search, setSearch] = useState("");

  const list = complaints
    .filter((c) => {
      if (filter === "To clear" && !isOpen(c.status)) return false;
      if (filter === "Late" && !slaState(c.sla_start, c.sla_deadline)?.breached) return false;
      if (filter === "Done" && c.status !== "resolved" && c.status !== "closed") return false;
      const q = search.trim().toLowerCase();
      if (!q) return true;
      return (
        c.reference.toLowerCase().includes(q) ||
        c.address.toLowerCase().includes(q) ||
        (c.ai_label ?? "").toLowerCase().includes(q)
      );
    })
    .sort((a, b) => {
      const p = PRIORITY_ORDER.indexOf(a.priority) - PRIORITY_ORDER.indexOf(b.priority);
      if (p !== 0) return p;
      return (a.sla_deadline ?? "").localeCompare(b.sla_deadline ?? "");
    });

  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-display text-xl font-bold uppercase tracking-wide">Job list</h1>
        <p className="text-sm text-muted-foreground">
          Only cleanups dispatched to you. Highest priority first.
        </p>
      </div>

      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search job number or street"
        className="h-12 w-full rounded-xl border-2 border-border bg-card px-4 text-sm"
      />

      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
        {FILTERS.map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={cn(
              "shrink-0 rounded-full border-2 px-4 py-2 text-sm font-bold",
              filter === f
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border text-muted-foreground",
            )}
          >
            {f}
          </button>
        ))}
      </div>

      {isLoading && <p className="text-sm text-muted-foreground">Loading your jobs…</p>}

      {!isLoading && list.length === 0 && (
        <p className="card-surface p-5 text-sm text-muted-foreground">
          Nothing here. New jobs appear as soon as the ward dispatches them to you.
        </p>
      )}

      <ul className="space-y-3">
        {list.map((c) => (
          <li key={c.id} className="card-surface space-y-3 p-4">
            <Link to="/staff/reports/$id" params={{ id: c.id }} className="block space-y-2">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-display font-bold">
                    {c.ai_label || CATEGORY_LABEL[c.waste_category]}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {c.reference} · {relativeTime(c.created_at)}
                  </p>
                </div>
                <StatusBadge status={c.status} />
              </div>
              {c.address && <p className="text-sm text-muted-foreground">{c.address}</p>}
              <div className="flex flex-wrap items-center gap-2">
                <PriorityBadge priority={c.priority} />
                <SlaChip start={c.sla_start} deadline={c.sla_deadline} />
              </div>
            </Link>
            <a
              href={`https://www.google.com/maps/dir/?api=1&destination=${c.lat},${c.lng}`}
              target="_blank"
              rel="noreferrer"
              className="flex h-11 items-center justify-center gap-2 rounded-xl border-2 border-border text-sm font-bold"
            >
              <Navigation className="h-4 w-4" /> Directions
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
