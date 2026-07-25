import { GoogleGenAI, Type } from "@google/genai";
import { foodAnalysisSchema, screenshotSchema, weeklySummarySchema } from "@/lib/schemas";
import {
  buildPrecheckText,
  buildSourcesText,
  conditionSlugs,
  enforceSpine,
  fallbackAnalysis,
  toFoodItem,
  trimesterForWeek,
} from "@/lib/spine/analysis";
import { GUIDELINE_BY_ID, GUIDELINES } from "@/lib/spine/guidelines";
import { retrieveGuidelines } from "@/lib/spine/retrieval";
import { runRules } from "@/lib/spine/rules";
import type { ConsumptionEntry, FoodAnalysis, UserProfile, WeeklySummary } from "@/types";

/**
 * Gemini is the reasoning layer only. It explains which supplied guidelines
 * apply; it never originates a safety judgement. Deterministic rules run first
 * and set a floor, and every response is checked against that floor and against
 * the real corpus before it reaches a user. See src/lib/spine/.
 */

/**
 * Measured against this project on 2026-07-25, not taken from the docs:
 * gemini-3.6-flash has a free-tier quota of 20 requests PER DAY, which a single
 * demo exhausts. gemini-3.5-flash has its own separate bucket. Override with
 * GEMINI_MODEL once the project has billing enabled.
 */
const model = process.env.GEMINI_MODEL || "gemini-3.5-flash";

const client = () => {
  if (!process.env.GEMINI_API_KEY) throw new Error("GEMINI_NOT_CONFIGURED");
  return new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
};

/** Whole corpus, for the calls that reason over a food log rather than one item. */
const allSourcesText = GUIDELINES.map(
  (g) => `[${g.id}] ${g.authority} — ${g.title}\n${g.summary}`,
).join("\n\n");

const analysisResponseSchema = {
  type: Type.OBJECT,
  required: ["itemName", "status", "summary", "explanation", "flaggedIngredients", "trimesterContext", "conditionContext", "moderationGuidance", "alternatives", "questionsForProvider", "confidence", "sourceIds", "limitations"],
  properties: {
    itemName: { type: Type.STRING },
    status: { type: Type.STRING, enum: ["generally_suitable", "use_caution", "consider_avoiding", "insufficient_information"] },
    summary: { type: Type.STRING },
    explanation: { type: Type.STRING },
    flaggedIngredients: { type: Type.ARRAY, items: { type: Type.OBJECT, required: ["ingredient", "reason"], properties: { ingredient: { type: Type.STRING }, reason: { type: Type.STRING } } } },
    trimesterContext: { type: Type.STRING },
    conditionContext: { anyOf: [{ type: Type.STRING }, { type: Type.NULL }] },
    moderationGuidance: { anyOf: [{ type: Type.STRING }, { type: Type.NULL }] },
    alternatives: { type: Type.ARRAY, items: { type: Type.OBJECT, required: ["name", "reason"], properties: { name: { type: Type.STRING }, reason: { type: Type.STRING } } } },
    questionsForProvider: { type: Type.ARRAY, items: { type: Type.STRING } },
    confidence: { type: Type.NUMBER },
    sourceIds: { type: Type.ARRAY, items: { type: Type.STRING } },
    limitations: { type: Type.ARRAY, items: { type: Type.STRING } }
  }
};

const system = `You are BumpSafe's calm educational reasoning layer. You do not diagnose, prescribe, recommend supplement doses, or make absolute safety guarantees. Base medical and food-safety claims ONLY on the supplied source summaries. Cite ONLY supplied source IDs — never invent one. If no supplied source supports a conclusion, use insufficient_information. If a deterministic pre-check assigned a status, you may raise its severity but never lower it. Clearly identify uncertainty in limitations. Personalize to the provided pregnancy week, conditions, allergies, and preferences without weight-loss or appearance advice.`;

const parseDataUrl = (dataUrl: string) => {
  const match = dataUrl.match(/^data:(image\/(?:jpeg|png|webp));base64,(.+)$/);
  if (!match) throw new Error("INVALID_IMAGE");
  return { mimeType: match[1], data: match[2] };
};

/**
 * Models sometimes wrap JSON in prose or a markdown fence even in JSON mode.
 * Recover the outermost object rather than throwing away a good response.
 */
function repairJson(text: string): unknown {
  const trimmed = (text || "").trim();
  const attempts = [trimmed, trimmed.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "")];
  const first = trimmed.indexOf("{");
  const last = trimmed.lastIndexOf("}");
  if (first !== -1 && last > first) attempts.push(trimmed.slice(first, last + 1));

  for (const a of attempts) {
    for (const candidate of [a, a.replace(/,(\s*[}\]])/g, "$1")]) {
      try {
        return JSON.parse(candidate);
      } catch {
        // try the next shape
      }
    }
  }
  throw new Error("UNPARSEABLE_MODEL_OUTPUT");
}

const isRateLimit = (err: unknown) => {
  const msg = err instanceof Error ? err.message : String(err);
  const status = (err as { status?: number })?.status;
  return status === 429 || /RESOURCE_EXHAUSTED|exceeded your current quota/i.test(msg);
};

