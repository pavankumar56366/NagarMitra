/**
 * Server-only helper that records a points award. Awards are unique per
 * person + report + kind, so a repeated call can never double-count.
 */
import type { ScoreKind } from "./scoring";

export async function awardPoints(input: {
  userId: string;
  role: "citizen" | "worker";
  complaintId: string | null;
  kind: ScoreKind;
  points: number;
  reason: string;
}): Promise<void> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { error } = await supabaseAdmin.from("score_events").insert({
    user_id: input.userId,
    role: input.role,
    complaint_id: input.complaintId,
    kind: input.kind,
    points: input.points,
    reason: input.reason,
  } as never);
  // A duplicate award is expected on retries and must not fail the workflow.
  if (error && !/duplicate key|unique/i.test(error.message)) {
    console.error("score award failed", error.message);
  }
}
