/**
 * Simple points system. Residents earn points for genuine reports and for
 * reports that end up resolved; field crew earn points for finishing jobs,
 * with more points the faster the job is closed. Every award is stored as a
 * row in `score_events` so the history is always auditable.
 */
import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const SCORE_POINTS = {
  /** Genuine report registered. */
  report: 10,
  /** That report ended up cleaned and confirmed. */
  reportResolved: 5,
  /** Job finished well inside the deadline. */
  workFast: 20,
  /** Job finished inside the deadline. */
  workOnTime: 10,
  /** Job finished after the deadline. */
  workLate: 5,
} as const;

export type ScoreKind =
  | "report_submitted"
  | "report_resolved"
  | "work_completed_fast"
  | "work_completed_on_time"
  | "work_completed_late";

export type ScoreEvent = {
  id: string;
  user_id: string;
  role: "citizen" | "worker";
  complaint_id: string | null;
  kind: ScoreKind;
  points: number;
  reason: string;
  created_at: string;
};

/** Points and wording for a completed job, based on how much of the window was used. */
export function workCompletionAward(
  slaStart: string | null,
  slaDeadline: string | null,
  completedAt: Date,
): { kind: ScoreKind; points: number; reason: string } {
  if (!slaDeadline) {
    return {
      kind: "work_completed_on_time",
      points: SCORE_POINTS.workOnTime,
      reason: "Complaint resolved",
    };
  }
  const deadline = new Date(slaDeadline).getTime();
  const done = completedAt.getTime();
  if (done > deadline) {
    return { kind: "work_completed_late", points: SCORE_POINTS.workLate, reason: "Complaint resolved late" };
  }
  const start = slaStart ? new Date(slaStart).getTime() : null;
  if (start !== null && deadline > start) {
    const used = (done - start) / (deadline - start);
    if (used <= 0.5) {
      return {
        kind: "work_completed_fast",
        points: SCORE_POINTS.workFast,
        reason: "Complaint resolved quickly",
      };
    }
  }
  return {
    kind: "work_completed_on_time",
    points: SCORE_POINTS.workOnTime,
    reason: "Complaint resolved on time",
  };
}

export const myScoreEventsQuery = queryOptions({
  queryKey: ["my_score_events"],
  queryFn: async (): Promise<ScoreEvent[]> => {
    const { data: userData } = await supabase.auth.getUser();
    const uid = userData.user?.id;
    if (!uid) return [];
    const { data, error } = await supabase
      .from("score_events")
      .select("*")
      .eq("user_id", uid)
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw new Error(error.message);
    return (data ?? []) as unknown as ScoreEvent[];
  },
});

export function totalPoints(events: ScoreEvent[]): number {
  return events.reduce((sum, e) => sum + (e.points ?? 0), 0);
}
