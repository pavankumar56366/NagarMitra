import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const verificationInput = z.object({
  complaintId: z.string().uuid(),
  confirmed: z.boolean(),
  comment: z.string().max(1000).optional(),
});

export const verifyCitizenCleanup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => verificationInput.parse(data))
  .handler(async ({ data, context }) => {
    const { data: complaint, error: readError } = await context.supabase
      .from("complaints")
      .select("id,status,citizen_id")
      .eq("id", data.complaintId)
      .eq("citizen_id", context.userId)
      .maybeSingle();

    if (readError) throw new Error(readError.message);
    if (!complaint) throw new Error("Report not found");
    if (complaint.status !== "resolved") {
      throw new Error("This report is not awaiting verification");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const result = data.confirmed ? "confirmed" : "rejected";
    const status = data.confirmed ? "closed" : "reopened";
    const detail = data.confirmed
      ? "Citizen confirmed the cleanup. Report closed."
      : data.comment?.trim() || "Citizen reported the site is still not clean.";

    const { error: verificationError } = await supabaseAdmin
      .from("citizen_verifications")
      .insert({
        complaint_id: complaint.id,
        citizen_id: context.userId,
        result,
        comment: data.comment?.trim() || null,
      });
    if (verificationError) throw new Error(verificationError.message);

    const { error: updateError } = await supabaseAdmin
      .from("complaints")
      .update(
        data.confirmed
          ? { status, verification_status: result, sla_deadline: null }
          : {
              status,
              verification_status: result,
              resolved_at: null,
              sla_deadline: new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString(),
            },
      )
      .eq("id", complaint.id)
      .eq("citizen_id", context.userId);
    if (updateError) throw new Error(updateError.message);

    const { error: eventError } = await supabaseAdmin.from("complaint_events").insert({
      complaint_id: complaint.id,
      actor: "citizen",
      event_type: data.confirmed ? "closed" : "reopened",
      detail,
    });
    if (eventError) throw new Error(eventError.message);

    return { status };
  });