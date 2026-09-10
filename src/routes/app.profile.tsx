import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { LogOut } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { myAccessQuery } from "@/lib/queries";
import { myComplaintsQuery } from "@/lib/citizen";
import { AvatarUpload } from "@/components/avatar-upload";

import { isOpen } from "@/lib/waste";
import { useI18n } from "@/lib/i18n";
import { LanguageSwitcher } from "@/components/language-switcher";

export const Route = createFileRoute("/app/profile")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "My Profile — NagarMitra" },
      {
        name: "description",
        content: "Your NagarMitra account, your reporting activity and sign out.",
      },
      { property: "og:title", content: "My Profile — NagarMitra" },
      { property: "og:description", content: "Your account and reporting activity." },
      { property: "og:type", content: "profile" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ProfilePage,
});

function ProfilePage() {
  const navigate = useNavigate();
  const { t } = useI18n();
  const { data: me } = useQuery(myAccessQuery);
  const { data: complaints = [] } = useQuery(myComplaintsQuery);

  const active = complaints.filter((c) => isOpen(c.status)).length;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <h1 className="font-display text-xl font-bold">{t("profile.title")}</h1>
        <LanguageSwitcher />
      </div>

      <div className="card-surface flex items-center gap-4 p-5">
        <AvatarUpload />
        <div className="min-w-0">
          <p className="truncate font-display text-lg font-semibold">
            {me?.fullName || t("home.resident")}
          </p>
          <p className="truncate text-sm text-muted-foreground">{me?.email}</p>
          <p className="mt-1 text-xs text-muted-foreground">{t("profile.changePhoto")}</p>
        </div>
      </div>


      <div className="grid grid-cols-3 gap-3 text-center">
        <div className="card-surface p-4">
          <p className="font-display text-xl font-bold">{complaints.length}</p>
          <p className="text-xs text-muted-foreground">Reports</p>
        </div>
        <div className="card-surface p-4">
          <p className="font-display text-xl font-bold">{active}</p>
          <p className="text-xs text-muted-foreground">Active</p>
        </div>
        <div className="card-surface p-4">
          <p className="font-display text-xl font-bold">{complaints.length - active}</p>
          <p className="text-xs text-muted-foreground">Closed</p>
        </div>
      </div>

      <button
        onClick={async () => {
          await supabase.auth.signOut();
          navigate({ to: "/auth" });
        }}
        className="flex h-12 w-full items-center justify-center gap-2 rounded-xl border border-border font-semibold"
      >
        <LogOut className="h-4 w-4" /> Sign out
      </button>
    </div>
  );
}
