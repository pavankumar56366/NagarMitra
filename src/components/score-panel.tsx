import { useQuery } from "@tanstack/react-query";
import { Star } from "lucide-react";
import { myScoreEventsQuery, totalPoints, type ScoreEvent } from "@/lib/scoring";
import { relativeTime } from "@/lib/waste";

/** Headline score plus two supporting counts, used on both dashboards. */
export function ScoreCard({
  title,
  points,
  stats,
}: {
  title: string;
  points: number;
  stats: { label: string; value: number }[];
}) {
  return (
    <div className="card-surface p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{title}</p>
        <span className="flex items-center gap-1 font-display text-2xl font-bold">
          <Star className="h-5 w-5 fill-current text-amber-500" />
          {points}
        </span>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-3">
        {stats.map((s) => (
          <div key={s.label}>
            <p className="font-display text-xl font-bold">{s.value}</p>
            <p className="text-xs text-muted-foreground">{s.label}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

export function ScoreHistory({ limit = 8 }: { limit?: number }) {
  const { data: events = [] } = useQuery(myScoreEventsQuery);
  if (events.length === 0) return null;
  return (
    <section className="space-y-2">
      <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
        Score history
      </h2>
      <ul className="space-y-2">
        {events.slice(0, limit).map((e: ScoreEvent) => (
          <li key={e.id} className="card-surface flex items-center gap-3 p-3">
            <span className="font-display text-base font-bold text-primary">+{e.points}</span>
            <span className="flex-1">
              <span className="block text-sm font-semibold">{e.reason}</span>
              <span className="block text-xs text-muted-foreground">
                {relativeTime(e.created_at)}
              </span>
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Total points for the signed-in person, and how many awards they have. */
export function useMyScore() {
  const { data: events = [] } = useQuery(myScoreEventsQuery);
  return {
    events,
    points: totalPoints(events),
    completedJobs: events.filter((e) => e.kind.startsWith("work_completed")).length,
  };
}
