import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { complaintsQuery, workersQuery, zonesQuery } from "@/lib/queries";
import { isOpen } from "@/lib/waste";

export const Route = createFileRoute("/_authenticated/zones")({
  head: () => ({
    meta: [
      { title: "Wards & Hotspots — NagarMitra Waste Dashboard" },
      {
        name: "description",
        content:
          "Ward-level breakdown of complaint load, open backlog, escalations and repeat dumping hotspots.",
      },
      { property: "og:title", content: "Wards & Hotspots — NagarMitra Waste Dashboard" },
      {
        property: "og:description",
        content: "Ward-level waste complaint load, backlog and repeat hotspots.",
      },
    ],
  }),
  component: ZonesPage,
});

function ZonesPage() {
  const { data: zones = [] } = useQuery(zonesQuery);
  const { data: complaints = [] } = useQuery(complaintsQuery);
  const { data: workers = [] } = useQuery(workersQuery);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-2xl font-bold">Wards & Hotspots</h1>
        <p className="text-sm text-muted-foreground">
          Complaint load and repeat dumping spots per ward
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {zones.map((z) => {
          const mine = complaints.filter((c) => c.zone_id === z.id);
          const open = mine.filter((c) => isOpen(c.status));
          const escalated = mine.filter((c) => c.escalation_level > 0);
          const crew = workers.filter((w) => w.zone_id === z.id);
          const hotspots = topHotspots(mine.map((c) => c.address));

          return (
            <div key={z.id} className="card-surface p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="font-display text-lg font-semibold">{z.name}</h2>
                  <p className="text-xs text-muted-foreground">
                    Supervisor: {z.supervisor_name}
                  </p>
                </div>
                <span className="rounded-full bg-accent px-3 py-1 text-xs font-semibold">
                  {crew.length} workers
                </span>
              </div>

              <div className="mt-4 grid grid-cols-3 gap-3 text-center">
                <Metric label="Total" value={mine.length} />
                <Metric label="Open" value={open.length} />
                <Metric
                  label="Escalated"
                  value={escalated.length}
                  color={escalated.length ? "#C00707" : undefined}
                />
              </div>

              {z.sensitivity_tags?.length ? (
                <div className="mt-4 flex flex-wrap gap-2">
                  {z.sensitivity_tags.map((t) => (
                    <span
                      key={t}
                      className="rounded-full bg-secondary/30 px-2.5 py-1 text-[11px] font-semibold"
                    >
                      {t}
                    </span>
                  ))}
                </div>
              ) : null}

              {hotspots.length ? (
                <div className="mt-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Repeat hotspots
                  </p>
                  <ul className="mt-2 space-y-1 text-sm">
                    {hotspots.map(([address, count]) => (
                      <li key={address} className="flex justify-between gap-3">
                        <span className="truncate">{address}</span>
                        <span className="shrink-0 font-semibold">{count}×</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Metric({ label, value, color }: { label: string; value: number; color?: string | undefined }) {
  return (
    <div className="rounded-xl bg-muted py-3">
      <p className="font-display text-xl font-bold" style={color ? { color } : undefined}>
        {value}
      </p>
      <p className="text-[11px] text-muted-foreground">{label}</p>
    </div>
  );
}

function topHotspots(addresses: string[]) {
  const counts = new Map<string, number>();
  for (const a of addresses) counts.set(a, (counts.get(a) ?? 0) + 1);
  return [...counts.entries()]
    .filter(([, n]) => n > 1)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3);
}
