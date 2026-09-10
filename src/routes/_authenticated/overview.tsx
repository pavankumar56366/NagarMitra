import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { AlertTriangle, ArrowRight, Clock, ListChecks, ShieldCheck } from "lucide-react";
import { StatCard } from "@/components/stat-card";
import { StatusBadge, PriorityBadge } from "@/components/status-badge";
import { SlaChip } from "@/components/sla-chip";
import { complaintsQuery, zonesQuery } from "@/lib/queries";
import {
  CATEGORY_LABEL,
  CATEGORY_ORDER,
  formatHours,
  isOpen,
  relativeTime,
  type WasteCategory,
} from "@/lib/waste";

export const Route = createFileRoute("/_authenticated/overview")({
  head: () => ({
    meta: [
      { title: "City Overview — NagarMitra Waste Dashboard" },
      {
        name: "description",
        content:
          "Live overview of waste complaints, SLA compliance, escalations and resolution trends across all municipal wards.",
      },
      { property: "og:title", content: "City Overview — NagarMitra Waste Dashboard" },
      {
        property: "og:description",
        content: "Live waste complaint metrics, SLA compliance and escalation feed for city officials.",
      },
    ],
  }),
  component: OverviewPage,
});

function OverviewPage() {
  const { data: complaints = [], isLoading } = useQuery(complaintsQuery);
  const { data: zones = [] } = useQuery(zonesQuery);

  const open = complaints.filter((c) => isOpen(c.status));
  const resolvedLike = complaints.filter((c) =>
    ["resolved", "verified", "closed"].includes(c.status),
  );
  const breached = open.filter(
    (c) => c.sla_deadline && new Date(c.sla_deadline).getTime() < Date.now(),
  );
  const escalated = complaints.filter((c) => c.escalation_level > 0);

  const slaCompliance = complaints.length
    ? Math.round(
        ((complaints.length - escalated.length) / complaints.length) * 100,
      )
    : 0;

  const avgResolutionHours = (() => {
    const done = resolvedLike.filter((c) => c.resolved_at);
    if (!done.length) return 0;
    const total = done.reduce(
      (sum, c) =>
        sum + (new Date(c.resolved_at!).getTime() - new Date(c.created_at).getTime()),
      0,
    );
    return total / done.length / 3600000;
  })();

  const trend = buildTrend(complaints);
  const byCategory = CATEGORY_ORDER.map((cat) => ({
    name: CATEGORY_LABEL[cat as WasteCategory].split(" ")[0],
    count: complaints.filter((c) => c.waste_category === cat).length,
  })).filter((d) => d.count > 0);

  const escalationFeed = complaints
    .filter((c) => c.escalation_level > 0 && isOpen(c.status))
    .sort((a, b) => b.escalation_level - a.escalation_level)
    .slice(0, 6);

  const zoneName = (id: string | null) => zones.find((z) => z.id === id)?.name ?? "Unzoned";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold">City Overview</h1>
        <p className="text-sm text-muted-foreground">
          {isLoading ? "Loading live complaint data…" : `${complaints.length} complaints tracked across ${zones.length} wards`}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Open complaints"
          value={open.length}
          hint={`${complaints.length - open.length} closed or verified`}
          icon={<ListChecks className="h-4 w-4" />}
        />
        <StatCard
          label="SLA compliance"
          value={`${slaCompliance}%`}
          hint="Target ≥ 80%"
          accent={slaCompliance >= 80 ? "#2A7C13" : "#C00707"}
          icon={<ShieldCheck className="h-4 w-4" />}
        />
        <StatCard
          label="Breaching now"
          value={breached.length}
          hint="Open complaints past deadline"
          accent={breached.length ? "#C00707" : undefined}
          icon={<Clock className="h-4 w-4" />}
        />
        <StatCard
          label="Avg. resolution"
          value={formatHours(avgResolutionHours)}
          hint={`${escalated.length} complaints escalated`}
          icon={<AlertTriangle className="h-4 w-4" />}
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <div className="card-surface p-5 xl:col-span-2">
          <h2 className="font-display text-base font-semibold">Complaint volume — last 14 days</h2>
          <div className="mt-4 h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trend} margin={{ left: -20, right: 8, top: 8 }}>
                <CartesianGrid stroke="#DCE3DE" vertical={false} />
                <XAxis dataKey="day" tick={{ fontSize: 11, fill: "#5B655F" }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 11, fill: "#5B655F" }} tickLine={false} axisLine={false} allowDecimals={false} />
                <Tooltip
                  contentStyle={{ borderRadius: 12, border: "1px solid #DCE3DE", fontSize: 12 }}
                />
                <Line type="monotone" dataKey="reported" stroke="#2A7C13" strokeWidth={2.5} dot={false} name="Reported" />
                <Line type="monotone" dataKey="resolved" stroke="#A2CB8B" strokeWidth={2.5} dot={false} name="Resolved" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card-surface p-5">
          <h2 className="font-display text-base font-semibold">By waste category</h2>
          <div className="mt-4 h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={byCategory} margin={{ left: -24, right: 8, top: 8 }}>
                <CartesianGrid stroke="#DCE3DE" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 10, fill: "#5B655F" }} tickLine={false} axisLine={false} interval={0} angle={-25} textAnchor="end" height={54} />
                <YAxis tick={{ fontSize: 11, fill: "#5B655F" }} tickLine={false} axisLine={false} allowDecimals={false} />
                <Tooltip cursor={{ fill: "#F7F9F6" }} contentStyle={{ borderRadius: 12, border: "1px solid #DCE3DE", fontSize: 12 }} />
                <Bar dataKey="count" radius={[6, 6, 0, 0]} name="Complaints">
                  {byCategory.map((entry, i) => (
                    <Cell key={entry.name} fill={i % 2 ? "#A2CB8B" : "#2A7C13"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="card-surface overflow-hidden">
        <div className="flex items-center justify-between gap-4 border-b border-border px-5 py-4">
          <div>
            <h2 className="font-display text-base font-semibold">Needs your attention</h2>
            <p className="text-xs text-muted-foreground">Escalated complaints still open</p>
          </div>
          <Link
            to="/escalations"
            className="inline-flex items-center gap-1 text-sm font-semibold text-foreground hover:underline"
          >
            All escalations <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        {escalationFeed.length === 0 ? (
          <div className="px-5 py-10 text-center">
            <p className="font-display text-base font-semibold">Nothing escalated right now</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Every open complaint is inside its SLA window.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {escalationFeed.map((c) => (
              <li key={c.id}>
                <Link
                  to="/complaints/$id"
                  params={{ id: c.id }}
                  className="flex flex-wrap items-center gap-3 px-5 py-4 transition-colors hover:bg-accent"
                >
                  <span className="w-28 shrink-0 font-mono text-xs text-muted-foreground">
                    {c.reference}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-sm font-medium">{c.address}</span>
                  <span className="text-xs text-muted-foreground">{zoneName(c.zone_id)}</span>
                  <PriorityBadge priority={c.priority} />
                  <StatusBadge status={c.status} />
                  <SlaChip start={c.sla_start} deadline={c.sla_deadline} />
                  <span className="text-xs text-muted-foreground">{relativeTime(c.created_at)}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function buildTrend(complaints: { created_at: string; resolved_at: string | null }[]) {
  const days: { day: string; key: string; reported: number; resolved: number }[] = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - i);
    days.push({
      day: d.toLocaleDateString(undefined, { day: "2-digit", month: "short" }),
      key: d.toISOString().slice(0, 10),
      reported: 0,
      resolved: 0,
    });
  }
  const index = new Map(days.map((d) => [d.key, d]));
  for (const c of complaints) {
    const r = index.get(c.created_at.slice(0, 10));
    if (r) r.reported += 1;
    if (c.resolved_at) {
      const s = index.get(c.resolved_at.slice(0, 10));
      if (s) s.resolved += 1;
    }
  }
  return days;
}
