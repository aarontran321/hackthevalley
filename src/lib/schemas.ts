import { z } from "zod";

export const profileSchema = z.object({
  name: z.string().min(1).max(60),
  pregnancyWeek: z.number().int().min(1).max(42),
  heightCm: z.number().min(100).max(230),
  weightKg: z.number().min(30).max(300),
  healthConditions: z.array(z.string()).max(12),
  dietaryPreferences: z.array(z.string()).max(12),
  allergies: z.string().max(500),
  avoids: z.string().max(500)
});

export const foodAnalysisSchema = z.object({
  itemName: z.string(),
  status: z.enum(["generally_suitable", "use_caution", "consider_avoiding", "insufficient_information"]),
  summary: z.string(),
  explanation: z.string(),
  flaggedIngredients: z.array(z.object({ ingredient: z.string(), reason: z.string() })),
  trimesterContext: z.string(),
  conditionContext: z.string().nullable(),
  moderationGuidance: z.string().nullable(),
  alternatives: z.array(z.object({ name: z.string(), reason: z.string() })),
  questionsForProvider: z.array(z.string()),
  confidence: z.number().min(0).max(1),
  sourceIds: z.array(z.string()),
  limitations: z.array(z.string())
});

export const screenshotSchema = z.object({
  detectedItems: z.array(z.object({
    name: z.string(),
    brand: z.string().nullable(),
    visibleDetails: z.array(z.string()),
    locationInImage: z.string(),
    confidence: z.number().min(0).max(1),
    analysis: foodAnalysisSchema.optional()
  }))
});

export const weeklySummarySchema = z.object({
  headline: z.string(),
  overview: z.string(),
  patterns: z.array(z.string()),
  addMore: z.array(z.object({ name: z.string(), reason: z.string() })),
  moderate: z.array(z.object({ name: z.string(), reason: z.string() })),
  alternatives: z.array(z.object({ name: z.string(), reason: z.string() })),
  providerQuestions: z.array(z.string()),
  limitations: z.array(z.string())
});
