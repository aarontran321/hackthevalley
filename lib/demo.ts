import type { Verdict } from "./types";

/**
 * `?demo=1` seed data. Cached verdicts for known barcodes so the app is fully
 * explorable with no network and no API quota — and so the receipt can be
 * iterated without burning a Gemini call on every hot reload.
 *
 * The first three barcodes are real and were verified against Open Food Facts,
 * so demo mode and live mode show the same products. The fourth is synthetic:
 * the spec asks for three, but UNKNOWN is a designed state with its own dashed
 * treatment, and M5 can't be finished without a way to look at it.
 */

export const DEMO_AVOID: Verdict = {
  item: {
    name: "Pechuga de Pavo",
    brand: "Hacendado",
    ingredients: [
      "pechuga de pavo",
      "agua",
      "cloruro sódico",
      "jarabe de glucosa",
      "estabilizantes",
      "aroma",
      "antioxidante",
    ],
    nutrition: { protein_g: 17.5, fat_g: 1.2, salt_g: 2.1, carbs_g: 1.5 },
  },
  severity: "AVOID",
  headline: "Avoid this one",
  reasoning:
    "This is sliced ready-to-eat turkey, which is deli meat regardless of the label language. Listeria grows in the fridge and crosses the placenta even when you feel fine. Heated until steaming it's safe — cold from the pack it isn't.",
  flags: [
    {
      ingredient: "pechuga de pavo (deli turkey)",
      severity: "AVOID",
      plainReason: "Ready-to-eat deli meat: listeria risk unless heated until steaming.",
      guidelineIds: ["FDA-DELI-RTE-2022", "FDA-LISTERIA-2022"],
    },
  ],
  alternatives: [
    { name: "Rotisserie chicken, sliced warm", why: "same savory pull, served hot" },
    { name: "Canned salmon with lemon and salt", why: "salty, cold-ready, fully cooked" },
    { name: "Manchego and crackers", why: "hard cheese, salt and bite" },
  ],
  modelConfidence: 0.93,
  ruleTriggered: true,
};

export const DEMO_CAUTION: Verdict = {
  item: {
    name: "Coca-Cola",
    brand: "Coca-Cola",
    ingredients: [
      "carbonated water",
      "sugar",
      "colour",
      "acid",
      "natural flavourings",
      "caffeine",
    ],
    nutrition: { energy_kcal: 42, sugars_g: 10.6, carbs_g: 10.6 },
  },
  severity: "CAUTION",
  headline: "Fine, but it counts",
  reasoning:
    "A 330ml can has roughly 32 mg of caffeine. That's well inside the day's guideline on its own, but it stacks with coffee and tea. Worth tracking rather than avoiding.",
  flags: [
    {
      ingredient: "caffeine",
      severity: "CAUTION",
      plainReason: "Counts toward the 200 mg daily caffeine ceiling ACOG describes.",
      guidelineIds: ["ACOG-CAFFEINE-2010"],
    },
  ],
  alternatives: [
    { name: "Sparkling water with lime and salt", why: "same fizz and bite, no caffeine" },
    { name: "Cold rooibos, brewed strong", why: "dark and tannic, naturally caffeine-free" },
    { name: "Decaf cola", why: "the exact craving, minus the ceiling" },
  ],
  modelConfidence: 0.88,
  ruleTriggered: true,
};

export const DEMO_OK: Verdict = {
  item: {
    name: "Nutella",
    brand: "Ferrero",
    ingredients: [
      "sucre",
      "huile de palme",
      "noisettes",
      "cacao maigre",
      "lait écrémé en poudre",
      "lactosérum en poudre",
      "émulsifiant: lécithines",
      "vanilline",
    ],
    nutrition: { energy_kcal: 539, sugars_g: 56.3, fat_g: 30.9, protein_g: 6.3 },
  },
  severity: "OK",
  headline: "Nothing here to avoid",
  reasoning:
    "The dairy is pasteurised powder and there's no pregnancy hazard in this ingredient list. It's very high in sugar, which is a general nutrition question rather than a pregnancy-safety one.",
  flags: [],
  alternatives: [],
  modelConfidence: 0.9,
  ruleTriggered: false,
};

export const DEMO_UNKNOWN: Verdict = {
  item: {
    name: "Bakery Item (unlabelled)",
    ingredients: ["wheat flour", "water", "yeast", "salt"],
    nutrition: {},
  },
  severity: "UNKNOWN",
  headline: "No guidance found for this",
  reasoning:
    "Nothing in the guideline corpus applies to what's listed here, and the ingredient list is too short to be confident it's complete. The ingredients are shown below so you can check them yourself.",
  flags: [],
  alternatives: [],
  modelConfidence: 0.34,
  ruleTriggered: false,
};

/** Barcode → cached verdict. Demo mode resolves from here and never hits the network. */
export const DEMO_VERDICTS: Record<string, Verdict> = {
  "8480000057105": DEMO_AVOID,
  "5449000000996": DEMO_CAUTION,
  "3017620422003": DEMO_OK,
  "0000000000000": DEMO_UNKNOWN,
};

export const DEMO_BARCODES = Object.keys(DEMO_VERDICTS);

export function getDemoVerdict(barcode: string): Verdict | undefined {
  return DEMO_VERDICTS[barcode.replace(/\D/g, "")];
}

/** Demo mode is on when ?demo=1 is present. Read once, then carried in state. */
export function isDemoMode(search: string | URLSearchParams): boolean {
  const params =
    typeof search === "string" ? new URLSearchParams(search) : search;
  return params.get("demo") === "1";
}
