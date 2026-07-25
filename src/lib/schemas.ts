import { z } from "zod";

export const profileSchema = z.object({
  name: z.string().min(1).max(60),
  pregnancyWeek: z.number().int().min(1).max(42),
  // Defaults keep older saved profiles from failing validation outright.
  dateBasis: z.enum(["due", "lmp"]).default("due"),
  dateValue: z.string().max(10).default(""),
  babies: z.enum(["one", "twins", "three_plus"]).default("one"),
  units: z.enum(["metric", "imperial"]).default("metric"),
  heightCm: z.number().min(100).max(230),
  prePregnancyWeightKg: z.number().min(30).max(300).default(68),
  currentWeightKg: z.number().min(30).max(300).nullable().default(null),
  age: z.number().int().min(12).max(60).default(30),
  healthConditions: z.array(z.string()).max(12),
  dietaryPreferences: z.array(z.string()).max(12),
  allergies: z.string().max(500),
  noAllergies: z.boolean().default(false),
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
