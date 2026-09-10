/**
 * Modular AI services for report validation. Every module below is a separate
 * function so a bigger/dedicated model can replace one of them later without
 * touching the pipeline. The integration point is `runVisionModel`.
 */
import { generateText } from "ai";
import { z } from "zod";
import { createLovableAiGatewayProvider } from "./ai-gateway.server";
import type { Severity, WasteAmount } from "./validation-config";

/** Swap this id (or the whole function) to move to a larger model. */
const VISION_MODEL = "google/gemini-3.8-flash";

const CATEGORIES = [
  "organic",
  "plastic",
  "paper_cardboard",
  "e_waste",
  "construction_debris",
  "hazardous",
  "mixed",
] as const;

export type WasteCategoryKey = (typeof CATEGORIES)[number];

export type ImageQualityResult = {
  photo_clear: boolean;
  quality: "GOOD" | "FAIR" | "POOR";
  reason: string;
};

export type IssueResult = {
  issue_detected: boolean;
  label: string;
  category: WasteCategoryKey;
  blocking_access: boolean;
  public_health_risk: boolean;
};

export type ReportVisionResult = {
  photo: ImageQualityResult;
  issue: IssueResult;
  waste_amount: WasteAmount;
  severity: Severity;
  confidence: number;
  reason: string;
};

function parseJson(text: string): unknown {
  const cleaned = text
    .trim()
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/, "")
    .trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("The AI response could not be read.");
  return JSON.parse(cleaned.slice(start, end + 1));
}

/** THE model integration point: one vision call, JSON in / JSON out. */
async function runVisionModel(image: string, instruction: string): Promise<unknown> {
  const key = process.env["LOVABLE_API_KEY"];
  if (!key) throw new Error("AI is not configured for this app.");
  const gateway = createLovableAiGatewayProvider(key);
  const result = await generateText({
    model: gateway(VISION_MODEL),
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: instruction },
          { type: "image", image },
        ],
      },
    ],
  });
  return parseJson(result.text);
}

const visionSchema = z.object({
  photo: z.object({
    photo_clear: z.boolean(),
    quality: z.enum(["GOOD", "FAIR", "POOR"]),
    reason: z.string().max(240).default(""),
  }),
  issue: z.object({
    issue_detected: z.boolean(),
    label: z.string().min(1).max(90),
    category: z.enum(CATEGORIES),
    blocking_access: z.boolean().default(false),
    public_health_risk: z.boolean().default(false),
  }),
  waste_amount: z.enum(["NONE", "LOW", "MODERATE", "HIGH"]),
  severity: z.enum(["NONE", "LOW", "MEDIUM", "HIGH", "SEVERE"]),
  confidence: z.number().min(0).max(1),
  reason: z.string().max(400).default(""),
});

const REPORT_INSTRUCTION = `You are a municipal sanitation inspector reviewing a citizen's photo of a public place.
Decide whether the photo shows a GENUINE and SERIOUS public waste or sanitation problem.

Not a serious problem (waste_amount NONE/LOW, severity NONE/LOW, issue_detected false when nothing relevant is visible):
- clean or empty road, street or footpath
- a few scattered wrappers, one bottle, small litter
- normal surroundings with no meaningful waste problem
- selfies, indoor shots, screenshots, or any image unrelated to public waste
- the problem is not visible or impossible to judge

Serious problem (waste_amount MODERATE/HIGH, severity MEDIUM/HIGH/SEVERE):
- large or overflowing accumulation of garbage
- garbage blocking a road, footpath or entrance
- drainage overflow or a badly blocked drain
- a large dump of waste in a public area
- waste creating a clear public-health or sanitation risk
- medical, chemical or sharp waste (always SEVERE)

Judge honestly. confidence must be 0.9+ only when the photo is unmistakable,
0.6-0.85 when likely, and below 0.5 when the photo is blurry, dark, cropped or ambiguous.
Never guess: an unclear photo gets low confidence, not a false verdict.

Reply with JSON only, no prose, exactly:
{"photo":{"photo_clear":true,"quality":"GOOD|FAIR|POOR","reason":"short"},
"issue":{"issue_detected":true,"label":"short name of the problem","category":"${CATEGORIES.join("|")}","blocking_access":false,"public_health_risk":false},
"waste_amount":"NONE|LOW|MODERATE|HIGH",
"severity":"NONE|LOW|MEDIUM|HIGH|SEVERE",
"confidence":0.0-1.0,
"reason":"one sentence a municipal officer can read"}`;

/**
 * Runs image-quality analysis, waste detection, issue classification and
 * severity estimation over one photo.
 */
export async function analyzeReportImage(image: string): Promise<ReportVisionResult> {
  const raw = await runVisionModel(image, REPORT_INSTRUCTION);
  return visionSchema.parse(raw);
}

const completionSchema = z.object({
  looks_cleaned: z.boolean(),
  photo_clear: z.boolean(),
  remaining_waste: z.enum(["NONE", "LOW", "MODERATE", "HIGH"]),
  confidence: z.number().min(0).max(1),
  reason: z.string().max(300).default(""),
});

export type CompletionVisionResult = z.infer<typeof completionSchema>;

/** Checks a worker's completion photo: is the spot actually cleared? */
export async function analyzeCompletionImage(image: string): Promise<CompletionVisionResult> {
  const raw = await runVisionModel(
    image,
    `You are inspecting a municipal worker's completion photo, taken after a cleanup.
Judge whether the spot now looks cleared of the waste problem.
Reply with JSON only, no prose, exactly:
{"looks_cleaned":true,"photo_clear":true,"remaining_waste":"NONE|LOW|MODERATE|HIGH","confidence":0.0-1.0,"reason":"one short sentence"}`,
  );
  return completionSchema.parse(raw);
}