const isFatal = (err: unknown) => {
  const msg = err instanceof Error ? err.message : "";
  return msg === "GEMINI_NOT_CONFIGURED" || msg === "INVALID_IMAGE";
};

/**
 * One retry, and only for faults a second attempt can fix. Retrying a 429 just
 * burns the remaining daily quota; retrying a missing key never helps.
 */
async function withRetry<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (first) {
    if (isRateLimit(first) || isFatal(first)) throw first;
    try {
      return await fn();
    } catch {
      throw first;
    }
  }
}

const keepReal = (ids: string[] | undefined) => (ids ?? []).filter((id) => GUIDELINE_BY_ID.has(id));

export async function analyseItem(input: {
  profile: UserProfile;
  item: unknown;
  imageDataUrl?: string;
  mode: "barcode" | "image" | "text";
}): Promise<FoodAnalysis> {
  const { profile } = input;
  const conditions = conditionSlugs(profile);
  const trimester = trimesterForWeek(profile.pregnancyWeek);

  // --- Layer 1: deterministic rules, before the model is consulted at all.
  const item = toFoodItem(input.item);
  const matches = runRules(item, { trimester, conditions });
  const guidelines = retrieveGuidelines(item, matches, { conditions });

  // Nothing retrieved and no rule fired: no hazard document could apply, so
  // answer deterministically rather than inviting the model to reach for one.
  // A photo still goes to the model, because the ingredients aren't known yet.
  if (guidelines.length === 0 && matches.length === 0 && !input.imageDataUrl) {
    return fallbackAnalysis(
      item,
      matches,
      profile,
      "No guideline in the corpus applies to these ingredients.",
    );
  }

  // --- Layer 2: the model explains which of those guidelines apply.
  let parsed: FoodAnalysis;
  try {
    const contents: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> = [
      {
        text: [
          `Profile: ${JSON.stringify(profile)}`,
          `Pregnancy week ${profile.pregnancyWeek}, trimester ${trimester}.`,
          `Input mode: ${input.mode}`,
          `Item/product details: ${JSON.stringify(input.item)}`,
          ``,
          `PRE-CHECK RESULT:`,
          buildPrecheckText(matches),
          ``,
          `APPROVED GUIDANCE SOURCES (the only IDs you may cite):`,
          buildSourcesText(guidelines.length > 0 ? guidelines : GUIDELINES.slice(0, 6)),
          ``,
          input.imageDataUrl
            ? `For the image, first identify the likely item, visible ingredients and preparation, and reflect uncertainty in limitations and confidence.`
            : `Return the requested structured analysis.`,
        ].join("\n"),
      },
    ];
    if (input.imageDataUrl) contents.push({ inlineData: parseDataUrl(input.imageDataUrl) });

    const response = await withRetry(() =>
      client().models.generateContent({
        model,
        contents,
        config: {
          systemInstruction: system,
          responseMimeType: "application/json",
          responseSchema: analysisResponseSchema,
          temperature: 0.2,
        },
      }),
    );
    parsed = foodAnalysisSchema.parse(repairJson(response.text || "")) as FoodAnalysis;
  } catch (error) {
    // Rate limit and misconfiguration are surfaced honestly by the route.
    if (isRateLimit(error) || isFatal(error)) throw error;
    const message = error instanceof Error ? error.message : "";
    console.warn(`[analyse] model step failed, falling back to rules: ${message.slice(0, 200)}`);
    return fallbackAnalysis(item, matches, profile);
  }

  // --- Layer 3: nothing reaches the UI without surviving this.
  parsed.sourceIds = keepReal(parsed.sourceIds);
  const verdict = enforceSpine(parsed, matches);
  if (!verdict.ok) {
    console.warn(`[analyse] rejected model output: ${verdict.reason} — ${verdict.detail}`);
    return fallbackAnalysis(
      item,
      matches,
      profile,
      "The explanation step returned something that did not hold up against the sources, so this is the rule match on its own.",
    );
  }

  return {
    ...verdict.analysis,
    itemName: verdict.analysis.itemName || item.name,
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
  };
}

