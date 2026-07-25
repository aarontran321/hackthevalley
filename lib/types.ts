export type Trimester = 1 | 2 | 3;

export type Severity = "AVOID" | "CAUTION" | "OK" | "UNKNOWN";

export type HazardClass =
  | "listeria"
  | "mercury"
  | "retinol"
  | "raw-animal-product"
  | "alcohol"
  | "caffeine"
  | "unpasteurized"
  | "added-sugar-gdm"
  | "none";

export interface Guideline {
  id: string; // 'FDA-MERCURY-2021'
  hazardClass: HazardClass;
  authority: "FDA" | "NHS" | "ACOG" | "CDC";
  title: string;
  summary: string; // <=60 words — this is the retrievable body
  sourceUrl: string;
}

export interface FoodItem {
  name: string;
  brand?: string;
  ingredients: string[];
  nutrition: Record<string, number>;
}

export interface VerdictFlag {
  ingredient: string;
  severity: Severity;
  plainReason: string; // <=20 words, no jargon
  guidelineIds: string[]; // must be non-empty and must resolve
}

export interface Alternative {
  name: string;
  why: string;
}

export interface Verdict {
  item: FoodItem;
  severity: Severity;
  headline: string; // <=8 words
  reasoning: string; // 2-3 plain sentences
  flags: VerdictFlag[];
  alternatives: Alternative[]; // sensory match, not nutritional
  modelConfidence: number;
  ruleTriggered: boolean; // layer 1 fired -> render the HARD FLAG tag
}
