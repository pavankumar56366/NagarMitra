/**
 * The citizen reporting pipeline, enforced on the server:
 * photo -> GPS -> timestamp -> location name -> photo quality -> AI analysis ->
 * waste amount -> severity -> GPS check -> timestamp check -> duplicate detection ->
 * report quality -> ACCEPT / REVIEW / REJECT -> complaint creation.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { analyzeReportImage } from "./report-ai.server";
import { reverseGeocode } from "./geocode.server";
import {
  averageHash,
  dataUrlToBytes,
  sha256Hex,
  signPayload,
  verifyPayload,
} from "./report-crypto.server";
import { boundingBox, distanceMeters, hammingDistance } from "./geo";
import { priorityFromSeverity, scoreReport, type ReportQuality } from "./report-scoring";
import {
  VALIDATION_CONFIG as CFG,
  type DuplicateStatus,
  type Recommendation,
  type Severity,
  type WasteAmount,
} from "./validation-config";

const OPEN_STATUSES = ["pending", "assigned", "in_progress", "escalated", "reopened"] as const;

const analyzeInput = z.object({
  image: z.string().min(64).max(12_000_000),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  accuracy: z.number().min(0).max(100_000),
  capturedAt: z.string().datetime(),
});

export type DuplicateMatch = {
  complaintId: string;
  reference: string;
  status: string;
  category: string;
  severity: string;
  distanceMeters: number;
  hoursAgo: number;
  confidence: number;
  reason: string;
  locationName: string;
};

export type ReportAnalysis = {
  locationName: string;
  lat: number;
  lng: number;
  accuracy: number;
  capturedAt: string;
  gpsVerified: boolean;
  timestampVerified: boolean;
  photoQuality: "GOOD" | "FAIR" | "POOR";
  label: string;
  category: string;
  wasteAmount: WasteAmount;
  severity: Severity;
  confidence: number;
  aiReason: string;
  quality: ReportQuality;
  recommendation: Recommendation;
  message: string;
  duplicate: DuplicateMatch | null;
  duplicateStatus: DuplicateStatus;
  /** Signed proof of this verdict; the submit step refuses anything else. */
  token: string;
};

type TokenPayload = {
  userId: string;
  imageSha: string;
  imageHash: string;
  lat: number;
  lng: number;
  accuracy: number;
  capturedAt: string;
  locationName: string;
  label: string;
  category: string;
  wasteAmount: WasteAmount;
  severity: Severity;
  confidence: number;
  publicHealthRisk: boolean;
  quality: ReportQuality;
  recommendation: Recommendation;
  exp: number;
};

type Candidate = {
  id: string;
  reference: string;
  status: string;
  waste_category: string;
  severity: string | null;
  lat: number;
  lng: number;
  created_at: string;
  image_hash: string | null;
  location_name: string | null;
  address: string | null;
};

/** Combines location, category, photo similarity and time into one confidence. */
function scoreDuplicate(
  candidate: Candidate,
  input: { lat: number; lng: number; category: string; imageHash: string; now: number },
): DuplicateMatch | null {
  const distance = distanceMeters(
    { lat: input.lat, lng: input.lng },
    { lat: candidate.lat, lng: candidate.lng },
  );
  if (distance > CFG.DUPLICATE_LOCATION_RADIUS_METERS) return null;

  const hoursAgo = (input.now - new Date(candidate.created_at).getTime()) / 3_600_000;
  if (hoursAgo > CFG.DUPLICATE_TIME_WINDOW_HOURS) return null;

  const distanceScore = 1 - distance / CFG.DUPLICATE_LOCATION_RADIUS_METERS;
  const timeScore = 1 - hoursAgo / CFG.DUPLICATE_TIME_WINDOW_HOURS;
  const categoryScore = candidate.waste_category === input.category ? 1 : 0;

  const bothHashes = Boolean(input.imageHash && candidate.image_hash);
  const bits = bothHashes ? hammingDistance(input.imageHash, candidate.image_hash!) : 64;
  const imageScore = bothHashes ? Math.max(0, 1 - bits / 32) : 0;

  const weights = bothHashes
    ? { distance: 0.35, category: 0.2, time: 0.15, image: 0.3 }
    : { distance: 0.5, category: 0.3, time: 0.2, image: 0 };

  const confidence =
    distanceScore * weights.distance +
    categoryScore * weights.category +
    timeScore * weights.time +
    imageScore * weights.image;

  const reasons = [`${Math.round(distance)} m away`, `${hoursAgo.toFixed(1)} h earlier`];
  reasons.push(categoryScore ? "same waste type" : "different waste type");
  if (bothHashes) {
    reasons.push(
      bits <= CFG.IMAGE_HASH_MAX_DISTANCE
        ? "photo looks like the same spot"
        : "photo looks different",
    );
  } else {
    reasons.push("photo comparison unavailable");
  }

  return {
    complaintId: candidate.id,
    reference: candidate.reference,
    status: candidate.status,
    category: candidate.waste_category,
    severity: candidate.severity ?? "UNKNOWN",
    distanceMeters: Math.round(distance),
    hoursAgo: Number(hoursAgo.toFixed(1)),
    confidence: Number(confidence.toFixed(2)),
    reason: reasons.join(", "),
    locationName: candidate.location_name || candidate.address || "",
  };
}

