import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const deleteInput = z.object({
  complaintId: z.string().uuid(),
  reason: z.string().max(1000).optional(),
});

/** Brand-new reports can be removed outright. */
const DELETABLE = ["pending"] as const;
/** Reports already in the operational pipeline are withdrawn, never hard-deleted. */
const WITHDRAWABLE = ["assigned", "in_progress", "escalated", "reopened", "resolved"] as const;

export const deleteCitizenReport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => deleteInput.parse(data))
  .handler(async ({ data, context }) => {
    // Ownership is proven with the caller's own RLS-scoped client, never with the id alone.
    const { data: complaint, error: readError } = await context.supabase
      .from("complaints")
      .select("id,status,citizen_id,deleted_at")
      .eq("id", data.complaintId)
      .eq("citizen_id", context.userId)
      .maybeSingle();

    if (readError) throw new Error(readError.message);
    if (!complaint) throw new Error("Report not found");

    const status = complaint.status as string;
    const deletedAt = (complaint as { deleted_at?: string | null }).deleted_at ?? null;
    if (deletedAt || status === "cancelled") {
      throw new Error("This report has already been withdrawn.");
    }

    const reason = data.reason?.trim() || null;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    if ((DELETABLE as readonly string[]).includes(status)) {
      for (const table of ["citizen_verifications", "escalations", "complaint_events"] as const) {
        const { error } = await supabaseAdmin.from(table).delete().eq("complaint_id", complaint.id);
        if (error) throw new Error(error.message);
      }
      const { error } = await supabaseAdmin
        .from("complaints")
        .delete()
        .eq("id", complaint.id)
        .eq("citizen_id", context.userId);
      if (error) throw new Error(error.message);
      return { outcome: "deleted" as const };
    }

    if ((WITHDRAWABLE as readonly string[]).includes(status)) {
      const { error } = await supabaseAdmin
        .from("complaints")
        .update({
          status: "cancelled",
          deleted_at: new Date().toISOString(),
          deleted_by: context.userId,
          deletion_reason: reason,
          sla_deadline: null,
        } as never)
        .eq("id", complaint.id)
        .eq("citizen_id", context.userId);
      if (error) throw new Error(error.message);

      const { error: eventError } = await supabaseAdmin.from("complaint_events").insert({
        complaint_id: complaint.id,
        actor: "citizen",
        event_type: "cancelled",
        detail: reason || "Citizen withdrew this report.",
      });
      if (eventError) throw new Error(eventError.message);
      return { outcome: "withdrawn" as const };
    }

    throw new Error("This report is already being processed and cannot be permanently deleted.");
  });

export function deletionMode(status: string, deletedAt: string | null) {
  if (deletedAt || status === "cancelled") return "none" as const;
  if ((DELETABLE as readonly string[]).includes(status)) return "delete" as const;
  if ((WITHDRAWABLE as readonly string[]).includes(status)) return "withdraw" as const;
  return "none" as const;
}
