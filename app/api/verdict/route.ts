import { NextResponse } from "next/server";

import { GeminiError, generateJson, hasApiKey } from "@/lib/gemini";
import { lookupBarcode } from "@/lib/openfoodfacts";
import { retrieveGuidelines } from "@/lib/retrieval";
import { runRules } from "@/lib/rules";
import type { FoodItem, Trimester } from "@/lib/types";
import { fallbackVerdict, noHazardVerdict, validateVerdict } from "@/lib/validate";
import {
  buildVerdictPrompt,
  VERDICT_SCHEMA,
  VERDICT_SYSTEM_INSTRUCTION,
} from "@/lib/verdict-prompt";

/**
 * POST /api/verdict — the safety spine, end to end.
 *
 *   1 RULES     deterministic matchers set a severity floor
 *   2 GEMINI    explains which retrieved guidelines apply
 *   3 VALIDATE  rejects fake citations and any downgrade; on failure the
 *               layer-1 verdict is returned instead
 *
 * Never 500s on a model problem. A degraded but honest verdict beats an error
 * screen when someone is standing in an aisle holding a jar.
 */

interface VerdictRequest {
  /** Either a barcode to look up, or an already-resolved item (photo path). */
  barcode?: string;
  item?: FoodItem;
  trimester?: number;
  week?: number;
  conditions?: string[];
}

function badRequest(detail: string) {
  return NextResponse.json({ error: "bad-request", detail }, { status: 400 });
}

export async function POST(request: Request) {
  let body: VerdictRequest;
  try {
    body = (await request.json()) as VerdictRequest;
  } catch {
    return badRequest("body was not valid JSON");
  }

  // Resolving the barcode here rather than in a fourth route: one round trip
  // from the aisle, and the spec's route budget stays at three.
  let item = body.item;
  if (!item && typeof body.barcode === "string") {
    const found = await lookupBarcode(body.barcode);
    if (!found.ok) {
      return NextResponse.json(
        { error: "product-not-found", reason: found.reason, barcode: body.barcode },
        { status: 404 },
      );
    }
    item = found.item;
  }

  if (!item || typeof item.name !== "string" || !Array.isArray(item.ingredients)) {
    return badRequest("provide either a barcode or an item with name and ingredients");
  }

  const trimester = ([1, 2, 3].includes(Number(body.trimester))
    ? Number(body.trimester)
    : 2) as Trimester;
  const conditions = Array.isArray(body.conditions) ? body.conditions : [];
  const normalizedItem: FoodItem = {
    name: item.name,
    brand: item.brand,
    ingredients: item.ingredients.filter((i) => typeof i === "string"),
    nutrition: item.nutrition ?? {},
  };

  // --- Layer 1
  const ruleMatches = runRules(normalizedItem, { trimester, conditions });
  const guidelines = retrieveGuidelines(normalizedItem, ruleMatches, { conditions });

  // Nothing retrieved and no rule fired: there is no hazard document that could
  // apply, so answer deterministically rather than inviting the model to reach
  // for a marginal citation.
  if (guidelines.length === 0 && ruleMatches.length === 0) {
    return NextResponse.json({
      verdict:
        normalizedItem.ingredients.length > 0
          ? noHazardVerdict(normalizedItem)
          : fallbackVerdict(normalizedItem, ruleMatches),
      degraded: false,
      citedGuidelines: [],
    });
  }

  // No key configured: skip layer 2 rather than let the model reason from its
  // own memory.
  if (!hasApiKey() || guidelines.length === 0) {
    return NextResponse.json({
      verdict: fallbackVerdict(normalizedItem, ruleMatches),
      degraded: true,
      degradedReason: !hasApiKey() ? "no-key" : "no-guidelines-retrieved",
    });
  }

  // Dev-only dry run: see exactly what layer 2 would be sent, without spending
  // a call on it.
  if (process.env.NODE_ENV !== "production" && new URL(request.url).searchParams.has("dry")) {
    const prompt = buildVerdictPrompt({
      item: normalizedItem,
      trimester,
      week: body.week,
      conditions,
      guidelines,
      ruleMatches,
    });
    return NextResponse.json({
      retrieved: guidelines.map((g) => g.id),
      ruleMatches: ruleMatches.map((m) => `${m.ingredient} -> ${m.severity}`),
      promptChars: prompt.length,
      prompt,
    });
  }

  // --- Layer 2
  let raw: unknown;
  try {
    raw = await generateJson({
      systemInstruction: VERDICT_SYSTEM_INSTRUCTION,
      prompt: buildVerdictPrompt({
        item: normalizedItem,
        trimester,
        week: body.week,
        conditions,
        guidelines,
        ruleMatches,
      }),
      schema: VERDICT_SCHEMA,
    });
  } catch (err) {
    const kind = err instanceof GeminiError ? err.kind : "network";
    const detail = err instanceof Error ? err.message : String(err);
    console.warn(`[verdict] model call failed: ${kind} — ${detail.slice(0, 300)}`);
    return NextResponse.json({
      verdict: fallbackVerdict(normalizedItem, ruleMatches),
      degraded: true,
      degradedReason: kind,
      // Never leak provider internals to a client in production.
      ...(process.env.NODE_ENV !== "production" ? { degradedDetail: detail } : {}),
    });
  }

  // --- Layer 3
  const result = validateVerdict(raw, { item: normalizedItem, ruleMatches });

  if (!result.ok) {
    console.warn(`[verdict] rejected model output: ${result.reason} — ${result.detail}`);
    return NextResponse.json({
      verdict: fallbackVerdict(normalizedItem, ruleMatches),
      degraded: true,
      degradedReason: result.reason,
      degradedDetail: result.detail,
    });
  }

  return NextResponse.json({
    verdict: result.verdict,
    degraded: false,
    citedGuidelines: guidelines.map((g) => g.id),
  });
}
