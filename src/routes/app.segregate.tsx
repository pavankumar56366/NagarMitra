import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AlertTriangle, Check, Loader2, RotateCcw, X } from "lucide-react";
import { toast } from "sonner";
import { CameraCapture } from "@/components/camera-capture";
import { segregationRulesQuery } from "@/lib/citizen";
import { analyzeHouseholdWaste, type SegregationDetection } from "@/lib/vision.functions";
import { CATEGORY_LABEL, CATEGORY_ORDER, type WasteCategory } from "@/lib/waste";
import { supabase } from "@/integrations/supabase/client";

/** Below this the suggestion is shown as unsure rather than as an instruction. */
const CONFIDENCE_FLOOR = 0.55;

export const Route = createFileRoute("/app/segregate")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Segregate Household Waste — NagarMitra" },
      {
        name: "description",
        content:
          "Point your camera at household waste and get instant guidance on which bin it belongs in.",
      },
      { property: "og:title", content: "Segregate Household Waste — NagarMitra" },
      {
        property: "og:description",
        content: "Instant bin guidance for the waste in your hand.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SegregatePage,
});

type Feedback = "correct" | "wrong";

function SegregatePage() {
  const { data: rules = [] } = useQuery(segregationRulesQuery);
  const analyze = useServerFn(analyzeHouseholdWaste);

  const [photo, setPhoto] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [items, setItems] = useState<SegregationDetection[] | null>(null);
  const [resultIds, setResultIds] = useState<string[]>([]);
  const [feedback, setFeedback] = useState<Record<number, Feedback>>({});
  const [correcting, setCorrecting] = useState<number | null>(null);

  function ruleFor(category: string) {
    return rules.find((r) => r.waste_categories?.key === category) ?? null;
  }

  async function run(dataUrl: string) {
    setPhoto(dataUrl);
    setBusy(true);
    setFeedback({});
    setResultIds([]);
    try {
      const result = await analyze({ data: { image: dataUrl } });
      setItems(result);
      const { data: userData } = await supabase.auth.getUser();
      if (userData.user) {
        const { data: session } = await supabase
          .from("segregation_sessions")
          .insert({ citizen_id: userData.user.id })
          .select("id")
          .single();
        if (session) {
          const rows = result.map((item) => {
            const rule = ruleFor(item.category);
            return {
              session_id: session.id,
              label: item.label,
              confidence: item.confidence,
              predicted_category: item.category,
              recommended_stream: rule?.waste_stream ?? "Needs sorting",
              recommended_bin_label: rule?.bin_label ?? "Sort first",
              recommended_bin_color: rule?.bin_color ?? "#FFCB56",
              disposal_guidance: rule?.disposal_guidance ?? "Separate the items and check again.",
              warning_text: rule?.warning_text ?? null,
              waste_category_id: rule?.waste_category_id ?? null,
            };
          });
          const { data: inserted } = await supabase
            .from("segregation_results")
            .insert(rows as never)
            .select("id");
          setResultIds((inserted ?? []).map((r) => r.id));
        }
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "We could not read that photo. Try again.");
      setItems(null);
    } finally {
      setBusy(false);
    }
  }

  async function saveFeedback(index: number, value: Feedback, corrected?: WasteCategory) {
    setFeedback((f) => ({ ...f, [index]: value }));
    setCorrecting(null);
    const id = resultIds[index];
    if (!id) return;
    await supabase
      .from("segregation_results")
      .update({
        feedback: value,
        corrected_category: corrected ?? null,
        feedback_at: new Date().toISOString(),
      } as never)
      .eq("id", id);
  }

  function reset() {
    setPhoto(null);
    setItems(null);
    setResultIds([]);
    setFeedback({});
    setCorrecting(null);
  }

  return (
    <div className="space-y-5">
      <header>
        <h1 className="font-display text-xl font-bold">Segregate waste</h1>
        <p className="text-sm text-muted-foreground">
          Show your household waste to the camera and we will tell you which bin to use.
        </p>
      </header>

      {!photo && (
        <CameraCapture
          instruction="Hold the item steady in good light, then capture."
          onCapture={run}
        />
      )}

      {photo && (
        <>
          <img src={photo} alt="Captured household waste" className="w-full rounded-2xl" />

          {busy && (
            <p className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Looking at your photo…
            </p>
          )}

          {items && items.length > 1 && !busy && (
            <p className="rounded-xl bg-secondary/60 p-3 text-sm font-medium">
              Separate these {items.length} items before you throw them out.
            </p>
          )}

          {items?.map((item, i) => {
            const rule = ruleFor(item.category);
            const unsure = item.confidence < CONFIDENCE_FLOOR;
            return (
              <article key={`${item.label}-${i}`} className="card-surface space-y-3 p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="font-display text-base font-semibold">{item.label}</h2>
                    <p className="text-sm text-muted-foreground">
                      {CATEGORY_LABEL[item.category]} · {Math.round(item.confidence * 100)}%
                      confidence
                    </p>
                  </div>
                  {rule && (
                    <span
                      className="rounded-full px-3 py-1 text-xs font-semibold text-white"
                      style={{ backgroundColor: rule.bin_color }}
                    >
                      {rule.bin_label}
                    </span>
                  )}
                </div>

                {unsure && (
                  <p className="rounded-xl bg-accent/20 p-3 text-sm">
                    We are not sure about this one. Take a closer, brighter photo, or sort it by
                    hand using the guidance below.
                  </p>
                )}

                {rule && (
                  <>
                    <p className="text-sm">
                      <span className="font-semibold">Stream:</span> {rule.waste_stream}
                    </p>
                    <p className="text-sm text-muted-foreground">{rule.disposal_guidance}</p>
                    {rule.warning_text && (
                      <p className="flex items-start gap-2 rounded-xl bg-destructive/10 p-3 text-sm text-destructive">
                        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                        {rule.warning_text}
                      </p>
                    )}
                  </>
                )}

                <div className="border-t border-border pt-3">
                  {feedback[i] ? (
                    <p className="text-xs text-muted-foreground">
                      Thanks — your answer helps us get better at this.
                    </p>
                  ) : correcting === i ? (
                    <div className="space-y-2">
                      <p className="text-xs font-medium">Which bin was right?</p>
                      <div className="flex flex-wrap gap-2">
                        {CATEGORY_ORDER.map((key) => (
                          <button
                            key={key}
                            onClick={() => saveFeedback(i, "wrong", key)}
                            className="rounded-full border border-border px-3 py-1.5 text-xs font-medium"
                          >
                            {CATEGORY_LABEL[key]}
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <span className="mr-auto text-xs text-muted-foreground">
                        Was this right?
                      </span>
                      <button
                        onClick={() => saveFeedback(i, "correct")}
                        className="flex items-center gap-1 rounded-full border border-border px-3 py-1.5 text-xs font-semibold"
                      >
                        <Check className="h-3.5 w-3.5" /> Yes
                      </button>
                      <button
                        onClick={() => setCorrecting(i)}
                        className="flex items-center gap-1 rounded-full border border-border px-3 py-1.5 text-xs font-semibold"
                      >
                        <X className="h-3.5 w-3.5" /> No
                      </button>
                    </div>
                  )}
                </div>
              </article>
            );
          })}

          {items && items.length === 0 && !busy && (
            <p className="card-surface p-5 text-sm text-muted-foreground">
              We could not spot any waste in that photo. Move closer, add more light and try again.
            </p>
          )}

          {items && items.length > 0 && (
            <p className="text-xs text-muted-foreground">
              This guidance is AI-assisted and can be wrong. When in doubt, follow your local
              municipal rules.
            </p>
          )}

          <button
            onClick={reset}
            className="flex h-12 w-full items-center justify-center gap-2 rounded-xl border border-border font-semibold"
          >
            <RotateCcw className="h-4 w-4" /> Check another item
          </button>
        </>
      )}
    </div>
  );
}
