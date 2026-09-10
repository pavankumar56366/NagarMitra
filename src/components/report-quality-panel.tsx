import { Check, X, AlertTriangle } from "lucide-react";
import type { ReportQuality } from "@/lib/report-scoring";
import { QUALITY_STATUS_LABEL } from "@/lib/report-scoring";
import type { QualityStatus } from "@/lib/validation-config";
import { cn } from "@/lib/utils";

const CHECK_LABELS: Array<{ key: keyof ReportQuality; label: string }> = [
  { key: "photo_clear", label: "Clear photo" },
  { key: "gps_verified", label: "GPS verified" },
  { key: "significant_waste_detected", label: "Significant waste detected" },
  { key: "serious_issue_detected", label: "Serious issue detected" },
  { key: "timestamp_verified", label: "Timestamp verified" },
];

/** Verification indicators, driven entirely by the stored validation result. */
export function ReportQualityPanel({
  quality,
  score,
  className,
}: {
  quality: Partial<ReportQuality> | null | undefined;
  score?: number | null | undefined;
  className?: string | undefined;
}) {
  if (!quality || Object.keys(quality).length === 0) return null;
  const status = (quality.status ?? "NEEDS_REVIEW") as QualityStatus;
  const overall = score ?? quality.overall_score ?? 0;

  return (
    <div className={cn("card-surface space-y-3 p-5", className)}>
      <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
        Report quality
      </h2>
      <ul className="space-y-1.5">
        {CHECK_LABELS.map(({ key, label }) => {
          const ok = Boolean(quality[key]);
          return (
            <li key={key} className="flex items-center gap-2 text-sm">
              {ok ? (
                <Check className="h-4 w-4 text-primary" />
              ) : (
                <X className="h-4 w-4 text-destructive" />
              )}
              <span className={ok ? "" : "text-muted-foreground"}>{label}</span>
            </li>
          );
        })}
      </ul>
      <div className="flex flex-wrap items-center gap-2 border-t border-border pt-3 text-sm">
        {status === "HIGH_QUALITY" ? (
          <Check className="h-4 w-4 text-primary" />
        ) : status === "NEEDS_REVIEW" ? (
          <AlertTriangle className="h-4 w-4 text-secondary-foreground" />
        ) : (
          <X className="h-4 w-4 text-destructive" />
        )}
        <span className="font-semibold">{QUALITY_STATUS_LABEL[status]}</span>
        <span className="text-muted-foreground">
          {overall}/100
          {typeof quality.confidence === "number"
            ? ` · ${Math.round(quality.confidence * 100)}% AI confidence`
            : ""}
        </span>
      </div>
      {quality.validation_reason ? (
        <p className="text-sm text-muted-foreground">{quality.validation_reason}</p>
      ) : null}
    </div>
  );
}

/** Location name + coordinates + verification flags, shared by all roles. */
export function LocationFacts({
  locationName,
  lat,
  lng,
  gpsVerified,
  timestampVerified,
  timestamp,
  distanceLabel,
  title = "Location",
}: {
  locationName: string;
  lat: number;
  lng: number;
  gpsVerified?: boolean | null;
  timestampVerified?: boolean | null;
  timestamp?: string | null;
  distanceLabel?: string | null;
  title?: string;
}) {
  return (
    <dl className="card-surface grid gap-3 p-5 text-sm sm:grid-cols-2">
      <div className="sm:col-span-2">
        <dt className="text-xs text-muted-foreground">{title}</dt>
        <dd className="mt-0.5 font-medium">{locationName || "Not available"}</dd>
      </div>
      <div>
        <dt className="text-xs text-muted-foreground">Latitude</dt>
        <dd className="mt-0.5 font-mono">{lat.toFixed(5)}</dd>
      </div>
      <div>
        <dt className="text-xs text-muted-foreground">Longitude</dt>
        <dd className="mt-0.5 font-mono">{lng.toFixed(5)}</dd>
      </div>
      {typeof gpsVerified === "boolean" && (
        <div>
          <dt className="text-xs text-muted-foreground">GPS</dt>
          <dd className="mt-0.5 flex items-center gap-1.5 font-medium">
            {gpsVerified ? (
              <>
                <Check className="h-4 w-4 text-primary" /> Verified
              </>
            ) : (
              <>
                <X className="h-4 w-4 text-destructive" /> Not verified
              </>
            )}
          </dd>
        </div>
      )}
      {timestamp && (
        <div>
          <dt className="text-xs text-muted-foreground">Timestamp</dt>
          <dd className="mt-0.5 flex items-center gap-1.5 font-medium">
            {typeof timestampVerified === "boolean" &&
              (timestampVerified ? (
                <Check className="h-4 w-4 text-primary" />
              ) : (
                <X className="h-4 w-4 text-destructive" />
              ))}
            {new Date(timestamp).toLocaleString(undefined, {
              day: "2-digit",
              month: "long",
              year: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </dd>
        </div>
      )}
      {distanceLabel && (
        <div className="sm:col-span-2">
          <dt className="text-xs text-muted-foreground">Distance from reported location</dt>
          <dd className="mt-0.5 font-medium">{distanceLabel}</dd>
        </div>
      )}
    </dl>
  );
}
