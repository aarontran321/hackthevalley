import type { FoodAnalysis, SafetyStatus, UserProfile } from "@/types";

import { isRealGuidelineId } from "./guidelines";
import { formatGuidelinesForPrompt } from "./retrieval";
import type { RuleMatch } from "./rules";
import { ruleSeverityFloor } from "./rules";
import type { FoodItem, Guideline, Severity, Trimester } from "./types";

/**
 * Binds the deterministic spine to the shape the BumpSafe UI renders.
 *
 * The model's job is to explain which supplied guidelines apply. It does not
 * get to decide severity downward: layer 1 sets a floor from rules that ran
 * before the model was consulted, and anything that comes back below that floor
 * — or citing a source that does not exist — is discarded in favour of the
 * rule-only result.
 */

const SEVERITY_TO_STATUS: Record<Severity, SafetyStatus> = {
  AVOID: "consider_avoiding",
  CAUTION: "use_caution",
  OK: "generally_suitable",
  UNKNOWN: "insufficient_information",
};

/** generally_suitable and insufficient_information both rank 0: neither is
 *  allowed to sit underneath a rule that fired. */
const STATUS_RANK: Record<SafetyStatus, number> = {
  consider_avoiding: 2,
  use_caution: 1,
  generally_suitable: 0,
  insufficient_information: 0,
};

export function statusForSeverity(severity: Severity): SafetyStatus {
  return SEVERITY_TO_STATUS[severity];
}

export function trimesterForWeek(week: number): Trimester {
  if (week <= 13) return 1;
  if (week <= 27) return 2;
  return 3;
}

/**
 * Condition slugs the rule engine understands, derived from the free-text
 * conditions the profile collects.
 */
export function conditionSlugs(profile: UserProfile): string[] {
  const text = [...(profile.healthConditions ?? []), profile.avoids ?? ""]
    .join(" ")
    .toLowerCase();
  const slugs: string[] = [];
  if (/gestational\s*diabetes|\bgdm\b/.test(text)) slugs.push("gestational-diabetes");
  if (/blood pressure|hypertens|pre-?eclampsia/.test(text)) slugs.push("high-blood-pressure");
  if (/anemia|anaemia|low iron|iron deficien/.test(text)) slugs.push("iron-deficiency");
  return slugs;
}

/** Coerce whatever the caller has (an Open Food Facts product, a text query,
 *  a photo identification) into the shape the rules read. */
export function toFoodItem(input: unknown, fallbackName = "Unidentified food"): FoodItem {
  const o = (typeof input === "object" && input !== null ? input : {}) as Record<string, unknown>;

  const name =
    [o.name, o.itemName, o.product_name, o.title, o.query, o.searchQuery]
      .find((v): v is string => typeof v === "string" && v.trim().length > 0)
      ?.trim() ?? fallbackName;

  const brand =
    [o.brand, o.brands].find((v): v is string => typeof v === "string" && v.trim().length > 0)
      ?.split(",")[0]
      ?.trim() || undefined;

  let ingredients: string[] = [];
  const raw = o.ingredients ?? o.likelyIngredients ?? o.ingredients_text;
  if (Array.isArray(raw)) {
    ingredients = raw
      .map((i) => (typeof i === "string" ? i : (i as { text?: string })?.text ?? ""))
      .map((s) => s.trim())
      .filter(Boolean);
  } else if (typeof raw === "string") {
    ingredients = raw
      .split(/[,;]/)
      .map((s) => s.replace(/\([^)]*\)/g, " ").replace(/\s+/g, " ").trim())
      .filter((s) => s.length > 1);
  }

  const nutrition: Record<string, number> = {};
  const nut = o.nutriments ?? o.nutrition;
  if (typeof nut === "object" && nut !== null) {
    for (const [k, v] of Object.entries(nut as Record<string, unknown>)) {
      if (typeof v === "number" && Number.isFinite(v)) nutrition[k] = v;
    }
  }

  return { name, brand, ingredients, nutrition };
}

/** The pre-check block handed to the model. Naming the floor explicitly is what
 *  lets the model raise severity while knowing it may not lower it. */
