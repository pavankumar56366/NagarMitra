import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, CheckCircle2, Navigation, Play } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { photoUrlQuery } from "@/lib/citizen";
import { complaintEventsQuery, complaintsQuery, type Complaint } from "@/lib/queries";
import { StatusBadge, PriorityBadge } from "@/components/status-badge";
import { SlaChip } from "@/components/sla-chip";
import { CATEGORY_LABEL, formatDateTime } from "@/lib/waste";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/staff/reports/$id")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Job Card — NagarMitra Field Crew" },
      {
        name: "description",
        content:
          "Job card for a cleanup: site photo, directions, start work, log a note and mark the spot cleared.",
      },
      { property: "og:title", content: "Job Card — NagarMitra Field Crew" },
      { property: "og:description", content: "Directions, work steps and proof notes for a cleanup job." },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: WorkerJobCard,
});

function WorkerJobCard() {
  const { id } = Route.useParams();
  const queryClient = useQueryClient();

  const { data: complaints = [] } = useQuery(complaintsQuery);
  const complaint = complaints.find((c) => c.id === id) ?? null;
  const { data: events = [] } = useQuery(complaintEventsQuery(id));
  const { data: photo } = useQuery(photoUrlQuery(complaint?.photo_url ?? null));

  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  async function apply(patch: Partial<Complaint>, eventType: string, detail: string) {
    if (!complaint) return;
    setBusy(true);
    if (Object.keys(patch).length > 0) {
      const { error } = await supabase
        .from("complaints")
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .update(patch as any)
        .eq("id", complaint.id);
      if (error) {
        setBusy(false);
        toast.error(error.message);
        return;
      }
    }
    const { error: eventError } = await supabase.from("complaint_events").insert({
      complaint_id: complaint.id,
      actor: "field crew",
      event_type: eventType,
      detail,
    });
    if (eventError) {
      setBusy(false);
      toast.error(eventError.message);
      return;
    }
    setBusy(false);
    toast.success("Job updated.");
    await queryClient.invalidateQueries({ queryKey: ["complaints"] });
    await queryClient.invalidateQueries({ queryKey: ["complaint_events", complaint.id] });
    setNote("");
  }

  if (!complaint) {
    return (
      <div className="space-y-4">
        <Link to="/staff/reports" className="inline-flex items-center gap-2 text-sm font-bold">
          <ArrowLeft className="h-4 w-4" /> Job list
        </Link>
        <p className="card-surface p-5 text-sm text-muted-foreground">
          This job is not dispatched to you.
        </p>
      </div>
    );
  }

  const started = complaint.status === "in_progress";
  const finished = complaint.status === "resolved" || complaint.status === "closed";
  const step = finished ? 3 : started ? 2 : 1;

  return (
    <div className="space-y-5">
      <Link to="/staff/reports" className="inline-flex items-center gap-2 text-sm font-bold">
        <ArrowLeft className="h-4 w-4" /> Job list
      </Link>

      <header className="space-y-2">
        <h1 className="font-display text-xl font-bold">
          {complaint.ai_label || CATEGORY_LABEL[complaint.waste_category]}
        </h1>
        <p className="text-xs text-muted-foreground">{complaint.reference}</p>
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status={complaint.status} />
          <PriorityBadge priority={complaint.priority} />
          <SlaChip start={complaint.sla_start} deadline={complaint.sla_deadline} />
        </div>
      </header>

      <ol className="flex items-center gap-2">
        {["Travel", "Clearing", "Cleared"].map((label, i) => (
          <li
            key={label}
            className={cn(
              "flex-1 rounded-xl border-2 py-2 text-center text-[11px] font-bold uppercase tracking-wide",
              step > i
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border text-muted-foreground",
            )}
          >
            {label}
          </li>
        ))}
      </ol>

      <a
        href={`https://www.google.com/maps/dir/?api=1&destination=${complaint.lat},${complaint.lng}`}
        target="_blank"
        rel="noreferrer"
        className="flex h-14 items-center justify-center gap-2 rounded-xl bg-primary text-base font-bold text-primary-foreground"
      >
        <Navigation className="h-5 w-5" /> Navigate to site
      </a>

      {photo && <img src={photo} alt="Waste reported at the job site" className="w-full rounded-2xl" />}

      <div className="card-surface space-y-2 p-5 text-sm">
        <p className="font-semibold">
          {complaint.address || `${complaint.lat.toFixed(5)}, ${complaint.lng.toFixed(5)}`}
        </p>
        <p>
          <span className="text-muted-foreground">Reported:</span>{" "}
          {formatDateTime(complaint.created_at)}
        </p>
        <p>
          <span className="text-muted-foreground">Waste type:</span>{" "}
          {CATEGORY_LABEL[complaint.waste_category]}
        </p>
        {complaint.description && <p className="pt-1">{complaint.description}</p>}
      </div>

      <div className="card-surface space-y-3 p-5">
        <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
          Log your work
        </h2>

        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={3}
          placeholder="What did you find or do on site? (optional)"
          className="w-full rounded-xl border-2 border-border bg-background p-3 text-sm"
        />

        <button
          disabled={busy || started || finished}
          onClick={() => apply({ status: "in_progress" }, "in_progress", note || "Crew on site, clearing started")}
          className="flex h-14 w-full items-center justify-center gap-2 rounded-xl border-2 border-primary text-base font-bold disabled:opacity-40"
        >
          <Play className="h-5 w-5" /> Start clearing
        </button>
        <button
          disabled={busy || finished}
          onClick={() =>
            apply(
              { status: "resolved", resolved_at: new Date().toISOString() },
              "resolved",
              note || "Spot cleared by field crew",
            )
          }
          className="flex h-14 w-full items-center justify-center gap-2 rounded-xl bg-primary text-base font-bold text-primary-foreground disabled:opacity-40"
        >
          <CheckCircle2 className="h-5 w-5" /> Mark spot cleared
        </button>
        <button
          disabled={busy}
          onClick={() => apply({}, "note", note || "Site visited")}
          className="h-12 w-full rounded-xl border-2 border-border text-sm font-bold disabled:opacity-40"
        >
          Save note only
        </button>
      </div>

      <section className="space-y-3">
        <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
          Job history
        </h2>
        <ol className="space-y-3">
          {events.map((e) => (
            <li key={e.id} className="card-surface p-4">
              <p className="text-sm font-bold capitalize">{e.event_type.replace(/_/g, " ")}</p>
              <p className="text-xs text-muted-foreground">
                {formatDateTime(e.created_at)} · {e.actor}
              </p>
              {e.detail && <p className="pt-1 text-sm">{e.detail}</p>}
            </li>
          ))}
          {events.length === 0 && <li className="text-sm text-muted-foreground">No updates yet.</li>}
        </ol>
      </section>
    </div>
  );
}
