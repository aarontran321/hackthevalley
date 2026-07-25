import { GoogleGenAI, Type } from "@google/genai";
import guidance from "@/data/guidance.json";
import { foodAnalysisSchema, screenshotSchema, weeklySummarySchema } from "@/lib/schemas";
import type { ConsumptionEntry, FoodAnalysis, UserProfile, WeeklySummary } from "@/types";

const model = process.env.GEMINI_MODEL || "gemini-3.6-flash";
const ids = new Set(guidance.map((source) => source.id));

const client = () => {
  if (!process.env.GEMINI_API_KEY) throw new Error("GEMINI_NOT_CONFIGURED");
  const useVertexAI = process.env.GOOGLE_GENAI_USE_VERTEXAI === "true";
  return new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
    vertexai: useVertexAI,
    ...(useVertexAI && process.env.GOOGLE_CLOUD_PROJECT
      ? {
          project: process.env.GOOGLE_CLOUD_PROJECT,
          location: process.env.GOOGLE_CLOUD_LOCATION || "global"
        }
      : {})
  });
};

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

const system = `You are BumpSafe's calm educational reasoning layer. You do not diagnose, prescribe, recommend supplement doses, or make absolute safety guarantees. Base medical and food-safety claims ONLY on the supplied source summaries. Cite ONLY supplied source IDs. If no source supports a conclusion, use insufficient_information. Clearly identify uncertainty. Personalize to the provided pregnancy week, conditions, allergies, and preferences without weight-loss or appearance advice.`;

const sourcesText = JSON.stringify(guidance);

const parseDataUrl = (dataUrl: string) => {
  const match = dataUrl.match(/^data:(image\/(?:jpeg|png|webp));base64,(.+)$/);
  if (!match) throw new Error("INVALID_IMAGE");
  return { mimeType: match[1], data: match[2] };
};

export async function analyseItem(input: {
  profile: UserProfile;
  item: unknown;
  imageDataUrl?: string;
  mode: "barcode" | "image" | "text";
}): Promise<FoodAnalysis> {
  const contents: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> = [
    { text: `${system}\n\nProfile: ${JSON.stringify(input.profile)}\nInput mode: ${input.mode}\nItem/product details: ${JSON.stringify(input.item)}\nApproved guidance sources: ${sourcesText}\n\nFor an image, first identify the likely item, visible ingredients and preparation, and reflect uncertainty in limitations and confidence. Return the requested structured analysis.` }
  ];
  if (input.imageDataUrl) contents.push({ inlineData: parseDataUrl(input.imageDataUrl) });
  const response = await client().models.generateContent({
    model,
    contents,
    config: { responseMimeType: "application/json", responseSchema: analysisResponseSchema }
  });
  const parsed = foodAnalysisSchema.parse(JSON.parse(response.text || "{}"));
  parsed.sourceIds = parsed.sourceIds.filter((id) => ids.has(id));
  if (!parsed.sourceIds.length && parsed.status !== "insufficient_information") parsed.status = "insufficient_information";
  return { ...parsed, id: crypto.randomUUID(), createdAt: new Date().toISOString() };
}

export async function analyseScreenshot(profile: UserProfile, imageDataUrl: string) {
  const image = parseDataUrl(imageDataUrl);
  const response = await client().models.generateContent({
    model,
    contents: [
      { text: `${system}\nProfile: ${JSON.stringify(profile)}\nApproved sources: ${sourcesText}\nIdentify every visible food/product in this shopping, menu, or listing screenshot. For each, extract visible details and give a concise full pregnancy-aware analysis. Do not infer text that is not visible.` },
      { inlineData: image }
    ],
    config: {
      responseMimeType: "application/json",
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
    }
  });
  const parsed = screenshotSchema.parse(JSON.parse(response.text || "{}"));
  return parsed.detectedItems.map((item) => item.analysis ? {
    ...item,
    analysis: {
      ...item.analysis,
      sourceIds: item.analysis.sourceIds.filter((id) => ids.has(id)),
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString()
    }
  } : item);
}

export async function chatAboutAnalysis(profile: UserProfile, analysis: FoodAnalysis, messages: { role: string; content: string }[]) {
  const response = await client().models.generateContent({
    model,
    contents: `${system}

You are having a one-on-one conversation, not writing a report. Answer the latest question directly in a warm, natural voice. Use 2-5 short sentences and no more than 110 words. Do not repeat the user's question, recap the full analysis, list unrelated guidance, or over-explain. Cite at most two relevant supplied source IDs in one brief final parenthetical. If the user asks a broader pregnancy food, drink, or supplement question, answer it when the supplied sources support it. When they do not, say so briefly and suggest the most relevant qualified professional.

Profile: ${JSON.stringify(profile)}
Current food analysis: ${JSON.stringify(analysis)}
Approved sources: ${sourcesText}
Conversation: ${JSON.stringify(messages)}`,
  });
  return response.text || "I’m sorry, I couldn’t prepare an answer right now.";
}

export async function summarizeWeek(profile: UserProfile, entries: ConsumptionEntry[]): Promise<WeeklySummary> {
  const response = await client().models.generateContent({
    model,
    contents: `${system}\nProfile: ${JSON.stringify(profile)}\nLogged entries: ${JSON.stringify(entries)}\nApproved sources: ${sourcesText}\nSummarize patterns only from logged foods. Say "few logged/identifiable sources" rather than diagnosing deficiency. Provide practical preference-matched ideas.`,
    config: {
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
    }
  });
  return { ...weeklySummarySchema.parse(JSON.parse(response.text || "{}")), generatedAt: new Date().toISOString() };
}
