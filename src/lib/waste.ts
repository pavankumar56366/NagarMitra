export type ComplaintStatus =
  | "pending"
  | "assigned"
  | "in_progress"
  | "resolved"
  | "verified"
  | "closed"
  | "escalated"
  | "reopened";

export type Priority = "critical" | "high" | "medium" | "low";

export type WasteCategory =
  | "organic"
  | "plastic"
  | "paper_cardboard"
  | "e_waste"
  | "construction_debris"
  | "hazardous"
  | "mixed";

export const STATUS_LABEL: Record<ComplaintStatus, string> = {
  pending: "Pending",
  assigned: "Assigned",
  in_progress: "In Progress",
  resolved: "Resolved",
  verified: "Verified",
  closed: "Closed",
  escalated: "Escalated",
  reopened: "Reopened",
};

export const STATUS_ORDER: ComplaintStatus[] = [
  "pending",
  "assigned",
  "in_progress",
  "resolved",
  "verified",
  "closed",
  "escalated",
  "reopened",
];

/** Hex values come straight from the design spec's status colour mapping. */
export const STATUS_HEX: Record<ComplaintStatus, string> = {
  pending: "#FFCB56",
  assigned: "#FFCB56",
  in_progress: "#A2CB8B",
  resolved: "#2A7C13",
  verified: "#2A7C13",
  closed: "#2A7C13",
  escalated: "#C00707",
  reopened: "#C00707",
};

export const PRIORITY_LABEL: Record<Priority, string> = {
  critical: "Critical",
  high: "High",
  medium: "Medium",
  low: "Low",
};

export const PRIORITY_ORDER: Priority[] = ["critical", "high", "medium", "low"];

export const CATEGORY_LABEL: Record<WasteCategory, string> = {
  organic: "Organic",
  plastic: "Plastic",
  paper_cardboard: "Paper / Cardboard",
  e_waste: "E-Waste",
  construction_debris: "Construction Debris",
  hazardous: "Hazardous / Medical",
  mixed: "Mixed / Unsegregated",
};

export const CATEGORY_ORDER: WasteCategory[] = [
  "organic",
  "plastic",
  "paper_cardboard",
  "e_waste",
  "construction_debris",
  "hazardous",
  "mixed",
];

export const OPEN_STATUSES: ComplaintStatus[] = [
  "pending",
  "assigned",
  "in_progress",
  "escalated",
  "reopened",
];

export function isOpen(status: ComplaintStatus) {
  return OPEN_STATUSES.includes(status);
}

export type SlaState = {
  /** milliseconds remaining; negative when the deadline has passed */
  remainingMs: number;
  breached: boolean;
  /** 0-100, how much of the window has elapsed */
  elapsedPercent: number;
  label: string;
};

export function slaState(
  start: string | null,
  deadline: string | null,
  now: number = Date.now(),
): SlaState | null {
  if (!deadline) return null;
  const end = new Date(deadline).getTime();
  const begin = start ? new Date(start).getTime() : end;
  const total = Math.max(end - begin, 1);
  const remainingMs = end - now;
  const elapsedPercent = Math.min(100, Math.max(0, ((now - begin) / total) * 100));
  return {
    remainingMs,
    breached: remainingMs <= 0,
    elapsedPercent,
    label: formatDuration(Math.abs(remainingMs)) + (remainingMs <= 0 ? " over" : " left"),
  };
}

export function formatDuration(ms: number) {
  const totalMinutes = Math.floor(ms / 60000);
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

export function formatHours(hours: number) {
  if (hours >= 48) return `${(hours / 24).toFixed(1)} days`;
  return `${hours.toFixed(1)} hrs`;
}

export function relativeTime(iso: string | null) {
  if (!iso) return "—";
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 0) return "just now";
  return `${formatDuration(diff)} ago`;
}

export function formatDateTime(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString(undefined, {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}