async function findDuplicate(args: {
  lat: number;
  lng: number;
  category: string;
  imageHash: string;
  excludeCitizenComplaintId?: string;
}): Promise<{ match: DuplicateMatch | null; status: DuplicateStatus }> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const box = boundingBox(args.lat, args.lng, CFG.DUPLICATE_LOCATION_RADIUS_METERS);
  const cutoff = new Date(Date.now() - CFG.DUPLICATE_TIME_WINDOW_HOURS * 3_600_000).toISOString();

  const { data, error } = await supabaseAdmin
    .from("complaints")
    .select(
      "id,reference,status,waste_category,severity,lat,lng,created_at,image_hash,location_name,address",
    )
    .gte("created_at", cutoff)
    .gte("lat", box.minLat)
    .lte("lat", box.maxLat)
    .gte("lng", box.minLng)
    .lte("lng", box.maxLng)
    .in("status", [...OPEN_STATUSES])
    .is("deleted_at", null)
    .limit(200);
  if (error) throw new Error(error.message);

  const now = Date.now();
  const matches = ((data ?? []) as unknown as Candidate[])
    .filter((c) => c.id !== args.excludeCitizenComplaintId)
    .map((c) => scoreDuplicate(c, { ...args, now }))
    .filter((m): m is DuplicateMatch => m !== null)
    .sort((a, b) => b.confidence - a.confidence);

  const best = matches[0] ?? null;
  if (!best) return { match: null, status: "UNIQUE" };
  if (best.confidence >= CFG.DUPLICATE_CONFIDENCE_THRESHOLD)
    return { match: best, status: "DUPLICATE" };
  if (best.confidence >= CFG.DUPLICATE_REVIEW_THRESHOLD) return { match: best, status: "REVIEW" };
  return { match: null, status: "UNIQUE" };
}

