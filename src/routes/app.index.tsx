import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Camera, ChevronRight, Recycle } from "lucide-react";
import { myComplaintsQuery } from "@/lib/citizen";
import { avatarUrlQuery, myAccessQuery } from "@/lib/queries";
import { StatusBadge } from "@/components/status-badge";
import { isOpen, relativeTime } from "@/lib/waste";
import { useI18n } from "@/lib/i18n";
import { ScoreCard, useMyScore } from "@/components/score-panel";
import logoAsset from "@/assets/nagarmitra-logo.jpg.asset.json";

export const Route = createFileRoute("/app/")({
  head: () => ({
    meta: [
      { title: "NagarMitra — Report and Segregate Waste" },
      {
        name: "description",
        content:
          "Report public waste with a photo, get AI segregation guidance for household waste, and track your reports until they are resolved.",
      },
      { property: "og:title", content: "NagarMitra — Report and Segregate Waste" },
      {
        property: "og:description",
        content: "Report waste, get bin guidance and track resolution in your city.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: CitizenHome,
});

function greetingKey() {
  const h = new Date().getHours();
  if (h < 12) return "home.greeting.morning";
  if (h < 17) return "home.greeting.afternoon";
  return "home.greeting.evening";
}

function CitizenHome() {
  const { t } = useI18n();
  const { data: me } = useQuery(myAccessQuery);
  const { data: avatar } = useQuery(avatarUrlQuery(me?.avatarUrl ?? null));
  const { data: complaints = [] } = useQuery(myComplaintsQuery);


  const score = useMyScore();

  const active = complaints.filter((c) => isOpen(c.status)).length;
  const done = complaints.length - active;
  const resolvedCount = complaints.filter(
    (c) => c.status === "resolved" || c.status === "verified" || c.status === "closed",
  ).length;
  const recent = complaints.slice(0, 3);

  return (
    <div className="space-y-6 rounded-3xl bg-gradient-to-b from-orange-400/[0.08] via-orange-50/20 to-background p-4 -mx-4 -mt-6 pt-6">

      <header className="flex items-center gap-3">
        <img
          src={logoAsset.url}
          alt="Nagar Mitra logo"
          className="h-11 w-11 shrink-0 rounded-xl object-contain"
        />
        <div className="min-w-0 flex-1">
          <p className="text-sm text-muted-foreground">{t(greetingKey())}</p>
          <h1 className="truncate font-display text-2xl font-bold">
            {me?.fullName?.split(" ")[0] || t("home.resident")}
          </h1>
        </div>
        <Link to="/app/profile" aria-label="Open profile">
          <span className="block h-11 w-11 overflow-hidden rounded-full border border-border bg-muted">
            {avatar ? (
              <img src={avatar} alt="Your profile" className="h-full w-full object-cover" />
            ) : (
              <span className="flex h-full w-full items-center justify-center text-sm font-semibold text-muted-foreground">
                {(me?.fullName?.[0] || "R").toUpperCase()}
              </span>
            )}
          </span>
        </Link>
      </header>


      <Link
        to="/app/report"
        className="flex items-center gap-4 rounded-2xl bg-primary px-5 py-5 text-primary-foreground"
      >
        <Camera className="h-7 w-7" />
        <span className="flex-1">
          <span className="block font-display text-lg font-bold">{t("home.report.title")}</span>
          <span className="block text-sm opacity-90">{t("home.report.help")}</span>
        </span>
        <ChevronRight className="h-5 w-5" />
      </Link>

      <Link to="/app/segregate" className="card-surface flex items-center gap-4 p-5">
        <Recycle className="h-6 w-6 text-primary" />
        <span className="flex-1">
          <span className="block font-semibold">{t("home.segregate.title")}</span>
          <span className="block text-sm text-muted-foreground">
            {t("home.segregate.help")}
          </span>
        </span>
        <ChevronRight className="h-5 w-5 text-muted-foreground" />
      </Link>

      <ScoreCard
        title="Civic score"
        points={score.points}
        stats={[
          { label: "Reports submitted", value: complaints.length },
          { label: "Problems resolved", value: resolvedCount },
        ]}
      />

      <div className="grid grid-cols-2 gap-3">
        <div className="card-surface p-4">
          <p className="text-sm text-muted-foreground">{t("home.active")}</p>
          <p className="font-display text-2xl font-bold">{active}</p>
        </div>
        <div className="card-surface p-4">
          <p className="text-sm text-muted-foreground">{t("home.resolved")}</p>
          <p className="font-display text-2xl font-bold">{done}</p>
        </div>
      </div>

      <section>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="font-display text-base font-semibold">{t("home.recent")}</h2>
          <Link to="/app/reports" className="text-sm font-semibold text-primary">
            {t("home.seeAll")}
          </Link>
        </div>
        {recent.length === 0 ? (
          <p className="card-surface p-5 text-sm text-muted-foreground">
            {t("home.empty")}
          </p>
        ) : (
          <ul className="space-y-3">
            {recent.map((c) => (
              <li key={c.id}>
                <Link
                  to="/app/reports/$id"
                  params={{ id: c.id }}
                  className="card-surface flex items-center gap-3 p-4"
                >
                  <span className="flex-1">
                    <span className="block text-sm font-semibold">{c.reference}</span>
                    <span className="block text-xs text-muted-foreground">
                      {relativeTime(c.created_at)}
                    </span>
                  </span>
                  <StatusBadge status={c.status} />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
