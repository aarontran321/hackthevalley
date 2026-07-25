import type { FoodItem, HazardClass, Severity, Trimester } from "./types";

/**
 * Safety spine, layer 1. Deterministic TypeScript matchers for high-stakes
 * hazards. Whatever this returns is a floor: the model may raise severity in
 * layer 2, never lower it, and the validator in layer 3 enforces that.
 *
 * Bias: these fire on near-binary, well-documented hazards only. A rule that
 * fires on "milk" would be worse than no rule at all — it would train the user
 * to ignore hard flags.
 */

export interface RuleMatch {
  /** Rules only ever produce these two; OK and UNKNOWN are not rule outcomes. */
  severity: Extract<Severity, "AVOID" | "CAUTION">;
  hazardClass: HazardClass;
  /** The phrase that actually triggered, so the receipt can name it. */
  ingredient: string;
  plainReason: string;
  guidelineIds: string[];
}

export interface RuleContext {
  trimester: Trimester;
  /** Free-text condition slugs from setup, e.g. ['gestational-diabetes']. */
  conditions: string[];
}

/**
 * Strip diacritics and collapse whitespace. Open Food Facts ingredient text is
 * inconsistently accented across locales, so "pâté" and "pate" must both match.
 */
function normalize(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Whole-phrase match, so "sliver" never trips the "liver" rule.
 *
 * The trailing `(?:e?s)?` matters in both directions: it lets "sprouts" match a
 * singular label, and — the reason it exists — it lets the "brussels sprout"
 * guard suppress the plural "brussels sprouts". Without it the boundary check
 * refuses to match across the final s, and Brussels sprouts get hard-flagged
 * as a listeria risk.
 */
function findPhrase(hay: string, phrases: string[]): string | undefined {
  for (const p of phrases) {
    const re = new RegExp(`(?:^|[^a-z0-9])${escapeRegex(p)}(?:e?s)?(?:[^a-z0-9]|$)`);
    if (re.test(hay)) return p;
  }
  return undefined;
}

interface Matcher {
  hazardClass: HazardClass;
  severity: Extract<Severity, "AVOID" | "CAUTION">;
  phrases: string[];
  /** If any of these appear, the match is suppressed. */
  unless?: string[];
  plainReason: string;
  guidelineIds: string[];
  /** Gate on user conditions, e.g. the GDM rule. */
  requiresCondition?: string;
}

const MATCHERS: Matcher[] = [
  {
    hazardClass: "listeria",
    severity: "AVOID",
    phrases: [
      "deli meat", "deli turkey", "deli ham", "deli chicken", "delicatessen meat",
      "luncheon meat", "lunch meat", "cold cut", "coldcut", "sliced turkey breast",
      "hot dog", "hotdog", "frankfurter", "wiener", "bologna", "baloney",
      "salami", "mortadella", "prosciutto", "pastrami", "capicola", "coppa",
      "chorizo", "pepperoni",
      // Open Food Facts is Europe-heavy: a US user scanning an imported pack
      // gets Spanish or French ingredient text. Layer 1 has to see through
      // that, or the flagship hazard silently passes. Only unambiguously
      // ready-to-eat terms here — plain "salchicha" is often a raw sausage.
      "pechuga de pavo", "fiambre", "jamon cocido", "jamon york", "mortadela",
      "salchichon", "jambon", "blanc de dinde", "saucisson", "charcuterie",
    ],
    plainReason: "Ready-to-eat deli meat: listeria risk unless heated until steaming.",
    guidelineIds: ["FDA-DELI-RTE-2022", "FDA-LISTERIA-2022"],
  },
  {
    hazardClass: "mercury",
    severity: "AVOID",
    // Deliberately specific. Plain "mackerel" is a Best Choice fish; only king
    // mackerel is high-mercury, and flagging the wrong one erodes trust.
    phrases: [
      "shark", "swordfish", "king mackerel", "tilefish", "bigeye tuna",
      "big eye tuna", "marlin", "orange roughy",
    ],
    plainReason: "Highest-mercury fish; FDA lists it as a choice to avoid in pregnancy.",
    guidelineIds: ["FDA-MERCURY-2021"],
  },
  {
    hazardClass: "unpasteurized",
    severity: "AVOID",
    phrases: [
      "unpasteurized", "unpasteurised", "raw milk", "raw-milk", "raw cow milk",
      "leche cruda", "no pasteurizado", "sin pasteurizar",
      "lait cru", "non pasteurise", "au lait cru",
    ],
    plainReason: "Unpasteurized dairy can carry listeria, salmonella and E. coli.",
    guidelineIds: ["FDA-RAWMILK-2024", "FDA-LISTERIA-2022"],
  },
  {
    hazardClass: "unpasteurized",
    severity: "AVOID",
    phrases: [
      "brie", "camembert", "chevre", "roquefort", "gorgonzola", "danish blue",
      "queso fresco", "queso blanco", "requeson", "panela cheese",
    ],
    plainReason: "Soft or mould-ripened cheese must be cooked through before eating.",
    guidelineIds: ["NHS-SOFTCHEESE-2023", "FDA-LISTERIA-2022"],
  },
  {
    hazardClass: "retinol",
    severity: "AVOID",
    phrases: [
      "liver", "pate", "liverwurst", "liver sausage", "foie gras", "braunschweiger",
      "higado", "foie", "leberwurst",
    ],
    plainReason: "Liver and pâté are very high in vitamin A, which can harm the baby.",
    guidelineIds: ["NHS-VITAMINA-2023"],
  },
  {
    hazardClass: "alcohol",
    severity: "AVOID",
    phrases: [
      "wine", "beer", "vodka", "rum", "whisky", "whiskey", "bourbon", "brandy",
      "liqueur", "tequila", "champagne", "prosecco", "sake", "ethanol", "ethyl alcohol",
      "vino", "cerveza", "vin blanc", "vin rouge", "biere",
    ],
    // Sugar alcohols and fatty alcohols are not drinking alcohol; vinegar is
    // not either. Without these guards this rule fires on half the shelf.
    unless: [
      "sugar alcohol", "cetyl alcohol", "stearyl alcohol", "cetearyl alcohol",
      "alcohol free", "alcohol-free", "non-alcoholic", "nonalcoholic",
      "de-alcoholized", "dealcoholized", "wine vinegar", "rice wine vinegar",
    ],
    plainReason: "No known safe amount of alcohol at any point in pregnancy.",
    guidelineIds: ["CDC-ALCOHOL-2026"],
  },
  {
    hazardClass: "raw-animal-product",
    severity: "AVOID",
    phrases: [
      "sushi", "sashimi", "tartare", "carpaccio", "ceviche", "raw egg",
      "runny egg", "soft boiled egg", "soft-boiled egg", "raw fish", "raw oyster",
      "raw shellfish", "undercooked",
    ],
    plainReason: "Raw or undercooked animal food: toxoplasmosis and salmonella risk.",
    guidelineIds: ["NHS-RAWANIMAL-2023"],
  },
  {
    hazardClass: "listeria",
    severity: "AVOID",
    // Phrases are stored SINGULAR throughout: findPhrase appends an optional
    // plural, so "sprout" catches "sprouts" but "sprouts" would miss "sprout".
    phrases: [
      "raw sprout", "alfalfa sprout", "bean sprout", "mung bean sprout",
      "clover sprout", "radish sprout", "sprout",
    ],
    // Brussels sprouts are an entirely different vegetable and perfectly fine.
    unless: ["brussels sprout", "brussel sprout"],
    plainReason: "Raw sprouts carry bacteria that cannot be washed out of the seed.",
    guidelineIds: ["FDA-SPROUTS-2023"],
  },
  {
    hazardClass: "caffeine",
    severity: "CAUTION",
    phrases: [
      "caffeine", "coffee", "espresso", "energy drink", "guarana", "yerba mate",
      "cola", "black tea", "green tea", "matcha",
    ],
    unless: ["decaf", "decaffeinated", "caffeine free", "caffeine-free"],
    plainReason: "Counts toward the 200 mg daily caffeine ceiling ACOG describes.",
    guidelineIds: ["ACOG-CAFFEINE-2010"],
  },
  {
    hazardClass: "added-sugar-gdm",
    severity: "CAUTION",
    phrases: [
      "high fructose corn syrup", "glucose-fructose syrup", "corn syrup",
      "invert sugar", "cane sugar", "dextrose", "maltodextrin",
    ],
    requiresCondition: "gestational-diabetes",
    plainReason: "Fast-absorbing sugar; worth watching with gestational diabetes.",
    guidelineIds: ["NHS-GDM-2023"],
  },
];

/**
 * Run every matcher against the item. Returns one match per matcher that fires,
 * strongest first. Empty array means layer 1 has no opinion — which is not the
 * same as the food being safe.
 */
export function runRules(item: FoodItem, ctx: RuleContext): RuleMatch[] {
  const hay = normalize(
    [item.name, item.brand ?? "", ...item.ingredients].join(" | "),
  );

  const matches: RuleMatch[] = [];

  for (const m of MATCHERS) {
    if (m.requiresCondition && !ctx.conditions.includes(m.requiresCondition)) {
      continue;
    }
    if (m.unless && findPhrase(hay, m.unless)) continue;

    const hit = findPhrase(hay, m.phrases);
    if (!hit) continue;

    matches.push({
      severity: m.severity,
      hazardClass: m.hazardClass,
      ingredient: hit,
      plainReason: m.plainReason,
      guidelineIds: m.guidelineIds,
    });
  }

  return matches.sort((a, b) =>
    a.severity === b.severity ? 0 : a.severity === "AVOID" ? -1 : 1,
  );
}

/** The severity floor the model is not allowed to go below. Null = no opinion. */
export function ruleSeverityFloor(
  matches: RuleMatch[],
): Extract<Severity, "AVOID" | "CAUTION"> | null {
  if (matches.some((m) => m.severity === "AVOID")) return "AVOID";
  if (matches.some((m) => m.severity === "CAUTION")) return "CAUTION";
  return null;
}