/** Step 1: run the full validation pipeline and return the verdict, no writes. */
export const analyzeCitizenReport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => analyzeInput.parse(data))
  .handler(async ({ data, context }): Promise<ReportAnalysis> => {
    const capturedMs = new Date(data.capturedAt).getTime();
    const ageMinutes = Math.abs(Date.now() - capturedMs) / 60_000;
    const timestampVerified = ageMinutes <= CFG.TIMESTAMP_MAX_AGE_MINUTES;
    // Some browsers report an accuracy of 0 for a perfect fix, so only coarse fixes fail.
    const gpsVerified =
      data.accuracy <= CFG.GPS_ACCURACY_METERS &&
      Math.abs(data.lat) > 0.0001 &&
      Math.abs(data.lng) > 0.0001;

    const bytes = dataUrlToBytes(data.image);
    const [ai, locationName, imageSha] = await Promise.all([
      analyzeReportImage(data.image),
      reverseGeocode(data.lat, data.lng),
      sha256Hex(bytes),
    ]);
    const imageHash = averageHash(bytes);

    const scored = scoreReport({
      photoClear: ai.photo.photo_clear,
      photoQuality: ai.photo.quality,
      issueDetected: ai.issue.issue_detected,
      wasteAmount: ai.waste_amount,
      severity: ai.severity,
      confidence: ai.confidence,
      gpsVerified,
      timestampVerified,
      aiReason: ai.reason,
    });

    const duplicate =
      scored.recommendation === "REJECT"
        ? { match: null, status: "UNIQUE" as DuplicateStatus }
        : await findDuplicate({
            lat: data.lat,
            lng: data.lng,
            category: ai.issue.category,
            imageHash,
          });

    const payload: TokenPayload = {
      userId: context.userId,
      imageSha,
      imageHash,
      lat: data.lat,
      lng: data.lng,
      accuracy: data.accuracy,
      capturedAt: data.capturedAt,
      locationName,
      label: ai.issue.label,
      category: ai.issue.category,
      wasteAmount: ai.waste_amount,
      severity: ai.severity,
      confidence: ai.confidence,
      publicHealthRisk: ai.issue.public_health_risk,
      quality: scored.quality,
      recommendation: scored.recommendation,
      exp: Date.now() + CFG.ANALYSIS_TOKEN_TTL_MINUTES * 60_000,
    };

    return {
      locationName,
      lat: data.lat,
      lng: data.lng,
      accuracy: data.accuracy,
      capturedAt: data.capturedAt,
      gpsVerified,
      timestampVerified,
      photoQuality: ai.photo.quality,
      label: ai.issue.label,
      category: ai.issue.category,
      wasteAmount: ai.waste_amount,
      severity: ai.severity,
      confidence: ai.confidence,
      aiReason: ai.reason,
      quality: scored.quality,
      recommendation: scored.recommendation,
      message: scored.message,
      duplicate: duplicate.match,
      duplicateStatus: duplicate.status,
      token: await signPayload(payload),
    };
  });

const submitInput = z.object({
  image: z.string().min(64).max(12_000_000),
  token: z.string().min(20),
  note: z.string().max(2000).optional(),
  landmark: z.string().max(300).optional(),
});

export type SubmitResult =
  | { outcome: "created"; complaintId: string; reference: string; underReview: boolean }
  | { outcome: "duplicate"; duplicate: DuplicateMatch };

