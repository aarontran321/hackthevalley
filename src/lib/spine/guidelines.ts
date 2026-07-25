import guidance from "@/data/guidance.json";

import type { Guideline, HazardClass } from "./types";

/**
 * The grounding corpus, read from src/data/guidance.json — the same file the
 * analysis UI renders source cards from. One file, so the citations a user can
 * click can never drift from the ones the rules and validator know about.
 *
 * Hand-written from published FDA / NHS / ACOG / CDC guidance — deliberately
 * not model-generated, because grounding you generated with the model you're
 * grounding is not grounding.
 *
 * Every URL was verified to resolve on 2026-07-25. cdc.gov and acog.org return
 * 403 to scripted requests and were confirmed in a real browser instead.
 */
export const GUIDELINES: Guideline[] = guidance.map((g) => ({
  id: g.id,
  hazardClass: g.hazardClass as HazardClass,
  authority: g.organization,
  title: g.title,
  summary: g.summary,
  sourceUrl: g.url,
  keywords: g.applicableRisks,
}));

export const GUIDELINE_BY_ID: ReadonlyMap<string, Guideline> = new Map(
  GUIDELINES.map((g) => [g.id, g]),
);

/** The validator's core check: a cited ID that isn't here never reaches a user. */
export function isRealGuidelineId(id: string): boolean {
  return GUIDELINE_BY_ID.has(id);
}

export function resolveGuidelineUrl(id: string): string | undefined {
  return GUIDELINE_BY_ID.get(id)?.sourceUrl;
}
