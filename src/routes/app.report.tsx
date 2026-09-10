import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { CheckCircle2, Loader2, MapPin, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { CameraCapture } from "@/components/camera-capture";
import { uploadReportPhoto } from "@/lib/citizen";
import { classifyPublicWaste, type PublicWasteResult } from "@/lib/vision.functions";
import { CATEGORY_LABEL, PRIORITY_LABEL } from "@/lib/waste";
import { supabase } from "@/integrations/supabase/client";

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
  const classify = useServerFn(classifyPublicWaste);

  const [photo, setPhoto] = useState<string | null>(null);
  const [capturedAt, setCapturedAt] = useState<string | null>(null);
  const [coords, setCoords] = useState<Coords | null>(null);
  const [ai, setAi] = useState<PublicWasteResult | null>(null);
  const [note, setNote] = useState("");
  const [landmark, setLandmark] = useState("");
  const [stage, setStage] = useState<"camera" | "working" | "confirm" | "done">("camera");
  const [reference, setReference] = useState<string | null>(null);
  const [complaintId, setComplaintId] = useState<string | null>(null);

  async function onCapture(dataUrl: string) {
    setPhoto(dataUrl);
    setCapturedAt(new Date().toISOString());
    setStage("working");
    try {
      const [position, result] = await Promise.all([
        getPosition(),
        classify({ data: { image: dataUrl } }),
      ]);
      setCoords(position);
      setAi(result);
      setStage("confirm");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Something went wrong. Try again.");
      setStage("camera");
      setPhoto(null);
    }
  }

  async function submit() {
    if (!photo || !coords || !ai) return;
    setStage("working");
    try {
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData.user?.id;
      if (!uid) throw new Error("You need to be signed in.");

      const path = await uploadReportPhoto(photo);
      const { data, error } = await supabase
        .from("complaints")
        .insert({
          citizen_id: uid,
          citizen_name: userData.user?.user_metadata?.["full_name"] ?? "Citizen",
          lat: coords.lat,
          lng: coords.lng,
          address: landmark,
          description: note,
          citizen_note: note,
          photo_url: path,
          ai_label: ai.label,
          ai_confidence: ai.confidence,
          waste_category: ai.category,
          priority: ai.priority,
          captured_at: capturedAt,
        })
        .select("id, reference")
        .single();
      if (error) throw new Error(error.message);

      await supabase.from("complaint_events").insert({
        complaint_id: data.id,
        event_type: "reported",
        actor: "Citizen",
        detail: `Reported ${ai.label} (${CATEGORY_LABEL[ai.category]})`,
      });

      await queryClient.invalidateQueries({ queryKey: ["my_complaints"] });
      setReference(data.reference);
      setComplaintId(data.id);
      setStage("done");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "We could not send your report.");
      setStage("confirm");
    }
  }

  if (stage === "done" && reference) {
    return (
      <div className="space-y-5 pt-10 text-center">
        <CheckCircle2 className="mx-auto h-14 w-14 text-primary" />
        <h1 className="font-display text-xl font-bold">Report sent</h1>
        <p className="text-sm text-muted-foreground">
          Your reference is <span className="font-semibold text-foreground">{reference}</span>. The
          ward team has it and you can follow the progress any time.
        </p>
        {complaintId && (
          <Link
            to="/app/reports/$id"
            params={{ id: complaintId }}
            className="flex h-12 w-full items-center justify-center rounded-xl bg-primary font-semibold text-primary-foreground"
          >
            Track this report
          </Link>
        )}
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
          Photos must be taken here and now, so the ward team can trust what they see.
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
            <Loader2 className="h-4 w-4 animate-spin" /> Checking the photo and your location…
          </p>
        </div>
      )}

      {stage === "confirm" && photo && ai && coords && (
        <div className="space-y-4">
          <img src={photo} alt="Captured waste" className="w-full rounded-2xl" />

          <div className="card-surface space-y-2 p-5">
            <p className="font-display text-base font-semibold">{ai.label}</p>
            <p className="text-sm text-muted-foreground">
              {CATEGORY_LABEL[ai.category]} · {PRIORITY_LABEL[ai.priority]} priority ·{" "}
              {Math.round(ai.confidence * 100)}% confidence
            </p>
            {ai.summary && <p className="text-sm">{ai.summary}</p>}
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <MapPin className="h-4 w-4" /> {coords.lat.toFixed(5)}, {coords.lng.toFixed(5)} (±
              {Math.round(coords.accuracy)} m)
            </p>
            <p className="text-xs text-muted-foreground">
              The category is AI-assisted; ward staff can correct it.
            </p>
          </div>

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
            onClick={submit}
            className="h-14 w-full rounded-xl bg-primary text-base font-semibold text-primary-foreground"
          >
            Send report
          </button>
          <button
            onClick={() => {
              setPhoto(null);
              setAi(null);
              setStage("camera");
            }}
            className="flex h-12 w-full items-center justify-center gap-2 rounded-xl border border-border font-semibold"
          >
            <RotateCcw className="h-4 w-4" /> Retake photo
          </button>
        </div>
      )}
    </div>
  );
}