/** Step 2: re-check the signed verdict server-side, then create the complaint. */
export const submitCitizenReport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => submitInput.parse(data))
  .handler(async ({ data, context }): Promise<SubmitResult> => {
    const payload = await verifyPayload<TokenPayload>(data.token);

    if (payload.userId !== context.userId)
      throw new Error("This validation does not belong to you.");
    if (payload.exp < Date.now())
      throw new Error("This check has expired. Please retake the photo.");

    const bytes = dataUrlToBytes(data.image);
    if ((await sha256Hex(bytes)) !== payload.imageSha)
      throw new Error("The photo does not match the validated one. Please retake the photo.");

    if (payload.recommendation === "REJECT")
      throw new Error(
        "Your image does not show a sufficiently serious public sanitation issue, so it cannot be registered.",
      );

    // Duplicate detection runs again at submit time so a stale check cannot slip through.
    const duplicate = await findDuplicate({
      lat: payload.lat,
      lng: payload.lng,
      category: payload.category,
      imageHash: payload.imageHash,
    });
    if (duplicate.status === "DUPLICATE" && duplicate.match)
      return { outcome: "duplicate", duplicate: duplicate.match };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const path = `${context.userId}/${Date.now()}.jpg`;
    const { error: uploadError } = await supabaseAdmin.storage
      .from("complaint-photos")
      .upload(path, bytes, { contentType: "image/jpeg", upsert: false });
    if (uploadError) throw new Error(uploadError.message);

    const { data: profile } = await context.supabase
      .from("profiles")
      .select("full_name,email")
      .eq("id", context.userId)
      .maybeSingle();

    const underReview = payload.recommendation === "REVIEW";

    const { data: created, error } = await supabaseAdmin
      .from("complaints")
      .insert({
        citizen_id: context.userId,
        citizen_name: profile?.full_name || profile?.email || "Citizen",
        lat: payload.lat,
        lng: payload.lng,
        address: data.landmark?.trim() || payload.locationName,
        location_name: payload.locationName,
        description: data.note?.trim() || "",
        citizen_note: data.note?.trim() || "",
        photo_url: path,
        image_hash: payload.imageHash,
        ai_label: payload.label,
        ai_confidence: payload.confidence,
        waste_category: payload.category,
        priority: priorityFromSeverity(payload.severity, payload.publicHealthRisk),
        captured_at: payload.capturedAt,
        reported_at: new Date().toISOString(),
        issue_detected: true,
        waste_amount: payload.wasteAmount,
        severity: payload.severity,
        report_quality: payload.quality,
        report_quality_score: payload.quality.overall_score,
        report_validation_status: payload.recommendation,
        validation_reason: payload.quality.validation_reason,
        duplicate_status: duplicate.status,
        duplicate_of_complaint_id: duplicate.match?.complaintId ?? null,
        duplicate_confidence: duplicate.match?.confidence ?? 0,
        duplicate_detection_reason: duplicate.match?.reason ?? "",
      } as never)
      .select("id,reference")
      .single();
    if (error) throw new Error(error.message);

    const complaint = created as { id: string; reference: string };

    const events = [
      {
        complaint_id: complaint.id,
        actor: "citizen",
        event_type: "reported",
        detail: `Reported ${payload.label} at ${payload.locationName}`,
      },
      {
        complaint_id: complaint.id,
        actor: "ai",
        event_type: underReview ? "ai_review" : "ai_validated",
        detail: `${payload.recommendation} · quality ${payload.quality.overall_score}/100 · ${Math.round(
          payload.confidence * 100,
        )}% confidence · ${payload.quality.validation_reason}`,
      },
    ];
    if (duplicate.status === "REVIEW" && duplicate.match) {
      events.push({
        complaint_id: complaint.id,
        actor: "ai",
        event_type: "duplicate_review",
        detail: `Possible duplicate of ${duplicate.match.reference} (${Math.round(
          duplicate.match.confidence * 100,
        )}%): ${duplicate.match.reason}`,
      });
    }
    const { error: eventError } = await supabaseAdmin.from("complaint_events").insert(events);
    if (eventError) throw new Error(eventError.message);

    return {
      outcome: "created",
      complaintId: complaint.id,
      reference: complaint.reference,
      underReview,
    };
  });

const supportInput = z.object({
  complaintId: z.string().uuid(),
  note: z.string().max(500).optional(),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});

/** A second citizen backs an existing complaint instead of filing a duplicate. */
export const supportExistingComplaint = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => supportInput.parse(data))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: complaint, error: readError } = await supabaseAdmin
      .from("complaints")
      .select("id,reference,status,lat,lng,citizen_id,deleted_at")
      .eq("id", data.complaintId)
      .maybeSingle();
    if (readError) throw new Error(readError.message);
    if (!complaint) throw new Error("That complaint no longer exists.");

    const row = complaint as {
      id: string;
      reference: string;
      lat: number;
      lng: number;
      citizen_id: string | null;
      deleted_at: string | null;
    };
    if (row.deleted_at) throw new Error("That complaint has been withdrawn.");
    if (row.citizen_id === context.userId) throw new Error("This is already your own report.");

    // Only someone standing at the same spot may support the complaint.
    const distance = distanceMeters(
      { lat: data.lat, lng: data.lng },
      { lat: row.lat, lng: row.lng },
    );
    if (distance > CFG.DUPLICATE_LOCATION_RADIUS_METERS * 2)
      throw new Error("You are too far from that complaint to confirm it.");

    const { error } = await supabaseAdmin.from("complaint_supports").upsert(
      {
        complaint_id: row.id,
        citizen_id: context.userId,
        note: data.note?.trim() || "",
        lat: data.lat,
        lng: data.lng,
      } as never,
      { onConflict: "complaint_id,citizen_id" },
    );
    if (error) throw new Error(error.message);

    const { error: eventError } = await supabaseAdmin.from("complaint_events").insert({
      complaint_id: row.id,
      actor: "citizen",
      event_type: "supported",
      detail: data.note?.trim() || "Another resident confirmed this problem is still there.",
    });
    if (eventError) throw new Error(eventError.message);

    return { reference: row.reference };
  });
