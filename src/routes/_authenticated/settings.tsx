import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { myAccessQuery, slaConfigQuery, zonesQuery } from "@/lib/queries";
import { PRIORITY_LABEL, PRIORITY_ORDER, formatHours } from "@/lib/waste";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({
    meta: [
      { title: "SLA Settings — NagarMitra Waste Dashboard" },
      {
        name: "description",
        content:
          "Configured SLA windows, warning thresholds and escalation extensions per complaint priority.",
      },
      { property: "og:title", content: "SLA Settings — NagarMitra Waste Dashboard" },
      {
        property: "og:description",
        content: "SLA windows and escalation rules per waste complaint priority.",
      },
    ],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  const { data: config = [] } = useQuery(slaConfigQuery);
  const { data: access } = useQuery(myAccessQuery);
  const { data: zones = [] } = useQuery(zonesQuery);

  const byPriority = new Map(config.map((c) => [c.priority, c]));

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-2xl font-bold">SLA Settings</h1>
        <p className="text-sm text-muted-foreground">
          Deadlines are applied when a complaint is assigned; overdue complaints escalate
          automatically every 15 minutes.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {PRIORITY_ORDER.map((p) => {
          const c = byPriority.get(p);
          return (
            <div key={p} className="card-surface p-5">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                {PRIORITY_LABEL[p]}
              </p>
              <p className="mt-2 font-display text-2xl font-bold">
                {c ? formatHours(c.duration_hours) : "—"}
              </p>
              <p className="mt-3 text-xs text-muted-foreground">
                Warns at {c?.warn_at_percent?.join("% / ") ?? "—"}% elapsed
              </p>
              <p className="text-xs text-muted-foreground">
                Escalation adds {c ? formatHours(c.escalation_extension_hours) : "—"}
              </p>
            </div>
          );
        })}
      </div>

      <div className="card-surface p-5">
        <h2 className="font-display text-base font-semibold">Your access</h2>
        <dl className="mt-4 grid gap-4 sm:grid-cols-3">
          <div>
            <dt className="text-xs text-muted-foreground">Signed in as</dt>
            <dd className="text-sm font-medium">{access?.email || "—"}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Role</dt>
            <dd className="text-sm font-medium">
              {access?.role === "zonal_officer" ? "Zonal Officer" : "Municipal Commissioner"}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Scope</dt>
            <dd className="text-sm font-medium">
              {access?.role === "zonal_officer"
                ? (zones.find((z) => z.id === access.zoneId)?.name ?? "No ward assigned")
                : "All wards"}
            </dd>
          </div>
        </dl>
      </div>
    </div>
  );
}
