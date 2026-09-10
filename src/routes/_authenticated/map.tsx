import { lazy, Suspense, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { ClientOnly } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { complaintsQuery, zonesQuery } from "@/lib/queries";
import { STATUS_HEX, STATUS_LABEL, STATUS_ORDER, type ComplaintStatus } from "@/lib/waste";

const ComplaintMap = lazy(() => import("@/components/complaint-map"));

export const Route = createFileRoute("/_authenticated/map")({
  head: () => ({
    meta: [
      { title: "Waste Map — NagarMitra Waste Dashboard" },
      {
        name: "description",
        content:
          "Geographic view of every waste complaint with status-coloured pins, ward filters and hotspot clusters.",
      },
      { property: "og:title", content: "Waste Map — NagarMitra Waste Dashboard" },
      {
        property: "og:description",
        content: "See waste complaint hotspots across the city on an interactive map.",
      },
    ],
  }),
  component: MapPage,
});

function MapPage() {
  const { data: complaints = [] } = useQuery(complaintsQuery);
  const { data: zones = [] } = useQuery(zonesQuery);
  const [status, setStatus] = useState<ComplaintStatus | "all">("all");
  const [zone, setZone] = useState("all");

  const pins = complaints.filter(
    (c) =>
      (status === "all" || c.status === status) && (zone === "all" || c.zone_id === zone),
  );

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-2xl font-bold">Waste Map</h1>
        <p className="text-sm text-muted-foreground">{pins.length} complaints plotted</p>
      </div>

      <div className="card-surface flex flex-wrap items-center gap-3 p-4">
        <select
          aria-label="Filter map by status"
          className="h-10 rounded-[10px] border border-input bg-card px-3 text-sm"
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
          aria-label="Filter map by ward"
          className="h-10 rounded-[10px] border border-input bg-card px-3 text-sm"
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
        <div className="ml-auto flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
          {(["pending", "in_progress", "resolved", "escalated"] as ComplaintStatus[]).map((s) => (
            <span key={s} className="inline-flex items-center gap-1.5">
              <span
                className="h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: STATUS_HEX[s] }}
              />
              {STATUS_LABEL[s]}
            </span>
          ))}
        </div>
      </div>

      <div className="map-shell h-[620px] bg-muted">
        <ClientOnly fallback={<div className="flex h-full items-center justify-center text-sm text-muted-foreground">Loading map…</div>}>
          <Suspense
            fallback={
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                Loading map…
              </div>
            }
          >
            <ComplaintMap complaints={pins} />
          </Suspense>
        </ClientOnly>
      </div>
    </div>
  );
}
