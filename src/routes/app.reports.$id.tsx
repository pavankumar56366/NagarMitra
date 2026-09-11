import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, MapPin, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { verifyCitizenCleanup } from "@/lib/citizen-verification.functions";
import { deleteCitizenReport, deletionMode } from "@/lib/citizen-delete.functions";
import { myComplaintsQuery, photoUrlQuery } from "@/lib/citizen";
import { complaintEventsQuery, completionEvidenceQuery, workersQuery } from "@/lib/queries";
import { LocationFacts, ReportQualityPanel } from "@/components/report-quality-panel";
import { StatusBadge, PriorityBadge } from "@/components/status-badge";
import { SlaChip } from "@/components/sla-chip";
import { CATEGORY_LABEL, formatDateTime } from "@/lib/waste";

export const Route = createFileRoute("/app/reports/$id")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Report Details — NagarMitra" },
      {
        name: "description",
        content:
          "See the progress of your waste report, who is handling it, and confirm once the spot is clean.",
      },
      { property: "og:title", content: "Report Details — NagarMitra" },
      { property: "og:description", content: "Progress, timing and verification for your report." },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ReportDetail,
});

function ReportDetail() {
  const { id } = Route.useParams();
  const queryClient = useQueryClient();

  const { data: complaints = [] } = useQuery(myComplaintsQuery);
  const complaint = complaints.find((c) => c.id === id) ?? null;
  const { data: events = [] } = useQuery(complaintEventsQuery(id));
  const { data: workers = [] } = useQuery(workersQuery);
  const { data: photo } = useQuery(photoUrlQuery(complaint?.photo_url ?? null));
  const { data: evidence = [] } = useQuery(completionEvidenceQuery(id));

  const navigate = useNavigate();
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const worker = workers.find((w) => w.id === complaint?.assigned_worker_id) ?? null;
  const isCancelled = Boolean(complaint?.deleted_at) || complaint?.status === "cancelled";
  const canVerify =
    complaint &&
    !isCancelled &&
    complaint.status === "resolved" &&
    complaint.verification_status !== "confirmed";
  const mode = complaint
    ? deletionMode(complaint.status, complaint.deleted_at ?? null)
    : ("none" as const);

  async function removeReport() {
    if (!complaint) return;
    setDeleting(true);
    try {
      const result = await deleteCitizenReport({
        data: { complaintId: complaint.id, reason: note.trim() || undefined },
      });
      toast.success(
        result.outcome === "deleted"
          ? "Report deleted successfully."
          : "Report withdrawn successfully.",
      );
      await queryClient.invalidateQueries({ queryKey: ["my_complaints"] });
      await queryClient.invalidateQueries({ queryKey: ["complaint_events", complaint.id] });
      if (result.outcome === "deleted") {
        void navigate({ to: "/app/reports" });
        return;
      }
      setConfirmDelete(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not delete the report");
    } finally {
      setDeleting(false);
    }
  }

  async function verify(confirmed: boolean) {
    if (!complaint) return;
    setBusy(true);
    try {
      await verifyCitizenCleanup({
        data: { complaintId: complaint.id, confirmed, comment: note },
      });
    } catch (error) {
      setBusy(false);
      toast.error(error instanceof Error ? error.message : "Could not update the report");
      return;
    }
    setBusy(false);
    toast.success(confirmed ? "Thanks for confirming." : "We have reopened your report.");
    await queryClient.invalidateQueries({ queryKey: ["my_complaints"] });
    await queryClient.invalidateQueries({ queryKey: ["complaint_events", complaint.id] });
    setNote("");
  }

  const afterPhotoPath =
    evidence.find((ev) => ev.gps_verified && ev.image_path)?.image_path ?? null;

  if (!complaint) {
    return (
      <div className="space-y-4">
        <Link to="/app/reports" className="inline-flex items-center gap-2 text-sm font-semibold">
          <ArrowLeft className="h-4 w-4" /> My reports
        </Link>
        <p className="card-surface p-5 text-sm text-muted-foreground">
          We could not find that report.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <Link to="/app/reports" className="inline-flex items-center gap-2 text-sm font-semibold">
        <ArrowLeft className="h-4 w-4" /> My reports
      </Link>

      <header className="space-y-2">
        <h1 className="font-display text-xl font-bold">
          {complaint.ai_label || CATEGORY_LABEL[complaint.waste_category]}
        </h1>
        <p className="text-sm text-muted-foreground">{complaint.reference}</p>
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status={complaint.status} />
          <PriorityBadge priority={complaint.priority} />
          <SlaChip start={complaint.sla_start} deadline={complaint.sla_deadline} />
        </div>
      </header>

      {photo && (
        <div className={afterPhotoPath ? "grid gap-3 sm:grid-cols-2" : ""}>
          <figure>
            <img
              src={photo}
              alt="Waste you reported"
              className="w-full rounded-2xl object-cover"
            />
            <figcaption className="mt-1.5 text-xs font-medium text-muted-foreground">
              Before — your report
            </figcaption>
          </figure>
          {afterPhotoPath && (
            <EvidencePhoto path={afterPhotoPath} label="After — cleaned by the crew" />
          )}
        </div>
      )}

      <div className="card-surface space-y-2 p-5 text-sm">
        <p className="flex items-center gap-2 text-muted-foreground">
          <MapPin className="h-4 w-4" />
          {complaint.address || `${complaint.lat.toFixed(5)}, ${complaint.lng.toFixed(5)}`}
        </p>
        <p>
          <span className="text-muted-foreground">Reported:</span>{" "}
          {formatDateTime(complaint.created_at)}
        </p>
        <p>
          <span className="text-muted-foreground">Category:</span>{" "}
          {CATEGORY_LABEL[complaint.waste_category]}
        </p>
        {worker && (
          <p>
            <span className="text-muted-foreground">Assigned crew:</span> {worker.name}
          </p>
        )}
        {complaint.description && <p className="pt-1">{complaint.description}</p>}
      </div>

      <LocationFacts
        title="Location"
        locationName={complaint.location_name || complaint.address || ""}
        lat={complaint.lat}
        lng={complaint.lng}
        gpsVerified={complaint.report_quality?.gps_verified ?? null}
        timestampVerified={complaint.report_quality?.timestamp_verified ?? null}
        timestamp={complaint.captured_at || complaint.created_at}
      />

      <ReportQualityPanel
        quality={complaint.report_quality}
        score={complaint.report_quality_score}
      />

      {evidence.length > 0 && (
        <div className="card-surface space-y-2 p-5 text-sm">
          <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Cleanup evidence
          </h2>
          {evidence
            .filter((ev) => ev.gps_verified)
            .map((ev) => (
              <p key={ev.id}>
                Cleared on {formatDateTime(ev.captured_at)} at {ev.location_name}, confirmed{" "}
                {ev.distance_from_reported_location} m from where you reported it.
              </p>
            ))}
        </div>
      )}

      {canVerify && (
        <div className="card-surface space-y-3 p-5">
          <h2 className="font-display text-base font-semibold">Is the spot clean now?</h2>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
            placeholder="Add a note (optional)"
            className="w-full rounded-xl border border-border bg-background p-3 text-sm"
          />
          <div className="flex gap-3">
            <button
              disabled={busy}
              onClick={() => verify(true)}
              className="h-12 flex-1 rounded-xl bg-primary font-semibold text-primary-foreground disabled:opacity-50"
            >
              Yes, it is clean
            </button>
            <button
              disabled={busy}
              onClick={() => verify(false)}
              className="h-12 flex-1 rounded-xl border border-destructive font-semibold text-destructive disabled:opacity-50"
            >
              Still dirty
            </button>
          </div>
        </div>
      )}

      {isCancelled && (
        <p className="card-surface p-5 text-sm text-muted-foreground">
          You withdrew this report, so it is no longer active and cannot be changed.
        </p>
      )}

      {mode !== "none" && !confirmDelete && (
        <button
          onClick={() => setConfirmDelete(true)}
          className="flex h-12 w-full items-center justify-center gap-2 rounded-xl border border-destructive font-semibold text-destructive"
        >
          <Trash2 className="h-4 w-4" />
          {mode === "delete" ? "Delete report" : "Withdraw report"}
        </button>
      )}

      {mode !== "none" && confirmDelete && (
        <div className="card-surface space-y-3 p-5">
          <h2 className="font-display text-base font-semibold">
            Are you sure you want to delete this report?
          </h2>
          <p className="text-sm text-muted-foreground">
            {mode === "delete"
              ? "This report has not been picked up yet, so it will be removed completely along with its updates. This cannot be undone."
              : "A crew is already working on this report, so it cannot be removed. It will be marked withdrawn and stay in the ward's records for their work and checks."}
          </p>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            placeholder="Reason (optional)"
            className="w-full rounded-xl border border-border bg-background p-3 text-sm"
          />
          <div className="flex gap-3">
            <button
              disabled={deleting}
              onClick={() => setConfirmDelete(false)}
              className="h-12 flex-1 rounded-xl border border-border font-semibold disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              disabled={deleting}
              onClick={removeReport}
              className="h-12 flex-1 rounded-xl bg-destructive font-semibold text-destructive-foreground disabled:opacity-50"
            >
              {mode === "delete" ? "Delete report" : "Withdraw report"}
            </button>
          </div>
        </div>
      )}

      <section className="space-y-3">
        <h2 className="font-display text-base font-semibold">Progress</h2>
        <ol className="space-y-3">
          {events.map((e) => (
            <li key={e.id} className="card-surface p-4">
              <p className="text-sm font-semibold capitalize">{e.event_type.replace(/_/g, " ")}</p>
              <p className="text-xs text-muted-foreground">
                {formatDateTime(e.created_at)} · {e.actor}
              </p>
              {e.detail && <p className="pt-1 text-sm">{e.detail}</p>}
            </li>
          ))}
          {events.length === 0 && (
            <li className="text-sm text-muted-foreground">No updates yet.</li>
          )}
        </ol>
      </section>
    </div>
  );
}
