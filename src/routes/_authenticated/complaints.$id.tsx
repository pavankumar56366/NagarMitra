import { useState } from "react";
import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, MapPin, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { StatusBadge, PriorityBadge } from "@/components/status-badge";
import { SlaChip } from "@/components/sla-chip";
import { photoUrlQuery } from "@/lib/citizen";

import { ReportQualityPanel } from "@/components/report-quality-panel";
import { EvidencePhoto } from "@/components/evidence-photo";
import {
  complaintEventsQuery,
  completionEvidenceQuery,
  complaintsQuery,
  escalationsQuery,
  myAccessQuery,
  workersQuery,
  zonesQuery,
} from "@/lib/queries";
import {
  CATEGORY_LABEL,
  PRIORITY_LABEL,
  PRIORITY_ORDER,
  formatDateTime,
  type ComplaintStatus,
  type Priority,
} from "@/lib/waste";

export const Route = createFileRoute("/_authenticated/complaints/$id")({
  head: () => ({
    meta: [
      { title: "Complaint Detail — NagarMitra Waste Dashboard" },
      {
        name: "description",
        content:
          "Full complaint history: SLA countdown, worker assignment, escalation trail and authority audit log.",
      },
      { property: "og:title", content: "Complaint Detail — NagarMitra Waste Dashboard" },
      {
        property: "og:description",
        content: "Review a waste complaint's SLA, assignment and escalation history.",
      },
    ],
  }),
  component: ComplaintDetail,
});

const inputClass =
  "h-10 w-full rounded-[10px] border border-input bg-card px-3 text-sm outline-none focus:border-primary";

