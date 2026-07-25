export type SafetyStatus =
  | "generally_suitable"
  | "use_caution"
  | "consider_avoiding"
  | "insufficient_information";

/** Which date the person chose to give us; both resolve to the same due date. */
export type DateBasis = "due" | "lmp";
export type BabyCount = "one" | "twins" | "three_plus";
export type UnitSystem = "metric" | "imperial";

export type UserProfile = {
  name: string;
  /** Derived from dateBasis/dateValue on every read — never edited directly. */
  pregnancyWeek: number;
  dateBasis: DateBasis;
  /** yyyy-mm-dd, or "" when they have not given a date yet. */
  dateValue: string;
  babies: BabyCount;
  /** Display preference only; weights and heights are always stored metric. */
  units: UnitSystem;
  heightCm: number;
  prePregnancyWeightKg: number;
  currentWeightKg: number | null;
  age: number;
  healthConditions: string[];
  dietaryPreferences: string[];
  allergies: string;
  /** Explicit "none", so the model can tell it apart from an unanswered field. */
  noAllergies: boolean;
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

/** Pregnancy is dated as 40 weeks from the last menstrual period. */
export const GESTATION_DAYS = 280;
const DAY_MS = 86_400_000;

/** Parses yyyy-mm-dd in local time. `new Date(value)` would read it as UTC and
 *  land on the previous day for anyone west of Greenwich. */
export const parseISODate = (value: string): Date | null => {
  const parts = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!parts) return null;
  const date = new Date(Number(parts[1]), Number(parts[2]) - 1, Number(parts[3]));
  return Number.isNaN(date.getTime()) ? null : date;
};

type DatedProfile = Pick<UserProfile, "dateBasis" | "dateValue">;

/** The due date, whichever way they chose to tell us. */
export const dueDateFor = (profile: DatedProfile): Date | null => {
  const date = parseISODate(profile.dateValue);
  if (!date) return null;
  if (profile.dateBasis === "due") return date;
  const due = new Date(date);
  due.setDate(due.getDate() + GESTATION_DAYS);
  return due;
};

/**
 * Completed gestational weeks today. Recomputed on every read so the profile
 * keeps up on its own instead of going stale the way a stored week would.
 * Falls back to any previously stored week for profiles saved before dates.
 */
export const weekFor = (
  profile: DatedProfile & { pregnancyWeek?: number },
  now: Date = new Date()
): number => {
  const clamp = (week: number) => Math.min(42, Math.max(1, week));
  const due = dueDateFor(profile);
  if (!due) return clamp(profile.pregnancyWeek ?? 1);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const daysLeft = Math.round((due.getTime() - today.getTime()) / DAY_MS);
  return clamp(Math.floor((GESTATION_DAYS - daysLeft) / 7));
};

export const weeksRemaining = (week: number) => Math.max(0, 40 - week);