export async function analyseScreenshot(profile: UserProfile, imageDataUrl: string) {
  const image = parseDataUrl(imageDataUrl);
  const conditions = conditionSlugs(profile);
  const trimester = trimesterForWeek(profile.pregnancyWeek);

  const response = await withRetry(() =>
    client().models.generateContent({
      model,
      contents: [
        {
          text: `Profile: ${JSON.stringify(profile)}\nPregnancy week ${profile.pregnancyWeek}, trimester ${trimester}.\nApproved sources (the only IDs you may cite):\n${allSourcesText}\n\nIdentify every visible food/product in this shopping, menu, or listing screenshot. For each, extract visible details and give a concise full pregnancy-aware analysis. Do not infer text that is not visible.`,
        },
        { inlineData: image },
      ],
      config: {
        systemInstruction: system,
        responseMimeType: "application/json",
        temperature: 0.2,
        responseSchema: {
          type: Type.OBJECT,
          required: ["detectedItems"],
          properties: {
            detectedItems: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                required: ["name", "brand", "visibleDetails", "locationInImage", "confidence", "analysis"],
                properties: {
                  name: { type: Type.STRING },
                  brand: { anyOf: [{ type: Type.STRING }, { type: Type.NULL }] },
                  visibleDetails: { type: Type.ARRAY, items: { type: Type.STRING } },
                  locationInImage: { type: Type.STRING },
                  confidence: { type: Type.NUMBER },
                  analysis: analysisResponseSchema
                }
              }
            }
          }
        }
      },
    }),
  );

  const parsed = screenshotSchema.parse(repairJson(response.text || ""));

  // Every detected item goes through the same spine as a single scan — a
  // screenshot is not a reason to skip the rule floor.
  return parsed.detectedItems.map((detected) => {
    if (!detected.analysis) return detected;

    const item = toFoodItem({
      name: detected.name,
      brand: detected.brand ?? undefined,
      ingredients: detected.visibleDetails ?? [],
    });
    const matches = runRules(item, { trimester, conditions });

    const analysis = {
      ...detected.analysis,
      sourceIds: keepReal(detected.analysis.sourceIds),
    } as FoodAnalysis;

    const verdict = enforceSpine(analysis, matches);
    return {
      ...detected,
      analysis: verdict.ok
        ? { ...verdict.analysis, id: crypto.randomUUID(), createdAt: new Date().toISOString() }
        : fallbackAnalysis(item, matches, profile),
    };
  });
}

export async function chatAboutAnalysis(profile: UserProfile, analysis: FoodAnalysis, messages: { role: string; content: string }[]) {
  const response = await withRetry(() =>
    client().models.generateContent({
      model,
      contents: `Profile: ${JSON.stringify(profile)}\nAnalysis: ${JSON.stringify(analysis)}\nApproved sources: ${allSourcesText}\nConversation: ${JSON.stringify(messages)}\nAnswer the latest question in 2-4 calm, plain-language paragraphs. Use only the supplied context and source summaries. Say when information is unknown.`,
      config: { systemInstruction: system },
    }),
  );
  return response.text || "I'm sorry, I couldn't prepare an answer right now.";
}

/**
 * Follow-up chat scoped to a whole week of logged food, rather than to a single
 * analysis the way chatAboutAnalysis is.
 */
export async function chatAboutWeek(
  profile: UserProfile,
  entries: ConsumptionEntry[],
  summary: WeeklySummary | null,
  messages: { role: string; content: string }[]
) {
  const response = await withRetry(() =>
    client().models.generateContent({
      model,
      contents: `Profile: ${JSON.stringify(profile)}\nFoods logged this week: ${JSON.stringify(entries)}\nExisting weekly pattern summary (may be null): ${JSON.stringify(summary)}\nApproved sources: ${allSourcesText}\nConversation: ${JSON.stringify(messages)}\nAnswer the latest question about this week of logged food in 2-4 calm, plain-language paragraphs. Reason only over the logged entries and the supplied source summaries. Describe patterns in what was logged rather than diagnosing a deficiency, and say plainly when the log is too sparse to answer. Suggest practical foods that respect the stated allergies, avoided foods, and dietary preferences.`,
      config: { systemInstruction: system },
    }),
  );
  return response.text || "I'm sorry, I couldn't prepare an answer right now.";
}

export async function summarizeWeek(profile: UserProfile, entries: ConsumptionEntry[]): Promise<WeeklySummary> {
  const response = await withRetry(() =>
    client().models.generateContent({
      model,
      contents: `Profile: ${JSON.stringify(profile)}\nLogged entries: ${JSON.stringify(entries)}\nApproved sources: ${allSourcesText}\nSummarize patterns only from logged foods. Say "few logged/identifiable sources" rather than diagnosing deficiency. Provide practical preference-matched ideas.`,
      config: {
        systemInstruction: system,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          required: ["headline", "overview", "patterns", "addMore", "moderate", "alternatives", "providerQuestions", "limitations"],
          properties: {
            headline: { type: Type.STRING },
            overview: { type: Type.STRING },
            patterns: { type: Type.ARRAY, items: { type: Type.STRING } },
            addMore: { type: Type.ARRAY, items: { type: Type.OBJECT, required: ["name", "reason"], properties: { name: { type: Type.STRING }, reason: { type: Type.STRING } } } },
            moderate: { type: Type.ARRAY, items: { type: Type.OBJECT, required: ["name", "reason"], properties: { name: { type: Type.STRING }, reason: { type: Type.STRING } } } },
            alternatives: { type: Type.ARRAY, items: { type: Type.OBJECT, required: ["name", "reason"], properties: { name: { type: Type.STRING }, reason: { type: Type.STRING } } } },
            providerQuestions: { type: Type.ARRAY, items: { type: Type.STRING } },
            limitations: { type: Type.ARRAY, items: { type: Type.STRING } }
          }
        }
      },
    }),
  );
  return { ...weeklySummarySchema.parse(repairJson(response.text || "")), generatedAt: new Date().toISOString() };
}
