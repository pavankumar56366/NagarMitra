import { useCallback, useEffect, useRef, useState } from "react";
import { Camera, RefreshCw, ShieldAlert } from "lucide-react";

type Props = {
  /** Called with a JPEG data URL once the citizen keeps a shot. */
  onCapture: (dataUrl: string) => void;
  instruction: string;
};

/**
 * Live camera preview with a capture canvas. Evidence must come from the camera,
 * so there is no gallery path here.
 */
export function CameraCapture({ onCapture, instruction }: Props) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [attempt, setAttempt] = useState(0);

  const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  useEffect(() => {
    let cancelled = false;
    setError(null);
    setReady(false);

    async function start() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" } },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => undefined);
        }
        setReady(true);
      } catch {
        if (!cancelled) {
          setError(
            "We need camera access to record what you are reporting. Allow the camera in your browser and try again.",
          );
        }
      }
    }

    void start();
    return () => {
      cancelled = true;
      stop();
    };
  }, [attempt, stop]);

  function capture() {
    const video = videoRef.current;
    if (!video) return;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth || 1080;
    canvas.height = video.videoHeight || 1440;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    stop();
    onCapture(canvas.toDataURL("image/jpeg", 0.82));
  }

  if (error) {
    return (
      <div className="card-surface flex flex-col items-center gap-4 p-6 text-center">
        <ShieldAlert className="h-8 w-8 text-destructive" />
        <p className="text-sm text-muted-foreground">{error}</p>
        <button
          onClick={() => setAttempt((a) => a + 1)}
          className="inline-flex h-12 items-center gap-2 rounded-xl bg-primary px-5 font-semibold text-primary-foreground"
        >
          <RefreshCw className="h-4 w-4" /> Try again
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="overflow-hidden rounded-2xl border border-border bg-black">
        <video ref={videoRef} playsInline muted className="aspect-[3/4] w-full object-cover" />
      </div>
      <p className="text-center text-sm text-muted-foreground">{instruction}</p>
      <button
        onClick={capture}
        disabled={!ready}
        className="flex h-14 w-full items-center justify-center gap-2 rounded-xl bg-primary text-base font-semibold text-primary-foreground disabled:opacity-40"
      >
        <Camera className="h-5 w-5" /> {ready ? "Capture photo" : "Starting camera…"}
      </button>
    </div>
  );
}
