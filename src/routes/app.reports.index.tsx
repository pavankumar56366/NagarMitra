import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { myComplaintsQuery } from "@/lib/citizen";
import { StatusBadge } from "@/components/status-badge";
import { CATEGORY_LABEL, relativeTime } from "@/lib/waste";

export const Route = createFileRoute("/app/reports/")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "My Reports — NagarMitra" },
      {
        name: "description",
        content: "Follow every waste report you have sent, from pending to resolved and verified.",
      },
      { property: "og:title", content: "My Reports — NagarMitra" },
      { property: "og:description", content: "Track your waste reports until they are cleared." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: MyReports,
});

function MyReports() {
  const { data: complaints = [], isLoading } = useQuery(myComplaintsQuery);

  return (
    <div className="space-y-4">
      <h1 className="font-display text-xl font-bold">My reports</h1>

      {isLoading && <p className="text-sm text-muted-foreground">Loading your reports…</p>}

      {!isLoading && complaints.length === 0 && (
        <p className="card-surface p-5 text-sm text-muted-foreground">
          Nothing here yet. Use Report to send your first one.
        </p>
      )}

      <ul className="space-y-3">
        {complaints.map((c) => (
          <li key={c.id}>
            <Link
              to="/app/reports/$id"
              params={{ id: c.id }}
              className="card-surface block space-y-2 p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold">{c.ai_label || CATEGORY_LABEL[c.waste_category]}</p>
                  <p className="text-xs text-muted-foreground">
                    {c.reference} · {relativeTime(c.created_at)}
                  </p>
                </div>
                <StatusBadge status={c.status} />
              </div>
              {c.address && <p className="text-sm text-muted-foreground">{c.address}</p>}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
