import { useEffect, useState } from "react";
import { slaState } from "@/lib/waste";
import { cn } from "@/lib/utils";

export function SlaChip({
  start,
  deadline,
  warnAt = 75,
  className,
  size = "sm",
}: {
  start: string | null;
  deadline: string | null;
  warnAt?: number;
  className?: string;
  size?: "sm" | "lg";
}) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(t);
  }, []);

  const state = slaState(start, deadline, now);
  if (!state) {
    return (
      <span className={cn("text-xs text-muted-foreground", className)}>No SLA running</span>
    );
  }

  const hex = state.breached ? "#C00707" : state.elapsedPercent >= warnAt ? "#F0B93E" : "#2A7C13";

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full font-semibold",
        size === "lg" ? "px-4 py-1.5 text-base" : "px-2.5 py-1 text-xs",
        className,
      )}
      style={{ color: hex, backgroundColor: `${hex}1a` }}
    >
      {state.label}
    </span>
  );
}
