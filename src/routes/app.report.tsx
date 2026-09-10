import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { CheckCircle2, Copy, Loader2, RotateCcw, ShieldAlert, ThumbsUp } from "lucide-react";
import { toast } from "sonner";
import { CameraCapture } from "@/components/camera-capture";
import { LocationFacts, ReportQualityPanel } from "@/components/report-quality-panel";
import {
  analyzeCitizenReport,
  submitCitizenReport,
  supportExistingComplaint,
  type DuplicateMatch,
  type ReportAnalysis,
} from "@/lib/report-validation.functions";
import { CATEGORY_LABEL, PRIORITY_LABEL, type WasteCategory } from "@/lib/waste";
import {
  SEVERITY_LABEL,
  WASTE_AMOUNT_LABEL,
  type Severity,
  type WasteAmount,
} from "@/lib/validation-config";

export const Route = createFileRoute("/app/report")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Report Public Waste — NagarMitra" },
      {
        name: "description",
        content:
          "Capture a photo of waste in a public place. Your location is attached and the ward team is notified automatically.",
      },
      { property: "og:title", content: "Report Public Waste — NagarMitra" },
      {
        property: "og:description",
        content: "Photo plus location: your ward team gets it instantly.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ReportPage,
});

type Coords = { lat: number; lng: number; accuracy: number };

function getPosition(): Promise<Coords> {
  return new Promise((resolve, reject) => {
    if (!("geolocation" in navigator)) {
      reject(new Error("This device cannot share its location."));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (p) =>
        resolve({
          lat: p.coords.latitude,
          lng: p.coords.longitude,
          accuracy: p.coords.accuracy,
        }),
      () =>
        reject(
          new Error(
            "We need your location so the right ward team is sent. Allow location access and try again.",
          ),
        ),
      { enableHighAccuracy: true, timeout: 15000 },
    );
  });
}

function ReportPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const analyze = useServerFn(analyzeCitizenReport);
  const submit = useServerFn(submitCitizenReport);
  const support = useServerFn(supportExistingComplaint);

  const [photo, setPhoto] = useState<string | null>(null);
  const [coords, setCoords] = useState<Coords | null>(null);
  const [result, setResult] = useState<ReportAnalysis | null>(null);
  const [note, setNote] = useState("");
  const [landmark, setLandmark] = useState("");
  const [stage, setStage] = useState<
    "camera" | "working" | "confirm" | "rejected" | "duplicate" | "done"
  >("camera");
  const [duplicate, setDuplicate] = useState<DuplicateMatch | null>(null);
  const [done, setDone] = useState<{ reference: string; id: string; underReview: boolean } | null>(
    null,
  );

  function restart() {
    setPhoto(null);
    setResult(null);
    setDuplicate(null);
    setStage("camera");
  }

  async function onCapture(dataUrl: string) {
    setPhoto(dataUrl);
    setStage("working");
    try {
      const position = await getPosition();
      setCoords(position);
      const analysis = await analyze({
        data: {
          image: dataUrl,
          lat: position.lat,
          lng: position.lng,
          accuracy: position.accuracy,
          capturedAt: new Date().toISOString(),
        },
      });
      setResult(analysis);
      if (analysis.recommendation === "REJECT") {
        setStage("rejected");
      } else if (analysis.duplicateStatus === "DUPLICATE" && analysis.duplicate) {
        setDuplicate(analysis.duplicate);
        setStage("duplicate");
      } else {
        setStage("confirm");
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Something went wrong. Try again.");
      restart();
    }
  }

  async function sendReport() {
    if (!photo || !result) return;
    setStage("working");
    try {
      const outcome = await submit({
        data: { image: photo, token: result.token, note, landmark },
      });
      if (outcome.outcome === "duplicate") {
        setDuplicate(outcome.duplicate);
        setStage("duplicate");
        return;
      }
      await queryClient.invalidateQueries({ queryKey: ["my_complaints"] });
      setDone({
        reference: outcome.reference,
        id: outcome.complaintId,
        underReview: outcome.underReview,
      });
      setStage("done");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "We could not send your report.");
      setStage("confirm");
    }
  }

  async function confirmExisting() {
    if (!duplicate || !coords) return;
    setStage("working");
    try {
      const { reference } = await support({
        data: { complaintId: duplicate.complaintId, note, lat: coords.lat, lng: coords.lng },
      });
      toast.success(`Thanks — we added your confirmation to ${reference}.`);
      await queryClient.invalidateQueries({ queryKey: ["my_complaints"] });
      navigate({ to: "/app" });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "We could not add your confirmation.");
      setStage("duplicate");
    }
  }

  if (stage === "done" && done) {
    return (
      <div className="space-y-5 pt-10 text-center">
        <CheckCircle2 className="mx-auto h-14 w-14 text-primary" />
        <h1 className="font-display text-xl font-bold">Report sent</h1>
        <p className="text-sm text-muted-foreground">
          Your reference is <span className="font-semibold text-foreground">{done.reference}</span>.{" "}
          {done.underReview
            ? "A ward officer will look at it before it is assigned, because some checks were not conclusive."
            : "The ward team has it and you can follow the progress any time."}
        </p>
        <Link
          to="/app/reports/$id"
          params={{ id: done.id }}
          className="flex h-12 w-full items-center justify-center rounded-xl bg-primary font-semibold text-primary-foreground"
        >
          Track this report
        </Link>
        <button
          onClick={() => navigate({ to: "/app" })}
          className="h-12 w-full rounded-xl border border-border font-semibold"
        >
          Back to home
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <header>
        <h1 className="font-display text-xl font-bold">Report waste</h1>
        <p className="text-sm text-muted-foreground">
          Photos must be captured here and now, so the ward team can trust what they see.
        </p>
      </header>

      {stage === "camera" && (
        <CameraCapture
          instruction="Stand a few steps back so the whole spot is visible."
          onCapture={onCapture}
        />
      )}

      {stage === "working" && (
        <div className="space-y-4">
          {photo && <img src={photo} alt="Captured waste" className="w-full rounded-2xl" />}
          <p className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Checking the photo, your location and
            similar reports…
          </p>
        </div>
      )}

      {stage === "rejected" && result && photo && (
        <div className="space-y-4">
          <img src={photo} alt="Captured waste" className="w-full rounded-2xl" />
          <div className="card-surface space-y-2 border-destructive/40 p-5">
            <p className="flex items-center gap-2 font-display text-base font-semibold text-destructive">
              <ShieldAlert className="h-5 w-5" /> This photo cannot be registered
            </p>
            <p className="text-sm text-muted-foreground">{result.message}</p>
          </div>
          <ReportQualityPanel quality={result.quality} />
          <button
            onClick={restart}
            className="flex h-14 w-full items-center justify-center gap-2 rounded-xl bg-primary text-base font-semibold text-primary-foreground"
          >
            <RotateCcw className="h-4 w-4" /> Capture another photo
          </button>
        </div>
      )}

      {stage === "duplicate" && duplicate && (
        <div className="space-y-4">
          {photo && <img src={photo} alt="Captured waste" className="w-full rounded-2xl" />}
          <div className="card-surface space-y-2 p-5">
            <p className="flex items-center gap-2 font-display text-base font-semibold">
              <Copy className="h-5 w-5 text-secondary-foreground" /> Already reported
            </p>
            <p className="text-sm text-muted-foreground">
              This spot is already open as{" "}
              <span className="font-semibold text-foreground">{duplicate.reference}</span> —{" "}
              {duplicate.reason}. You can confirm the problem is still there instead of filing the
              same report twice.
            </p>
          </div>
          <label className="block space-y-1">
            <span className="text-sm font-semibold">Anything to add? (optional)</span>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              className="w-full rounded-xl border border-border bg-card p-4 text-sm"
            />
          </label>
          <button
            onClick={confirmExisting}
            className="flex h-14 w-full items-center justify-center gap-2 rounded-xl bg-primary text-base font-semibold text-primary-foreground"
          >
            <ThumbsUp className="h-5 w-5" /> Confirm this is still there
          </button>
          <button
            onClick={restart}
            className="flex h-12 w-full items-center justify-center gap-2 rounded-xl border border-border font-semibold"
          >
            <RotateCcw className="h-4 w-4" /> Report a different spot
          </button>
        </div>
      )}

      {stage === "confirm" && photo && result && (
        <div className="space-y-4">
          <img src={photo} alt="Captured waste" className="w-full rounded-2xl" />

          <div className="card-surface space-y-2 p-5">
            <p className="font-display text-base font-semibold">{result.label}</p>
            <p className="text-sm text-muted-foreground">
              {CATEGORY_LABEL[result.category as WasteCategory] ?? result.category} ·{" "}
              {WASTE_AMOUNT_LABEL[result.wasteAmount as WasteAmount]} · severity{" "}
              {SEVERITY_LABEL[result.severity as Severity]}
            </p>
            <p className="text-sm">{result.message}</p>
            <p className="text-xs text-muted-foreground">
              Suggested priority:{" "}
              {
                PRIORITY_LABEL[
                  result.severity === "SEVERE"
                    ? "critical"
                    : result.severity === "HIGH"
                      ? "high"
                      : result.severity === "MEDIUM"
                        ? "medium"
                        : "low"
                ]
              }
              . The category is AI-assisted; ward staff can correct it.
            </p>
          </div>

          <ReportQualityPanel quality={result.quality} />

          <LocationFacts
            locationName={result.locationName}
            lat={result.lat}
            lng={result.lng}
            gpsVerified={result.gpsVerified}
            timestampVerified={result.timestampVerified}
            timestamp={result.capturedAt}
          />

          {result.duplicateStatus === "REVIEW" && result.duplicate && (
            <p className="rounded-xl border border-border bg-card p-4 text-sm text-muted-foreground">
              This may be related to {result.duplicate.reference} ({result.duplicate.reason}). A
              ward officer will check.
            </p>
          )}

          <label className="block space-y-1">
            <span className="text-sm font-semibold">Nearest landmark (optional)</span>
            <input
              value={landmark}
              onChange={(e) => setLandmark(e.target.value)}
              placeholder="e.g. behind the bus stop"
              className="h-12 w-full rounded-xl border border-border bg-card px-4 text-sm"
            />
          </label>

          <label className="block space-y-1">
            <span className="text-sm font-semibold">Anything else? (optional)</span>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              className="w-full rounded-xl border border-border bg-card p-4 text-sm"
            />
          </label>

          <button
            onClick={sendReport}
            className="h-14 w-full rounded-xl bg-primary text-base font-semibold text-primary-foreground"
          >
            Send report
          </button>
          <button
            onClick={restart}
            className="flex h-12 w-full items-center justify-center gap-2 rounded-xl border border-border font-semibold"
          >
            <RotateCcw className="h-4 w-4" /> Retake photo
          </button>
        </div>
      )}
    </div>
  );
}
