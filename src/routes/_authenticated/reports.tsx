import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Download } from "lucide-react";
import { complaintsQuery, workersQuery, zonesQuery } from "@/lib/queries";
import { CATEGORY_LABEL, PRIORITY_LABEL, STATUS_LABEL, formatHours, isOpen } from "@/lib/waste";
import { StatCard } from "@/components/stat-card";

export const Route = createFileRoute("/_authenticated/reports")({
  head: () => ({
    meta: [
      { title: "Reports & Exports — NagarMitra Waste Dashboard" },
      {
        name: "description",
        content:
          "Ward-wise performance summary with CSV export of complaints, SLA outcomes and resolution times.",
      },
      { property: "og:title", content: "Reports & Exports — NagarMitra Waste Dashboard" },
      {
        property: "og:description",
        content: "Download ward-wise waste complaint and SLA performance data as CSV.",
      },
    ],
  }),
  component: ReportsPage,
});

function ReportsPage() {
  const { data: complaints = [] } = useQuery(complaintsQuery);
  const { data: zones = [] } = useQuery(zonesQuery);
  const { data: workers = [] } = useQuery(workersQuery);

  const zoneName = (id: string | null) => zones.find((z) => z.id === id)?.name ?? "Unzoned";
  const workerName = (id: string | null) => workers.find((w) => w.id === id)?.name ?? "";

  const resolved = complaints.filter((c) => c.resolved_at);
  const avg = resolved.length
    ? resolved.reduce(
        (s, c) => s + (new Date(c.resolved_at!).getTime() - new Date(c.created_at).getTime()),
        0,
      ) /
      resolved.length /
      3600000
    : 0;

  function exportCsv() {
    const header = [
      "Reference",
      "Ward",
      "Address",
      "Category",
      "Priority",
      "Status",
      "Worker",
      "Reported",
      "SLA deadline",
      "Resolved",
      "Escalation level",
    ];
    const lines = complaints.map((c) =>
      [
        c.reference,
        zoneName(c.zone_id),
        c.address,
        CATEGORY_LABEL[c.waste_category],
        PRIORITY_LABEL[c.priority],
        STATUS_LABEL[c.status],
        workerName(c.assigned_worker_id),
        c.created_at,
        c.sla_deadline ?? "",
        c.resolved_at ?? "",
        String(c.escalation_level),
      ]
        .map((v) => `"${String(v).replace(/"/g, '""')}"`)
        .join(","),
    );
    const blob = new Blob([[header.join(","), ...lines].join("\n")], {
      type: "text/csv;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `waste-complaints-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold">Reports</h1>
          <p className="text-sm text-muted-foreground">Ward-wise performance summary</p>
        </div>
        <button
          onClick={exportCsv}
          className="inline-flex h-11 items-center gap-2 rounded-xl bg-primary px-5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
        >
          <Download className="h-4 w-4" /> Export CSV
        </button>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Complaints in period" value={complaints.length} />
        <StatCard label="Resolved" value={resolved.length} />
        <StatCard label="Average resolution time" value={formatHours(avg)} />
      </div>

      <div className="card-surface overflow-x-auto">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="bg-muted text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-4 py-3 font-semibold">Ward</th>
              <th className="px-4 py-3 font-semibold">Total</th>
              <th className="px-4 py-3 font-semibold">Open</th>
              <th className="px-4 py-3 font-semibold">Resolved</th>
              <th className="px-4 py-3 font-semibold">Escalated</th>
              <th className="px-4 py-3 font-semibold">Avg. resolution</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {zones.map((z) => {
              const mine = complaints.filter((c) => c.zone_id === z.id);
              const done = mine.filter((c) => c.resolved_at);
              const zoneAvg = done.length
                ? done.reduce(
                    (s, c) =>
                      s + (new Date(c.resolved_at!).getTime() - new Date(c.created_at).getTime()),
                    0,
                  ) /
                  done.length /
                  3600000
                : 0;
              return (
                <tr key={z.id} className="hover:bg-accent">
                  <td className="px-4 py-3 font-medium">{z.name}</td>
                  <td className="px-4 py-3">{mine.length}</td>
                  <td className="px-4 py-3">{mine.filter((c) => isOpen(c.status)).length}</td>
                  <td className="px-4 py-3">{done.length}</td>
                  <td className="px-4 py-3">
                    {mine.filter((c) => c.escalation_level > 0).length}
                  </td>
                  <td className="px-4 py-3">{done.length ? formatHours(zoneAvg) : "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
