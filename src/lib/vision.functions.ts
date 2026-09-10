import { createServerFn } from "@tanstack/react-start";
import { generateText } from "ai";
import { z } from "zod";
import { createLovableAiGatewayProvider } from "./ai-gateway.server";

const MODEL = "google/gemini-3.8-flash";

const CATEGORIES = [
  "organic",
  "plastic",
  "paper_cardboard",
  "e_waste",
  "construction_debris",
  "hazardous",
  "mixed",
] as const;

const ImageInput = z.object({
  image: z.string().min(32).max(12_000_000),
});

export type DetectedItem = {
  label: string;
  category: (typeof CATEGORIES)[number];
  confidence: number;
};

export type PublicWasteResult = DetectedItem & {
  priority: "critical" | "high" | "medium" | "low";
  summary: string;
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

async function analyze(image: string, instruction: string) {
  const key = process.env["LOVABLE_API_KEY"];
  if (!key) throw new Error("AI is not configured for this app.");

  const gateway = createLovableAiGatewayProvider(key);
  const result = await generateText({
    model: gateway(MODEL),
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

const itemSchema = z.object({
  label: z.string().min(1).max(80),
  category: z.enum(CATEGORIES),
  confidence: z.number().min(0).max(1),
});

/** Classifies a photo of public waste into one category with a suggested priority. */
export const classifyPublicWaste = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => ImageInput.parse(data))
  .handler(async ({ data }): Promise<PublicWasteResult> => {
    const raw = await analyze(
      data.image,
      `You are a municipal waste inspector. Look at this photo of waste in a public place.
Reply with JSON only, no prose, in this exact shape:
{"label":"short name of what you see","category":"one of ${CATEGORIES.join("|")}","confidence":0.0-1.0,"priority":"critical|high|medium|low","summary":"one short sentence for a municipal worker"}
Use "hazardous" for medical, chemical or sharp waste and give it critical priority. Use "mixed" when the pile is unsegregated street waste. Judge priority by health risk, size of the pile and how public the spot is.`,
    );

    const parsed = itemSchema
      .extend({
        priority: z.enum(["critical", "high", "medium", "low"]),
        summary: z.string().max(240).default(""),
      })
      .parse(raw);

    return parsed;
  });

export type SegregationDetection = DetectedItem;

/** Detects one or more household waste items for segregation guidance. */
export const analyzeHouseholdWaste = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => ImageInput.parse(data))
  .handler(async ({ data }): Promise<SegregationDetection[]> => {
    const raw = await analyze(
      data.image,
      `You are a household waste segregation assistant for Indian municipal bin rules.
Identify every distinct waste item visible in this photo and assign each one a category.

Category rules (follow strictly):
- organic: food scraps, peels, garden waste, soiled tissue, cooked leftovers -> Green bin (wet)
- plastic: bottles, wrappers, containers, bags, packaging film -> Blue bin (dry)
- paper_cardboard: paper, newspaper, cartons, cardboard, books -> Blue bin (dry)
- e_waste: batteries, cables, chargers, phones, bulbs, circuit boards -> Red bin (special drop-off)
- construction_debris: rubble, tiles, cement, bricks, wood offcuts -> Grey bin (special handling)
- hazardous: medicines, syringes, sharps, chemicals, paint, sanitary waste -> Red bin (hazardous)
- mixed: a pile you cannot separate into one of the above -> must be sorted before disposal

Grading rules:
- Judge each item on its own; do not merge two different items into one entry.
- Glass and metal go under plastic only if they are clean recyclables; otherwise use mixed.
- If an item is partly food-soiled paper or plastic, it is organic only when the food dominates.
- confidence must be honest: 0.9+ only when the item is unmistakable and fully visible,
  0.6-0.85 when likely, below 0.5 when the photo is blurry, dark, occluded or ambiguous.
- Never invent items that are not clearly visible. Return an empty list when you see no waste.

Reply with JSON only, no prose, in this exact shape:
{"items":[{"label":"plastic water bottle","category":"one of ${CATEGORIES.join("|")}","confidence":0.0-1.0}]}
List at most 6 items, most prominent first.`,
    );


    const parsed = z.object({ items: z.array(itemSchema).max(6) }).parse(raw);
    return parsed.items;
  });
