import { NextResponse } from "next/server";

import { enforceSpine, toFoodItem } from "@/lib/spine/analysis";
import { GUIDELINES, isRealGuidelineId } from "@/lib/spine/guidelines";
import { runRules, ruleSeverityFloor } from "@/lib/spine/rules";
import type { Trimester } from "@/lib/spine/types";
import type { FoodAnalysis } from "@/types";

/**
 * Development-only harness for the safety spine. Not part of the shipped API;
 * 404s in production.
 *
 *   GET  /api/scratch?corpus                       corpus self-check
 *   GET  /api/scratch?name=Brie&ingredients=milk   layer 1 rule match
 *   POST /api/scratch  { raw, item }               layer 3 validation
 */

function notInProd() {
  return process.env.NODE_ENV === "production"
    ? new NextResponse("Not found", { status: 404 })
    : null;
}

export async function GET(request: Request) {
  const blocked = notInProd();
  if (blocked) return blocked;

  const params = new URL(request.url).searchParams;

  if (params.get("corpus") !== null) {
    return NextResponse.json({
      count: GUIDELINES.length,
      allIdsResolve: GUIDELINES.every((g) => isRealGuidelineId(g.id)),
      hazardClasses: [...new Set(GUIDELINES.map((g) => g.hazardClass))].sort(),
      overLongSummaries: GUIDELINES.filter((g) => g.summary.split(/\s+/).length > 60).map((g) => g.id),
      entries: GUIDELINES.map((g) => ({ id: g.id, hazardClass: g.hazardClass, url: g.sourceUrl })),
    });
  }

  const conditions = (params.get("conditions") ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const trimester = (Number(params.get("trimester") ?? 2) || 2) as Trimester;

  const item = toFoodItem({
    name: params.get("name") ?? "",
    ingredients: params.get("ingredients") ?? "",
  });
  const matches = runRules(item, { trimester, conditions });

  return NextResponse.json({
    item,
    ruleFloor: ruleSeverityFloor(matches),
    ruleTriggered: matches.length > 0,
    matches,
  });
}

export async function POST(request: Request) {
  const blocked = notInProd();
  if (blocked) return blocked;

  const body = (await request.json()) as {
    raw?: Partial<FoodAnalysis>;
    item?: { name?: string; ingredients?: string };
  };

  const item = toFoodItem(
    body.item ?? { name: "Deli Turkey Breast", ingredients: "turkey breast, water, salt" },
  );
  const matches = runRules(item, { trimester: 2, conditions: [] });
  const result = enforceSpine((body.raw ?? {}) as FoodAnalysis, matches);

  return NextResponse.json({
    ruleFloor: ruleSeverityFloor(matches),
    accepted: result.ok,
    reason: result.ok ? null : result.reason,
    detail: result.ok ? null : result.detail,
  });
}
