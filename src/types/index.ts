export type SafetyStatus =
  | "generally_suitable"
  | "use_caution"
  | "consider_avoiding"
  | "insufficient_information";

export type UserProfile = {
  name: string;
  pregnancyWeek: number;
  heightCm: number;
  weightKg: number;
  healthConditions: string[];
  dietaryPreferences: string[];
  allergies: string;
  avoids: string;
};

export type GuidanceSource = {
  id: string;
  title: string;
  organization: string;
  url: string;
  topic: string;
  summary: string;
  applicableRisks: string[];
};

export type FoodAnalysis = {
  id: string;
  itemName: string;
  status: SafetyStatus;
  summary: string;
  explanation: string;
  flaggedIngredients: { ingredient: string; reason: string }[];
  trimesterContext: string;
  conditionContext: string | null;
  moderationGuidance: string | null;
  alternatives: { name: string; reason: string }[];
  questionsForProvider: string[];
  confidence: number;
  sourceIds: string[];
  limitations: string[];
  imageUrl?: string;
  nutrition?: EstimatedNutrients;
  isDemo?: boolean;
  createdAt: string;
};

export type EstimatedNutrients = {
  calories?: number;
  protein?: number;
  iron?: number;
  calcium?: number;
  folate?: number;
  sugar?: number;
  caffeine?: number;
};

export type ConsumptionEntry = {
  id: string;
  itemName: string;
  timestamp: string;
  mealType: "breakfast" | "lunch" | "dinner" | "snack";
  quantity?: string;
  safetyStatus: SafetyStatus;
  flaggedIngredients: string[];
  estimatedNutrients?: EstimatedNutrients;
  originalAnalysis: FoodAnalysis;
};

export type ScreenshotItem = {
  name: string;
  brand: string | null;
  visibleDetails: string[];
  locationInImage: string;
  confidence: number;
  analysis?: FoodAnalysis;
};

export type WeeklySummary = {
  headline: string;
  overview: string;
  patterns: string[];
  addMore: { name: string; reason: string }[];
  moderate: { name: string; reason: string }[];
  alternatives: { name: string; reason: string }[];
  providerQuestions: string[];
  limitations: string[];
  generatedAt: string;
  isDemo?: boolean;
};

export const trimesterForWeek = (week: number) =>
  week <= 13 ? 1 : week <= 27 ? 2 : 3;
