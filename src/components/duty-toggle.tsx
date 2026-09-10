import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { myWorkerQuery } from "@/lib/queries";
import { cn } from "@/lib/utils";

const OPTIONS = [
  { value: "on_duty", label: "On duty" },
  { value: "on_break", label: "On break" },
  { value: "off_duty", label: "Off duty" },
] as const;

/** Duty status is a field-crew concept only — residents never see or set this. */
export function DutyToggle({ compact = false }: { compact?: boolean }) {
  const qc = useQueryClient();
  const { data: worker } = useQuery(myWorkerQuery);

  const setDuty = useMutation({
    mutationFn: async (availability: string) => {
      if (!worker) throw new Error("No crew record linked to this account yet.");
      const { error } = await supabase
        .from("workers")
        .update({ availability })
        .eq("id", worker.id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["my_worker"] });
      toast.success("Duty status updated.");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const current = worker?.availability ?? "on_duty";

  return (
    <div className={cn("flex items-stretch gap-2", compact ? "" : "w-full")}>
      {OPTIONS.map((o) => (
        <button
          key={o.value}
          disabled={setDuty.isPending}
          onClick={() => setDuty.mutate(o.value)}
          className={cn(
            "flex-1 rounded-xl border-2 font-semibold transition-colors disabled:opacity-50",
            compact ? "px-3 py-1.5 text-xs" : "px-3 py-3 text-sm",
            current === o.value
              ? "border-primary bg-primary text-primary-foreground"
              : "border-border text-muted-foreground",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
