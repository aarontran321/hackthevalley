import { GUIDELINES } from "./guidelines";
import type { RuleMatch } from "./rules";
import type { FoodItem, Guideline } from "./types";

/**
 * Retrieval over 12 documents: keyword + hazard-class matching, no vector
 * store. At this corpus size exhaustive matching beats embedding retrieval and
 * has no recall failure mode — every document is compared every time.
 *
 * Keywords live here rather than on the Guideline interface so the corpus stays
 * exactly the shape the spec defines.
 */
const KEYWORDS: Record<string, string[]> = {
  "FDA-MERCURY-2021": [
    "fish", "seafood", "tuna", "shark", "swordfish", "mackerel", "tilefish",
    "marlin", "roughy", "salmon", "cod", "halibut", "sushi", "mercury", "pescado", "poisson",
  ],
  "FDA-LISTERIA-2022": [
    "listeria", "ready to eat", "ready-to-eat", "refrigerated", "chilled",
    "smoked salmon", "smoked fish", "deli", "cold cut", "leftovers",
  ],
  "FDA-DELI-RTE-2022": [
    "deli", "ham", "turkey", "chicken breast", "salami", "bologna", "hot dog",
    "frankfurter", "sausage", "pastrami", "prosciutto", "luncheon", "charcuterie",
    "pechuga", "pavo", "jamon", "jambon", "fiambre", "mortadela",
  ],
  "FDA-RAWMILK-2024": [
    "milk", "raw milk", "unpasteurized", "unpasteurised", "dairy", "cream",
    "leche", "lait", "kefir", "buttermilk",
  ],
  "NHS-SOFTCHEESE-2023": [
    "cheese", "brie", "camembert", "chevre", "blue cheese", "roquefort",
    "gorgonzola", "feta", "queso", "mozzarella", "ricotta", "fromage",
  ],
  "NHS-VITAMINA-2023": [
    "liver", "pate", "pâté", "foie", "vitamin a", "retinol", "liverwurst",
    "braunschweiger", "higado",
  ],
  "NHS-RAWANIMAL-2023": [
    "egg", "raw", "undercooked", "rare", "tartare", "carpaccio", "ceviche",
    "sashimi", "runny", "mayonnaise", "mousse", "tiramisu", "meat", "beef", "pork",
  ],
  "FDA-SPROUTS-2023": [
    "sprout", "alfalfa", "mung", "clover", "radish", "bean sprout", "salad", "produce",
  ],
  "CDC-ALCOHOL-2026": [
    "alcohol", "wine", "beer", "vodka", "rum", "whisky", "whiskey", "liqueur",
    "cider", "spirit", "ethanol", "vino", "cerveza", "biere",
  ],
  "ACOG-CAFFEINE-2010": [
    "caffeine", "coffee", "espresso", "tea", "cola", "energy drink", "matcha",
    "guarana", "chocolate", "cocoa", "yerba",
  ],
  "NHS-GDM-2023": [
    "sugar", "syrup", "glucose", "fructose", "carbohydrate", "dextrose",
    "maltodextrin", "sweetener", "honey", "diabetes",
  ],
  "CDC-FOLATE-2026": [
    "folate", "folic acid", "spinach", "leafy greens", "lentils", "fortified",
    "cereal", "beans", "prenatal vitamin",
  ],
};

function normalize(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

/** Cap on how many documents go in the prompt. All 12 would still fit, but a
 *  tighter set measurably reduces the model reaching for a marginal citation. */
const MAX_DOCS = 6;

export function retrieveGuidelines(
  item: FoodItem,
  ruleMatches: RuleMatch[],
  { conditions = [] as string[] } = {},
): Guideline[] {
  const hay = normalize([item.name, item.brand ?? "", ...item.ingredients].join(" "));

  // Hazard classes that layer 1 already fired on are non-negotiable: the model
  // must see the document behind every rule flag or it cannot cite it.
  const forcedIds = new Set(ruleMatches.flatMap((m) => m.guidelineIds));

  const scored = GUIDELINES.map((g) => {
    if (forcedIds.has(g.id)) return { g, score: Infinity };

    const words = KEYWORDS[g.id] ?? [];
    let score = words.reduce((n, w) => (hay.includes(normalize(w)) ? n + 1 : n), 0);

    // Gestational diabetes makes the GDM doc relevant even with no sugar
    // keyword hit, because the user's condition is the reason to surface it.
    if (g.hazardClass === "added-sugar-gdm" && conditions.includes("gestational-diabetes")) {
      score += 2;
    }

    return { g, score };
  });

  return scored
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_DOCS)
    .map((s) => s.g);
}

/** The documents block that goes into the prompt. */
export function formatGuidelinesForPrompt(guidelines: Guideline[]): string {
  if (guidelines.length === 0) return "(no guideline documents matched this food)";
  return guidelines
    .map((g) => `[${g.id}] ${g.authority} — ${g.title}\n${g.summary}`)
    .join("\n\n");
}
