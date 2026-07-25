import { NextResponse } from "next/server";

import { GUIDELINES, isRealGuidelineId } from "@/lib/guidelines";
import { lookupBarcode } from "@/lib/openfoodfacts";
import { runRules, ruleSeverityFloor } from "@/lib/rules";
import type { Trimester } from "@/lib/types";

/**
 * Development-only scratch endpoint for M2's stop condition: prove that a real
 * barcode yields real ingredients, and that the rule matcher hard-flags deli
 * meat. Not part of the three shipped routes; 404s in production.
 *
 *   GET /api/scratch?barcode=0044700005507
 *   GET /api/scratch?name=deli%20turkey%20breast&ingredients=turkey,salt
 */
export async function GET(request: Request) {
  if (process.env.NODE_ENV === "production") {
    return new NextResponse("Not found", { status: 404 });
  }

  const params = new URL(request.url).searchParams;
  const barcode = params.get("barcode");
  const name = params.get("name");
  const conditions = (params.get("conditions") ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const trimester = (Number(params.get("trimester") ?? 2) || 2) as Trimester;

  // Corpus self-check: every guideline resolves and cites a real URL.
  if (params.get("corpus") !== null) {
    return NextResponse.json({
      count: GUIDELINES.length,
      allIdsResolve: GUIDELINES.every((g) => isRealGuidelineId(g.id)),
      hazardClasses: [...new Set(GUIDELINES.map((g) => g.hazardClass))].sort(),
      entries: GUIDELINES.map((g) => ({
        id: g.id,
        hazardClass: g.hazardClass,
        authority: g.authority,
        words: g.summary.split(/\s+/).length,
        sourceUrl: g.sourceUrl,
      })),
    });
  }

  const item = barcode
    ? await lookupBarcode(barcode)
    : ({
        ok: true as const,
        item: {
          name: name ?? "",
          ingredients: (params.get("ingredients") ?? "")
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean),
          nutrition: {},
        },
      } satisfies { ok: true; item: Parameters<typeof runRules>[0] });

  if (!item.ok) {
    return NextResponse.json({ error: item.reason, barcode }, { status: 404 });
  }

  const matches = runRules(item.item, { trimester, conditions });

  return NextResponse.json({
    item: item.item,
    ingredientCount: item.item.ingredients.length,
    ruleFloor: ruleSeverityFloor(matches),
    ruleTriggered: matches.length > 0,
    matches,
  });
}
