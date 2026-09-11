import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Search } from "lucide-react";
import { StatusBadge, PriorityBadge } from "@/components/status-badge";
import { SlaChip } from "@/components/sla-chip";
import { complaintsQuery, workersQuery, zonesQuery } from "@/lib/queries";
import {
  CATEGORY_LABEL,
  PRIORITY_LABEL,
  PRIORITY_ORDER,
  STATUS_LABEL,
  STATUS_ORDER,
  relativeTime,
  type ComplaintStatus,
  type Priority,
} from "@/lib/waste";

export const Route = createFileRoute("/_authenticated/complaints/")({
  head: () => ({
    meta: [
      { title: "Complaints Queue — NagarMitra Waste Dashboard" },
      {
        name: "description",
        content:
          "Filter, triage and assign citizen waste complaints by ward, status, priority and SLA state.",
      },
      { property: "og:title", content: "Complaints Queue — NagarMitra Waste Dashboard" },
      {
        property: "og:description",
        content: "Triage and assign citizen waste complaints across every municipal ward.",
      },
    ],
  }),
  component: ComplaintsPage,
});

const selectClass =
  "h-10 rounded-[10px] border border-input bg-card px-3 text-sm outline-none focus:border-primary";

function ComplaintsPage() {
  const { data: complaints = [], isLoading } = useQuery(complaintsQuery);
  const { data: zones = [] } = useQuery(zonesQuery);
  const { data: workers = [] } = useQuery(workersQuery);

  const [q, setQ] = useState("");
  const [status, setStatus] = useState<ComplaintStatus | "all">("all");
  const [priority, setPriority] = useState<Priority | "all">("all");
  const [zone, setZone] = useState("all");
  const [breachOnly, setBreachOnly] = useState(false);

  const rows = useMemo(() => {
    const term = q.trim().toLowerCase();
    return complaints.filter((c) => {
      if (status !== "all" && c.status !== status) return false;
      if (priority !== "all" && c.priority !== priority) return false;
      if (zone !== "all" && c.zone_id !== zone) return false;
      if (
        breachOnly &&
        !(c.sla_deadline && new Date(c.sla_deadline).getTime() < Date.now())
      )
        return false;
      if (term) {
        const hay = `${c.reference} ${c.address} ${c.citizen_name}`.toLowerCase();
        if (!hay.includes(term)) return false;
      }
      return true;
    });
  }, [complaints, q, status, priority, zone, breachOnly]);

  const zoneName = (id: string | null) => zones.find((z) => z.id === id)?.name ?? "Unzoned";
  const workerName = (id: string | null) =>
    workers.find((w) => w.id === id)?.name ?? "Unassigned";

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold">Complaints</h1>
          <p className="text-sm text-muted-foreground">
            {rows.length} of {complaints.length} complaints shown
          </p>
        </div>
      </div>

      <div className="card-surface flex flex-wrap items-center gap-3 p-4">
        <div className="relative min-w-[220px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search reference, address or citizen"
            aria-label="Search complaints"
            className="h-10 w-full rounded-[10px] border border-input bg-card pl-9 pr-3 text-sm outline-none focus:border-primary"
          />
        </div>
        <select
          aria-label="Filter by status"
          className={selectClass}
          value={status}
          onChange={(e) => setStatus(e.target.value as ComplaintStatus | "all")}
        >
          <option value="all">All statuses</option>
          {STATUS_ORDER.map((s) => (
            <option key={s} value={s}>
              {STATUS_LABEL[s]}
            </option>
          ))}
        </select>
        <select
          aria-label="Filter by priority"
          className={selectClass}
          value={priority}
          onChange={(e) => setPriority(e.target.value as Priority | "all")}
        >
          <option value="all">All priorities</option>
          {PRIORITY_ORDER.map((p) => (
            <option key={p} value={p}>
              {PRIORITY_LABEL[p]}
            </option>
          ))}
        </select>
        <select
          aria-label="Filter by ward"
          className={selectClass}
          value={zone}
          onChange={(e) => setZone(e.target.value)}
        >
          <option value="all">All wards</option>
          {zones.map((z) => (
            <option key={z.id} value={z.id}>
              {z.name}
            </option>
          ))}
        </select>
        <label className="flex h-10 cursor-pointer items-center gap-2 rounded-[10px] border border-input px-3 text-sm">
          <input
            type="checkbox"
            checked={breachOnly}
            onChange={(e) => setBreachOnly(e.target.checked)}
            className="h-4 w-4 accent-[#C00707]"
          />
          SLA breached only
        </label>
      </div>

      <div className="card-surface overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] text-left text-sm">
            <thead className="bg-muted text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-semibold">Reference</th>
                <th className="px-4 py-3 font-semibold">Location</th>
                <th className="px-4 py-3 font-semibold">Category</th>
                <th className="px-4 py-3 font-semibold">Priority</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 font-semibold">Worker</th>
                <th className="px-4 py-3 font-semibold">SLA</th>
                <th className="px-4 py-3 font-semibold">Age</th>
                <th className="px-4 py-3 font-semibold">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((c) => (
                <tr key={c.id} className="cursor-pointer transition-colors hover:bg-accent">
                  <td className="px-4 py-3">
                    <Link
                      to="/complaints/$id"
                      params={{ id: c.id }}
                      className="font-mono text-xs font-semibold underline-offset-2 hover:underline"
                    >
                      {c.reference}
                    </Link>
                  </td>
                  <td className="max-w-[260px] px-4 py-3">
                    <Link to="/complaints/$id" params={{ id: c.id }} className="block">
                      <p className="truncate font-medium">{c.address}</p>
                      <p className="text-xs text-muted-foreground">{zoneName(c.zone_id)}</p>
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-xs">{CATEGORY_LABEL[c.waste_category]}</td>
                  <td className="px-4 py-3">
                    <PriorityBadge priority={c.priority} />
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={c.status} />
                  </td>
                  <td className="px-4 py-3 text-xs">{workerName(c.assigned_worker_id)}</td>
                  <td className="px-4 py-3">
                    <SlaChip start={c.sla_start} deadline={c.sla_deadline} />
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {relativeTime(c.created_at)}
                  </td>
                  <td className="px-4 py-3">
                    <Link
                      to="/complaints/$id"
                      params={{ id: c.id }}
                      className="inline-flex h-9 items-center rounded-[10px] bg-primary px-3 text-xs font-semibold text-primary-foreground"
                    >
                      {c.assigned_worker_id ? "View / reassign" : "View & assign worker"}
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>


        {!isLoading && rows.length === 0 ? (
          <div className="px-5 py-12 text-center">
            <p className="font-display text-base font-semibold">No complaints match these filters</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Try clearing the search box or widening the ward and status filters.
            </p>
          </div>
        ) : null}
      </div>
    </div>
  );
}
