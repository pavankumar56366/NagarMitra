/**
 * Pure scoring rules: turns raw AI output plus GPS/timestamp checks into the
 * structured report-quality record stored with every complaint.
 * No AI call and no database access here, so both the UI and the server share it.
 */
import {
  SEVERITY_RANK,
  VALIDATION_CONFIG as CFG,
  WASTE_AMOUNT_RANK,
  type QualityStatus,
  type Recommendation,
  type Severity,
  type WasteAmount,
} from "./validation-config";

export type ReportQuality = {
  photo_clear: boolean;
  gps_verified: boolean;
  significant_waste_detected: boolean;
  serious_issue_detected: boolean;
  timestamp_verified: boolean;
  overall_score: number;
  confidence: number;
  status: QualityStatus;
  validation_reason: string;
};

export type ScoringInput = {
  photoClear: boolean;
  photoQuality: "GOOD" | "FAIR" | "POOR";
  issueDetected: boolean;
  wasteAmount: WasteAmount;
  severity: Severity;
  confidence: number;
  gpsVerified: boolean;
  timestampVerified: boolean;
  aiReason: string;
};

export type ValidationOutcome = {
  quality: ReportQuality;
  recommendation: Recommendation;
  /** Citizen-facing explanation. */
  message: string;
};

export function scoreReport(input: ScoringInput): ValidationOutcome {
  const significantWaste =
    WASTE_AMOUNT_RANK[input.wasteAmount] >= WASTE_AMOUNT_RANK[CFG.MIN_WASTE_AMOUNT];
  const seriousIssue =
    input.issueDetected && SEVERITY_RANK[input.severity] >= SEVERITY_RANK[CFG.MIN_SEVERITY];

  const checks = [
    input.photoClear,
    input.gpsVerified,
    significantWaste,
    seriousIssue,
    input.timestampVerified,
  ];
  const passed = checks.filter(Boolean).length;
  const overall = Math.round((passed / checks.length) * 100 * (0.6 + 0.4 * input.confidence));

  const lowConfidence = input.confidence < CFG.AI_CONFIDENCE_THRESHOLD;

  let recommendation: Recommendation;
  let message: string;

  if (lowConfidence) {
    // Never reject on a weak reading — a human decides instead.
    recommendation = "REVIEW";
    message =
      "We could not judge this photo confidently, so your report needs ward verification before it is registered.";
  } else if (!input.issueDetected || (!significantWaste && !seriousIssue)) {
    recommendation = "REJECT";
    message =
      "Your image does not show a sufficiently serious public sanitation issue. Please capture the full extent of the problem, or report a different spot.";
  } else if (!input.photoClear || input.photoQuality === "POOR") {
    recommendation = "REVIEW";
    message =
      "The photo is not clear enough to confirm on its own, so your report requires verification before it can be registered.";
  } else if (!significantWaste || !seriousIssue || !input.gpsVerified || !input.timestampVerified) {
    recommendation = "REVIEW";
    message = "Your report requires verification before it can be registered.";
  } else {
    recommendation = "ACCEPT";
    message = "This is a high quality report and is ready to submit.";
  }

  const status: QualityStatus =
    recommendation === "REJECT"
      ? "LOW_QUALITY"
      : recommendation === "REVIEW" || overall < CFG.HIGH_QUALITY_SCORE
        ? "NEEDS_REVIEW"
        : "HIGH_QUALITY";

  return {
    recommendation,
    message,
    quality: {
      photo_clear: input.photoClear,
      gps_verified: input.gpsVerified,
      significant_waste_detected: significantWaste,
      serious_issue_detected: seriousIssue,
      timestamp_verified: input.timestampVerified,
      overall_score: overall,
      confidence: input.confidence,
      status,
      validation_reason: input.aiReason,
    },
  };
}

/** Severity drives the operational priority of the complaint. */
export function priorityFromSeverity(
  severity: Severity,
  publicHealthRisk: boolean,
): "critical" | "high" | "medium" | "low" {
  if (severity === "SEVERE" || publicHealthRisk) return "critical";
  if (severity === "HIGH") return "high";
  if (severity === "MEDIUM") return "medium";
  return "low";
}

export const QUALITY_STATUS_LABEL: Record<QualityStatus, string> = {
  HIGH_QUALITY: "High quality report",
  NEEDS_REVIEW: "Needs review",
  LOW_QUALITY: "Low quality / rejected",
};