export function buildPrecheckText(matches: RuleMatch[]): string {
  const floor = ruleSeverityFloor(matches);
  if (!floor) {
    return "The deterministic pre-check found no high-stakes hazard. That is not the same as the food being safe — decide from the supplied documents alone.";
  }
  return [
    `A deterministic pre-check assigned severity ${SEVERITY_TO_STATUS[floor]}. You may raise this, never lower it.`,
    ...matches.map(
      (m) => `- ${m.ingredient} -> ${SEVERITY_TO_STATUS[m.severity]} (${m.guidelineIds.join(", ")})`,
    ),
  ].join("\n");
}

export function buildSourcesText(guidelines: Guideline[]): string {
  return formatGuidelinesForPrompt(guidelines);
}

export type SpineRejection =
  | "unknown-guideline-id"
  | "uncited-conclusion"
  | "severity-downgrade";

/**
 * Layer 3. Returns the analysis unchanged if it holds up, or a reason if it
 * doesn't — in which case the caller falls back to the rule-only result rather
 * than trying to patch it up.
 */
export function enforceSpine(
  analysis: FoodAnalysis,
  matches: RuleMatch[],
): { ok: true; analysis: FoodAnalysis } | { ok: false; reason: SpineRejection; detail: string } {
  const cited = analysis.sourceIds ?? [];
  const bogus = cited.filter((id) => !isRealGuidelineId(id));
  if (bogus.length > 0) {
    // A hallucinated ID looks exactly like a real one on a source card.
    return {
      ok: false,
      reason: "unknown-guideline-id",
      detail: `cited ${bogus.join(", ")}, not in the corpus`,
    };
  }

  const status = analysis.status;
  if (STATUS_RANK[status] > 0 && cited.length === 0) {
    return {
      ok: false,
      reason: "uncited-conclusion",
      detail: `${status} with no supporting source`,
    };
  }

  const floor = ruleSeverityFloor(matches);
  if (floor && STATUS_RANK[status] < STATUS_RANK[SEVERITY_TO_STATUS[floor]]) {
    return {
      ok: false,
      reason: "severity-downgrade",
      detail: `model returned ${status} under a ${SEVERITY_TO_STATUS[floor]} rule flag`,
    };
  }

  return { ok: true, analysis };
}

/**
 * Rule-only result, used whenever the model is unavailable or its output is
 * rejected. Deterministic, always citable, and honest that the explanation step
 * didn't run — which beats an error screen when someone is stood in an aisle.
 */
export function fallbackAnalysis(
  item: FoodItem,
  matches: RuleMatch[],
  profile: UserProfile,
  note = "The explanation step was unavailable, so this is the rule match on its own.",
): FoodAnalysis {
  const floor = ruleSeverityFloor(matches);
  const week = profile.pregnancyWeek;
  const trimesterContext = `Week ${week}, trimester ${trimesterForWeek(week)}.`;

  if (!floor) {
    return {
      id: crypto.randomUUID(),
      itemName: item.name,
      status: "insufficient_information",
      summary: "Not enough information to say.",
      explanation: `No pregnancy food-safety rule matched this item, and ${note.toLowerCase()} The ingredients are listed so you can check them yourself.`,
      flaggedIngredients: [],
      trimesterContext,
      conditionContext: null,
      moderationGuidance: null,
      alternatives: [],
      questionsForProvider: ["Is there anything about this food I should watch for at my stage?"],
      confidence: 0,
      sourceIds: [],
      limitations: [note, "No guideline in the corpus applied to these ingredients."],
      createdAt: new Date().toISOString(),
    };
  }

  return {
    id: crypto.randomUUID(),
    itemName: item.name,
    status: SEVERITY_TO_STATUS[floor],
    summary:
      floor === "AVOID" ? "A published guideline flags this." : "Worth a closer look.",
    explanation: `${matches[0].plainReason} ${note}`,
    flaggedIngredients: matches.map((m) => ({
      ingredient: m.ingredient,
      reason: m.plainReason,
    })),
    trimesterContext,
    conditionContext: null,
    moderationGuidance: null,
    alternatives: [],
    questionsForProvider: [
      "Is this something I should avoid entirely, or is preparation enough?",
    ],
    confidence: 0,
    // Rule citations are corpus IDs by construction, so these always resolve.
    sourceIds: [...new Set(matches.flatMap((m) => m.guidelineIds))],
    limitations: [note],
    createdAt: new Date().toISOString(),
  };
}
