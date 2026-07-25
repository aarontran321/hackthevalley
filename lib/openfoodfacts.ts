import type { FoodItem } from "./types";

/**
 * Open Food Facts lookup. Free, no key, but community-maintained — coverage is
 * patchy for US products and ingredient lists are sometimes empty. An empty
 * ingredient list is a real outcome, not an error: it routes to UNKNOWN rather
 * than to a guess.
 */

const OFF_ENDPOINT = "https://world.openfoodfacts.org/api/v2/product";

// OFF asks clients to identify themselves.
const USER_AGENT = "Tare/0.1 (pregnancy food safety; hackathon project)";

const FIELDS = [
  "product_name",
  "product_name_en",
  "brands",
  "quantity",
  "ingredients_text",
  "ingredients_text_en",
  "ingredients",
  "nutriments",
  "categories_tags",
].join(",");

export type LookupResult =
  | { ok: true; item: FoodItem }
  | { ok: false; reason: "not-found" | "network" | "timeout" };

interface OffIngredient {
  text?: string;
}

interface OffProduct {
  product_name?: string;
  product_name_en?: string;
  brands?: string;
  quantity?: string;
  ingredients_text?: string;
  ingredients_text_en?: string;
  ingredients?: OffIngredient[];
  nutriments?: Record<string, unknown>;
  categories_tags?: string[];
}

/** Nutrient keys worth showing on a receipt. OFF exposes dozens; these are the ones people read. */
const NUTRIENT_KEYS: Record<string, string> = {
  "energy-kcal_100g": "energy_kcal",
  proteins_100g: "protein_g",
  fat_100g: "fat_g",
  "saturated-fat_100g": "saturated_fat_g",
  carbohydrates_100g: "carbs_g",
  sugars_100g: "sugars_g",
  fiber_100g: "fiber_g",
  salt_100g: "salt_g",
  sodium_100g: "sodium_g",
  caffeine_100g: "caffeine_g",
};

function pickNutrition(n: Record<string, unknown> | undefined): Record<string, number> {
  if (!n) return {};
  const out: Record<string, number> = {};
  for (const [offKey, ourKey] of Object.entries(NUTRIENT_KEYS)) {
    const v = n[offKey];
    if (typeof v === "number" && Number.isFinite(v)) out[ourKey] = v;
  }
  return out;
}

function parseIngredients(p: OffProduct): string[] {
  // The structured array is cleaner when present.
  if (Array.isArray(p.ingredients) && p.ingredients.length > 0) {
    const fromArray = p.ingredients
      .map((i) => (i.text ?? "").trim())
      .filter(Boolean);
    if (fromArray.length > 0) return fromArray;
  }

  const text = (p.ingredients_text_en || p.ingredients_text || "").trim();
  if (!text) return [];

  return text
    .split(/[,;]|\s•\s/)
    .map((s) =>
      s
        .replace(/[.*_]/g, "")
        .replace(/\([^)]*\)/g, " ")
        .replace(/\s+/g, " ")
        .trim(),
    )
    .filter((s) => s.length > 1);
}

export function toFoodItem(p: OffProduct, barcode: string): FoodItem {
  const name =
    (p.product_name_en || p.product_name || "").trim() || `Unknown product ${barcode}`;
  const brand = (p.brands || "").split(",")[0]?.trim() || undefined;

  return {
    name,
    brand,
    ingredients: parseIngredients(p),
    nutrition: pickNutrition(p.nutriments),
  };
}

export async function lookupBarcode(
  barcode: string,
  { timeoutMs = 6000 }: { timeoutMs?: number } = {},
): Promise<LookupResult> {
  const clean = barcode.replace(/\D/g, "");
  if (!clean) return { ok: false, reason: "not-found" };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(`${OFF_ENDPOINT}/${clean}.json?fields=${FIELDS}`, {
      signal: controller.signal,
      headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
      cache: "no-store",
    });

    if (res.status === 404) return { ok: false, reason: "not-found" };
    if (!res.ok) return { ok: false, reason: "network" };

    const body = (await res.json()) as { status?: number; product?: OffProduct };
    if (body.status !== 1 || !body.product) return { ok: false, reason: "not-found" };

    return { ok: true, item: toFoodItem(body.product, clean) };
  } catch (err) {
    const aborted = err instanceof Error && err.name === "AbortError";
    return { ok: false, reason: aborted ? "timeout" : "network" };
  } finally {
    clearTimeout(timer);
  }
}
