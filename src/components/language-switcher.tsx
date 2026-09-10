import { Globe } from "lucide-react";
import { LANGUAGES, useI18n, type LanguageCode } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export function LanguageSwitcher({ className }: { className?: string }) {
  const { lang, setLang, t } = useI18n();

  return (
    <label
      className={cn(
        "inline-flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2 text-sm font-semibold",
        className,
      )}
    >
      <Globe className="h-4 w-4 text-muted-foreground" />
      <span className="sr-only">{t("language.label")}</span>
      <select
        value={lang}
        onChange={(e) => setLang(e.target.value as LanguageCode)}
        className="bg-transparent text-sm font-semibold outline-none"
        aria-label={t("language.label")}
      >
        {LANGUAGES.map((l) => (
          <option key={l.code} value={l.code}>
            {l.label}
          </option>
        ))}
      </select>
    </label>
  );
}
