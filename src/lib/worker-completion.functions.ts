/**
 * Worker completion evidence: mandatory photo, GPS comparison against the
 * reported location, and the status change to resolved. Every check runs on the
 * server, so a crafted request cannot mark a job done from the wrong place.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { analyzeCompletionImage } from "./report-ai.server";
import { reverseGeocode } from "./geocode.server";
import { dataUrlToBytes } from "./report-crypto.server";
import { distanceMeters } from "./geo";
import { VALIDATION_CONFIG as CFG } from "./validation-config";

const completionInput = z.object({
  complaintId: z.string().uuid(),
  image: z.string().min(64).max(12_000_000),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  accuracy: z.number().min(0).max(100_000),
  capturedAt: z.string().datetime(),
  note: z.string().max(1000).optional(),
});

const WORKABLE = ["assigned", "in_progress", "escalated", "reopened"] as const;

export type CompletionResult = {
  outcome: "completed" | "rejected";
  gpsVerified: boolean;
  distanceMeters: number;
  allowedRadiusMeters: number;
  locationName: string;
  message: string;
  looksCleaned: boolean;
  aiReason: string;
};

export const submitWorkerCompletion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => completionInput.parse(data))
  .handler(async ({ data, context }): Promise<CompletionResult> => {
    // The worker's own RLS view proves the job is assigned to them.
    const { data: complaint, error: readError } = await context.supabase
      .from("complaints")
      .select(
        "id,status,lat,lng,assigned_worker_id,assigned_worker_user_id,deleted_at,sla_start,sla_deadline",
      )
      .eq("id", data.complaintId)
      .eq("assigned_worker_user_id", context.userId)
      .maybeSingle();
    if (readError) throw new Error(readError.message);
    if (!complaint) throw new Error("This job is not assigned to you.");

    const row = complaint as {
      id: string;
      status: string;
      lat: number;
      lng: number;
      assigned_worker_id: string | null;
      deleted_at: string | null;
      sla_start: string | null;
      sla_deadline: string | null;
    };
    if (row.deleted_at || row.status === "cancelled")
      throw new Error("This report was withdrawn, so no completion can be recorded.");
    if (!(WORKABLE as readonly string[]).includes(row.status))
      throw new Error("This job is not open for completion any more.");

    const distance = distanceMeters(
      { lat: data.lat, lng: data.lng },
      { lat: row.lat, lng: row.lng },
    );
    // Some browsers report an accuracy of 0 for a perfect fix, so only coarse fixes fail.
    const gpsAccurate = data.accuracy <= CFG.GPS_ACCURACY_METERS;
    const gpsVerified = gpsAccurate && distance <= CFG.COMPLETION_LOCATION_RADIUS_METERS;

    const bytes = dataUrlToBytes(data.image);
    const [locationName, ai] = await Promise.all([
      reverseGeocode(data.lat, data.lng),
      analyzeCompletionImage(data.image).catch(() => ({
        looks_cleaned: false,
        photo_clear: false,
        remaining_waste: "MODERATE" as const,
        confidence: 0,
        reason: "The completion photo could not be checked automatically.",
      })),
    ]);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    let imagePath = "";
    if (gpsVerified) {
      imagePath = `${context.userId}/completion-${row.id}-${Date.now()}.jpg`;
      const { error: uploadError } = await supabaseAdmin.storage
        .from("complaint-photos")
        .upload(imagePath, bytes, { contentType: "image/jpeg", upsert: false });
      if (uploadError) throw new Error(uploadError.message);
    }

    const message = gpsVerified
      ? "Completion evidence accepted and sent for ward verification."
      : gpsAccurate
        ? `Completion cannot be verified because you are too far from the reported location (${Math.round(
            distance,
          )} m away, limit ${CFG.COMPLETION_LOCATION_RADIUS_METERS} m). Please capture the completion photo at the reported location.`
        : "Your location fix is too weak to verify completion. Move to open sky at the reported location and try again.";

    const { error: evidenceError } = await supabaseAdmin.from("completion_evidence").insert({
      complaint_id: row.id,
      worker_id: row.assigned_worker_id,
      worker_user_id: context.userId,
      image_path: imagePath,
      latitude: data.lat,
      longitude: data.lng,
      location_name: locationName,
      captured_at: data.capturedAt,
      gps_verified: gpsVerified,
      distance_from_reported_location: Math.round(distance),
      completion_validation_status: gpsVerified ? "VERIFIED" : "REJECTED",
      validation_reason: `${ai.reason} (${message})`,
    } as never);
    if (evidenceError) throw new Error(evidenceError.message);

    if (!gpsVerified) {
      await supabaseAdmin.from("complaint_events").insert({
        complaint_id: row.id,
        actor: "field crew",
        event_type: "completion_rejected",
        detail: `Completion photo rejected: ${Math.round(distance)} m from the reported location.`,
      });
      return {
        outcome: "rejected",
        gpsVerified: false,
        distanceMeters: Math.round(distance),
        allowedRadiusMeters: CFG.COMPLETION_LOCATION_RADIUS_METERS,
        locationName,
        message,
        looksCleaned: ai.looks_cleaned,
        aiReason: ai.reason,
      };
    }

    const { error: updateError } = await supabaseAdmin
      .from("complaints")
      .update({ status: "resolved", resolved_at: new Date().toISOString() } as never)
      .eq("id", row.id)
      .eq("assigned_worker_user_id", context.userId);
    if (updateError) throw new Error(updateError.message);

    const { error: eventError } = await supabaseAdmin.from("complaint_events").insert({
      complaint_id: row.id,
      actor: "field crew",
      event_type: "work_completed",
      detail: `${data.note?.trim() || "Spot cleared."} Completion photo verified ${Math.round(
        distance,
      )} m from the reported location at ${locationName}. AI check: ${ai.reason}`,
    });
    if (eventError) throw new Error(eventError.message);

    return {
      outcome: "completed",
      gpsVerified: true,
      distanceMeters: Math.round(distance),
      allowedRadiusMeters: CFG.COMPLETION_LOCATION_RADIUS_METERS,
      locationName,
      message,
      looksCleaned: ai.looks_cleaned,
      aiReason: ai.reason,
    };
  });
