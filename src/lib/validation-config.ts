/**
 * Single place for every tunable threshold used by report validation,
 * duplicate detection and worker completion verification.
 * Values can be overridden per environment with the matching env var.
 */

function num(name: string, fallback: number): number {
  const env = typeof process !== "undefined" ? process.env?.[name] : undefined;
  const parsed = env ? Number(env) : NaN;
  return Number.isFinite(parsed) ? parsed : fallback;
}

export const VALIDATION_CONFIG = {
  /** Worker completion photo must be taken within this distance of the reported spot. */
  COMPLETION_LOCATION_RADIUS_METERS: num("COMPLETION_LOCATION_RADIUS_METERS", 120),
  /** Reports closer than this to an active complaint are duplicate candidates. */
  DUPLICATE_LOCATION_RADIUS_METERS: num("DUPLICATE_LOCATION_RADIUS_METERS", 80),
  /** Only complaints reported inside this window count as duplicates. */
  DUPLICATE_TIME_WINDOW_HOURS: num("DUPLICATE_TIME_WINDOW_HOURS", 72),
  /** Below this AI confidence a report goes to review instead of being rejected. */
  AI_CONFIDENCE_THRESHOLD: num("AI_CONFIDENCE_THRESHOLD", 0.6),
  /** Duplicate confidence at or above this links the report to the existing complaint. */
  DUPLICATE_CONFIDENCE_THRESHOLD: num("DUPLICATE_CONFIDENCE_THRESHOLD", 0.7),
  /** Duplicate confidence at or above this is flagged for review. */
  DUPLICATE_REVIEW_THRESHOLD: num("DUPLICATE_REVIEW_THRESHOLD", 0.45),
  /** Maximum perceptual-hash difference (out of 64 bits) treated as the same scene. */
  IMAGE_HASH_MAX_DISTANCE: num("IMAGE_HASH_MAX_DISTANCE", 14),
  /** GPS fixes coarser than this are not treated as verified. */
  GPS_ACCURACY_METERS: num("GPS_ACCURACY_METERS", 150),
  /** Photo must have been taken within this many minutes of submitting. */
  TIMESTAMP_MAX_AGE_MINUTES: num("TIMESTAMP_MAX_AGE_MINUTES", 20),
  /** Quality score at or above this is a high quality report. */
  HIGH_QUALITY_SCORE: num("HIGH_QUALITY_SCORE", 80),
  /** Minimum waste amount + severity that count as a genuine public problem. */
  MIN_WASTE_AMOUNT: "MODERATE" as WasteAmount,
  MIN_SEVERITY: "MEDIUM" as Severity,
  /** How long an analysis result stays valid before the citizen must re-check. */
  ANALYSIS_TOKEN_TTL_MINUTES: num("ANALYSIS_TOKEN_TTL_MINUTES", 30),
};

export type WasteAmount = "NONE" | "LOW" | "MODERATE" | "HIGH";
export type Severity = "NONE" | "LOW" | "MEDIUM" | "HIGH" | "SEVERE";
export type Recommendation = "ACCEPT" | "REVIEW" | "REJECT";
export type QualityStatus = "HIGH_QUALITY" | "NEEDS_REVIEW" | "LOW_QUALITY";
export type DuplicateStatus = "UNIQUE" | "REVIEW" | "DUPLICATE";

export const WASTE_AMOUNT_RANK: Record<WasteAmount, number> = {
  NONE: 0,
  LOW: 1,
  MODERATE: 2,
  HIGH: 3,
};

export const SEVERITY_RANK: Record<Severity, number> = {
  NONE: 0,
  LOW: 1,
  MEDIUM: 2,
  HIGH: 3,
  SEVERE: 4,
};

export const WASTE_AMOUNT_LABEL: Record<WasteAmount, string> = {
  NONE: "No waste seen",
  LOW: "Very little waste",
  MODERATE: "Noticeable waste",
  HIGH: "Large amount of waste",
};

export const SEVERITY_LABEL: Record<Severity, string> = {
  NONE: "None",
  LOW: "Low",
  MEDIUM: "Medium",
  HIGH: "High",
  SEVERE: "Severe",
};
