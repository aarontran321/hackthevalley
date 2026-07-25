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

/**
 * Three ways in, and the SDK treats two of them as mutually exclusive:
 * passing project/location together with an API key throws
 * "Project/location and API key are mutually exclusive in the client
 * initializer". So pick exactly one mode rather than merging the two.
 *
 *   1. Vertex Express  GOOGLE_GENAI_USE_VERTEXAI=true + GEMINI_API_KEY
 *   2. Vertex with ADC GOOGLE_GENAI_USE_VERTEXAI=true + GOOGLE_CLOUD_PROJECT,
 *                      no API key (credentials come from the environment)
 *   3. Gemini API      GEMINI_API_KEY alone
 *
 * Measured 2026-07-25: the direct Gemini API returns 403
 * API_KEY_SERVICE_BLOCKED for this project, while Vertex Express with the same
 * key succeeds — so mode 1 is the working path today.
 */
const client = () => {
  const apiKey = process.env.GEMINI_API_KEY;
  const useVertexAI = process.env.GOOGLE_GENAI_USE_VERTEXAI === "true";
  const project = process.env.GOOGLE_CLOUD_PROJECT;

  if (useVertexAI && project && !apiKey) {
    return new GoogleGenAI({
      vertexai: true,
      project,
      location: process.env.GOOGLE_CLOUD_LOCATION || "global"
    });
  }

  if (!apiKey) throw new Error("GEMINI_NOT_CONFIGURED");

  // An API key is present, so never send project/location alongside it.
  return new GoogleGenAI({ apiKey, vertexai: useVertexAI });
};

/** Whole corpus, for the calls that reason over a food log rather than one item. */
const allSourcesText = GUIDELINES.map(
  (g) => `[${g.id}] ${g.authority} — ${g.title}\n${g.summary}`,
).join("\n\n");

/**
 * Ordinary text searches such as "apple with peanut butter" may not trigger a
 * high-stakes hazard keyword. They still deserve a useful report, so give the
 * model a small cross-authority baseline covering nutrition, produce safety,
 * allergens, and handling. This is not permission to infer beyond the corpus.
 */
const GENERAL_ANALYSIS_BASELINE_IDS = [
  "ACOG-NUTRITION-01",
  "CDC-SAFERFOOD-2025",
  "FDA-ALLERGIES-2025",
  "HC-SAFEFOOD-2025",
  "NHS-GDM-2023",
  "ACOG-CAFFEINE-2010",
  "FDA-LISTERIA-2022",
  "CDC-ALCOHOL-2026",
  "FDA-SWEETENERS-2025",
  "FDA-ADDEDSUGAR-2025",
  "NHS-SWEETENERS-2023",
];

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

const system = `You are nutri.ai's calm educational reasoning layer. You do not diagnose, prescribe, recommend supplement doses, or make absolute safety guarantees. Base medical and food-safety claims ONLY on the supplied source summaries. Cite ONLY supplied source IDs — never invent one. If no supplied source supports a conclusion, use insufficient_information. If a deterministic pre-check assigned a status, you may raise its severity but never lower it. Clearly identify uncertainty in limitations. Personalize to the provided pregnancy week, conditions, allergies, and preferences without weight-loss or appearance advice.`;

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

/** Only a bad image is the caller's fault to fix; everything else degrades. */
const isCallerError = (err: unknown) =>
  (err instanceof Error ? err.message : "") === "INVALID_IMAGE";

const isMissingKey = (err: unknown) =>
  (err instanceof Error ? err.message : "") === "GEMINI_NOT_CONFIGURED";

/**
 * Why a rule-only analysis is being returned. Shown to the user in
 * `limitations`, because a degraded answer they can't distinguish from a full
 * one is worse than no answer.
 */
function degradedNote(err: unknown): string {
  if (isMissingKey(err)) {
    return "No Gemini key is configured, so this is the deterministic rule match only.";
  }
  if (isRateLimit(err)) {
    return "The Gemini account is out of credit, so the plain-language explanation step did not run. This is the deterministic rule match against published guidance.";
  }
  return "The explanation step was unavailable, so this is the deterministic rule match only.";
}

/**
 * One retry, and only for faults a second attempt can fix. Retrying a 429 just
 * burns the remaining daily quota; retrying a missing key never helps.
 */
async function withRetry<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (first) {
    if (isRateLimit(first) || isCallerError(first) || isMissingKey(first)) throw first;
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
  const retrievedGuidelines = retrieveGuidelines(item, matches, { conditions });
  // Every named or scanned item reaches Gemini. Broad baseline documents give
  // sparse catalogue records useful pregnancy context without allowing the
  // model to invent an ingredient list.
  const baselineGuidelines = GENERAL_ANALYSIS_BASELINE_IDS
    .map((id) => GUIDELINE_BY_ID.get(id))
    .filter((guideline): guideline is NonNullable<typeof guideline> => Boolean(guideline));
  const guidelines = [
    ...retrievedGuidelines,
    ...baselineGuidelines.filter(
      (baseline) => !retrievedGuidelines.some((retrieved) => retrieved.id === baseline.id),
    ),
  ].slice(0, 12);

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
          buildSourcesText(guidelines.length > 0 ? guidelines : GUIDELINES.slice(0, 8)),
          ``,
          input.imageDataUrl
            ? `For the image, first identify the likely item, visible ingredients and preparation, and reflect uncertainty in limitations and confidence.`
            : input.mode === "text"
              ? `Interpret the user's named food or meal literally. Give a useful item-specific report using only the supplied guidance. If preparation, pasteurization, portion, allergens, or ingredients are unknown, state that uncertainty rather than treating the item as unidentified.`
              : input.mode === "barcode"
                ? `Write an item-specific report even when catalogue data is sparse. Use the product name, categories, labels, ingredients, allergens, additives and nutrition fields that are present. Never invent missing product facts. If the record is unidentified, explain exactly what packaging detail is needed and return insufficient_information.`
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
    // A bad image is the only failure the caller can fix, so it's the only one
    // that errors. Everything else — no key, depleted credit, a network blip —
    // still has a deterministic rule result worth showing. A cited AVOID beats
    // an error screen when someone is stood in an aisle holding a jar.
    if (isCallerError(error)) throw error;
    const message = error instanceof Error ? error.message : "";
    console.warn(`[analyse] model step unavailable, using rules: ${message.slice(0, 160)}`);
    return fallbackAnalysis(item, matches, profile, degradedNote(error));
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
      // Conversational voice from fe63c3b: short and direct beats a report.
      contents: `You are having a one-on-one conversation, not writing a report. Answer the latest question directly in a warm, natural voice. Use 2-5 short sentences and no more than 110 words. Do not repeat the user's question, recap the full analysis, list unrelated guidance, or over-explain. Cite at most two relevant supplied source IDs in one brief final parenthetical. If the user asks a broader pregnancy food, drink, or supplement question, answer it when the supplied sources support it. When they do not, say so briefly and suggest the most relevant qualified professional.

Profile: ${JSON.stringify(profile)}
Current food analysis: ${JSON.stringify(analysis)}
Approved sources: ${allSourcesText}
Conversation: ${JSON.stringify(messages)}`,
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
