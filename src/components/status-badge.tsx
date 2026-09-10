import { cn } from "@/lib/utils";
import {
  PRIORITY_LABEL,
  STATUS_HEX,
  STATUS_LABEL,
  type ComplaintStatus,
  type Priority,
} from "@/lib/waste";

export function StatusBadge({
  status,
  className,
}: {
  status: ComplaintStatus;
  className?: string;
}) {
  const hex = STATUS_HEX[status];
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-wide",
        className,
      )}
      style={{ color: hex, backgroundColor: `${hex}1f` }}
    >
      {STATUS_LABEL[status]}
    </span>
  );
}

const PRIORITY_HEX: Record<Priority, string> = {
  critical: "#C00707",
  high: "#F0B93E",
  medium: "#5B655F",
  low: "#5B655F",
};

export function PriorityBadge({ priority }: { priority: Priority }) {
  const hex = PRIORITY_HEX[priority];
  return (
    <span
      className="inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide"
      style={{ color: hex, backgroundColor: `${hex}1a` }}
    >
      {PRIORITY_LABEL[priority]}
    </span>
  );
}