function ComplaintDetail() {
  const { id } = useParams({ from: "/_authenticated/complaints/$id" });
  const qc = useQueryClient();

  const { data: complaints = [] } = useQuery(complaintsQuery);
  const { data: workers = [] } = useQuery(workersQuery);
  const { data: zones = [] } = useQuery(zonesQuery);
  const { data: events = [] } = useQuery(complaintEventsQuery(id));
  const { data: escalations = [] } = useQuery(escalationsQuery);
  const { data: evidence = [] } = useQuery(completionEvidenceQuery(id));
  const { data: access } = useQuery(myAccessQuery);

  const complaint = complaints.find((c) => c.id === id);

  const [workerId, setWorkerId] = useState("");
  const [newPriority, setNewPriority] = useState<Priority | "">("");
  const [reason, setReason] = useState("");

  const actor = access?.fullName || access?.email || "Authority";

  const mutate = useMutation({
    mutationFn: async ({
      patch,
      eventType,
      detail,
    }: {
      patch: Record<string, unknown>;
      eventType: string;
      detail: string;
    }) => {
      const { error } = await supabase
        .from("complaints")
        .update(patch as never)
        .eq("id", id);
      if (error) throw new Error(error.message);
      const { error: evErr } = await supabase.from("complaint_events").insert({
        complaint_id: id,
        actor,
        event_type: eventType,
        detail,
      });
      if (evErr) throw new Error(evErr.message);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["complaints"] });
      qc.invalidateQueries({ queryKey: ["complaint_events", id] });
      toast.success("Complaint updated");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const { data: photo } = useQuery(photoUrlQuery(complaint?.photo_url ?? null));

  if (!complaint) {
    return (
      <div className="card-surface px-6 py-14 text-center">
        <p className="font-display text-lg font-semibold">Complaint not found</p>
        <p className="mt-1 text-sm text-muted-foreground">
          It may have been closed and archived, or it sits outside your ward.
        </p>
        <Link
          to="/complaints"
          className="mt-5 inline-flex h-11 items-center rounded-xl bg-primary px-5 text-sm font-semibold text-primary-foreground"
        >
          Back to complaints
        </Link>
      </div>
    );
  }

  const zone = zones.find((z) => z.id === complaint.zone_id);
  const assigned = workers.find((w) => w.id === complaint.assigned_worker_id);
  const trail = escalations.filter((e) => e.complaint_id === id);
  const zoneWorkers = workers.filter((w) => !complaint.zone_id || w.zone_id === complaint.zone_id);
  const openLoad = (workerId: string) =>
    complaints.filter(
      (c) =>
        c.assigned_worker_id === workerId &&
        ["assigned", "in_progress", "escalated", "reopened"].includes(c.status),
    ).length;
  const availableWorkers = zoneWorkers.filter((w) => w.availability === "on_duty");
  const offDutyWorkers = zoneWorkers.filter((w) => w.availability !== "on_duty");


  function assign() {
    if (!workerId) {
      toast.error("Pick a worker first");
      return;
    }
    const w = workers.find((x) => x.id === workerId);
    mutate.mutate({
      patch: {
        assigned_worker_id: workerId,
        status: "assigned" as ComplaintStatus,
        sla_start: new Date().toISOString(),
      },
      eventType: complaint!.assigned_worker_id ? "reassigned" : "assigned",
      detail: `${complaint!.assigned_worker_id ? "Reassigned" : "Assigned"} to ${w?.name ?? "worker"}`,
    });
  }

  function overridePriority() {
    if (!newPriority) {
      toast.error("Choose a new priority");
      return;
    }
    if (reason.trim().length < 10) {
      toast.error("A written justification of at least 10 characters is required");
      return;
    }
    mutate.mutate({
      patch: { priority: newPriority, priority_override_reason: reason.trim() },
      eventType: "priority_override",
      detail: `Priority changed ${PRIORITY_LABEL[complaint!.priority]} → ${PRIORITY_LABEL[newPriority]}: ${reason.trim()}`,
    });
    setReason("");
    setNewPriority("");
  }

  function setStatus(status: ComplaintStatus, detail: string) {
    mutate.mutate({
      patch:
        status === "closed"
          ? { status, resolved_at: complaint!.resolved_at ?? new Date().toISOString() }
          : { status },
      eventType: status,
      detail,
    });
  }

  return (
    <div className="space-y-5">
      <Link
        to="/complaints"
        className="inline-flex items-center gap-2 text-sm font-semibold text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Back to complaints
      </Link>

      <div className="card-surface flex flex-wrap items-start justify-between gap-4 p-5">
        <div className="min-w-0">
          <p className="font-mono text-xs text-muted-foreground">{complaint.reference}</p>
          <h1 className="mt-1 font-display text-2xl font-bold">{complaint.address}</h1>
          <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
            <MapPin className="h-4 w-4" />
            {zone?.name ?? "Unzoned"} · {complaint.lat.toFixed(5)}, {complaint.lng.toFixed(5)}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <PriorityBadge priority={complaint.priority} />
          <StatusBadge status={complaint.status} />
          <SlaChip start={complaint.sla_start} deadline={complaint.sla_deadline} size="lg" />
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <div className="card-surface p-5">
            <h2 className="font-display text-base font-semibold">Report details</h2>
            {photo ? (
              <img
                src={photo}
                alt={`Waste reported at ${complaint.address || "the pinned location"}`}
                className="mt-4 max-h-[360px] w-full rounded-xl object-cover"
              />
            ) : null}
            <dl className="mt-4 grid gap-4 sm:grid-cols-2">
              <Field label="Reported by" value={complaint.citizen_name} />
              <Field label="Reported at" value={formatDateTime(complaint.created_at)} />
              <Field
                label="AI category"
                value={
                  complaint.ai_label
                    ? `${complaint.ai_label} · ${CATEGORY_LABEL[complaint.waste_category]}`
                    : CATEGORY_LABEL[complaint.waste_category]
                }
              />

              <Field
                label="AI confidence"
                value={`${Math.round(complaint.ai_confidence * 100)}%`}
              />
              <Field label="Assigned worker" value={assigned?.name ?? "Unassigned"} />
              <Field
                label="Citizen verification"
                value={complaint.verification_status ?? "Not requested"}
              />
              <Field label="Location name" value={complaint.location_name || complaint.address} />
              <Field
                label="Latitude / Longitude"
                value={`${complaint.lat.toFixed(5)}, ${complaint.lng.toFixed(5)}`}
              />
              <Field
                label="Validation"
                value={`${complaint.report_validation_status ?? "—"}${
                  complaint.report_quality_score != null
                    ? ` · ${complaint.report_quality_score}/100`
                    : ""
                }`}
              />
              <Field
                label="Waste amount / severity"
                value={`${complaint.waste_amount ?? "—"} · ${complaint.severity ?? "—"}`}
              />
              <Field
                label="Duplicate check"
                value={`${complaint.duplicate_status ?? "UNIQUE"}${
                  complaint.duplicate_confidence
                    ? ` · ${Math.round(complaint.duplicate_confidence * 100)}%`
                    : ""
                }`}
              />
            </dl>
            {complaint.validation_reason ? (
              <p className="mt-4 rounded-xl bg-muted p-4 text-sm">{complaint.validation_reason}</p>
            ) : null}
            {complaint.duplicate_detection_reason ? (
              <p className="mt-3 rounded-xl bg-muted p-4 text-sm">
                <strong>Duplicate detection: </strong>
                {complaint.duplicate_detection_reason}
              </p>
            ) : null}
            <ReportQualityPanel
              className="mt-4"
              quality={complaint.report_quality}
              score={complaint.report_quality_score}
            />
            {evidence.length > 0 ? (
              <div className="mt-4 space-y-2">
                <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Worker completion evidence
                </h3>
                {evidence.map((ev) => (
                  <div key={ev.id} className="rounded-xl border border-border p-4 text-sm">
                    <p className="font-semibold">
                      {ev.gps_verified ? "GPS verified" : "Rejected — location mismatch"} ·{" "}
                      {ev.distance_from_reported_location} m from the reported location
                    </p>
                    <p className="text-muted-foreground">
                      {formatDateTime(ev.captured_at)} · {ev.location_name}
                    </p>
                    {ev.image_path ? (
                      <EvidencePhoto
                        className="mt-3"
                        path={ev.image_path}
                        label="After — completion photo"
                      />
                    ) : null}
                    {ev.validation_reason ? (
                      <p className="mt-1 text-muted-foreground">{ev.validation_reason}</p>
                    ) : null}
                  </div>
                ))}
              </div>
            ) : null}
            {complaint.citizen_note ? (
              <p className="mt-4 rounded-xl bg-muted p-4 text-sm">{complaint.citizen_note}</p>
            ) : null}
            {complaint.priority_override_reason ? (
              <p className="mt-3 flex gap-2 rounded-xl bg-secondary/25 p-4 text-sm">
                <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
                <span>
                  <strong>Priority override justification: </strong>
                  {complaint.priority_override_reason}
                </span>
              </p>
            ) : null}
          </div>

          <div className="card-surface p-5">
            <h2 className="font-display text-base font-semibold">Audit trail</h2>
            <ol className="mt-4 space-y-4">
              {events.map((ev) => (
                <li key={ev.id} className="relative pl-6">
                  <span className="absolute left-0 top-1.5 h-2.5 w-2.5 rounded-full bg-primary" />
                  <p className="text-sm font-medium">{ev.detail}</p>
                  <p className="text-xs text-muted-foreground">
                    {ev.actor} · {formatDateTime(ev.created_at)}
                  </p>
                </li>
              ))}
              {events.length === 0 ? (
                <li className="text-sm text-muted-foreground">No activity recorded yet.</li>
              ) : null}
            </ol>
          </div>

          {trail.length > 0 ? (
            <div className="card-surface p-5">
              <h2 className="font-display text-base font-semibold">Escalation history</h2>
              <ul className="mt-4 space-y-3">
                {trail.map((e) => (
                  <li key={e.id} className="rounded-xl border border-border p-4 text-sm">
                    <p className="font-semibold text-destructive">
                      Level {e.from_level} → {e.to_level}
                    </p>
                    <p className="text-muted-foreground">{e.reason}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {formatDateTime(e.escalated_at)}
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>

        <div className="space-y-4">
          <div className="card-surface p-5">
            <h2 className="font-display text-base font-semibold">Assign or reassign</h2>
            <select
              aria-label="Select worker"
              className={`${inputClass} mt-3`}
              value={workerId}
              onChange={(e) => setWorkerId(e.target.value)}
            >
              <option value="">Choose a worker…</option>
              {zoneWorkers.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name} · {w.availability} · {w.performance_score.toFixed(1)}★
                </option>
              ))}
            </select>
            <button
              onClick={assign}
              disabled={mutate.isPending}
              className="mt-3 h-11 w-full rounded-xl bg-primary text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-40"
            >
              {complaint.assigned_worker_id ? "Reassign complaint" : "Assign complaint"}
            </button>
          </div>

          <div className="card-surface p-5">
            <h2 className="font-display text-base font-semibold">Override priority</h2>
            <select
              aria-label="New priority"
              className={`${inputClass} mt-3`}
              value={newPriority}
              onChange={(e) => setNewPriority(e.target.value as Priority)}
            >
              <option value="">New priority…</option>
              {PRIORITY_ORDER.map((p) => (
                <option key={p} value={p}>
                  {PRIORITY_LABEL[p]}
                </option>
              ))}
            </select>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              placeholder="Justification (required, kept in the audit log)"
              className="mt-3 w-full rounded-[10px] border border-input bg-card p-3 text-sm outline-none focus:border-primary"
            />
            <button
              onClick={overridePriority}
              disabled={mutate.isPending}
              className="mt-3 h-11 w-full rounded-xl border-[1.5px] border-primary text-sm font-semibold transition-colors hover:bg-accent disabled:opacity-40"
            >
              Save override
            </button>
          </div>

          <div className="card-surface p-5">
            <h2 className="font-display text-base font-semibold">Resolution</h2>
            <div className="mt-3 space-y-2">
              <button
                onClick={() => setStatus("verified", "Resolution reviewed and accepted")}
                disabled={mutate.isPending}
                className="h-11 w-full rounded-xl bg-[#2A7C13] text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-40"
              >
                Accept resolution
              </button>
              <button
                onClick={() => setStatus("closed", "Complaint closed by authority")}
                disabled={mutate.isPending}
                className="h-11 w-full rounded-xl border-[1.5px] border-primary text-sm font-semibold transition-colors hover:bg-accent disabled:opacity-40"
              >
                Close complaint
              </button>
              <button
                onClick={() => setStatus("reopened", "Reopened — cleanup judged incomplete")}
                disabled={mutate.isPending}
                className="h-11 w-full rounded-xl border-[1.5px] border-destructive text-sm font-semibold text-destructive transition-colors hover:bg-destructive/10 disabled:opacity-40"
              >
                Reopen complaint
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 text-sm font-medium">{value}</dd>
    </div>
  );
}
