import { Type, type Schema } from "@google/genai";

import { formatGuidelinesForPrompt } from "./retrieval";
import type { RuleMatch } from "./rules";
import { ruleSeverityFloor } from "./rules";
import type { FoodItem, Guideline, Trimester } from "./types";

const SEVERITY_VALUES = ["AVOID", "CAUTION", "OK", "UNKNOWN"];

/**
 * Mirrors Verdict, minus `item` and `ruleTriggered`. Both of those are ours to
 * set: the model must not be able to restate the ingredient list its own
 * verdict gets judged against, or to claim a rule fired when none did.
 */
export const VERDICT_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    severity: { type: Type.STRING, enum: SEVERITY_VALUES },
    headline: { type: Type.STRING, description: "8 words or fewer" },
    reasoning: { type: Type.STRING, description: "2-3 plain sentences" },
    flags: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          ingredient: { type: Type.STRING },
          severity: { type: Type.STRING, enum: SEVERITY_VALUES },
          plainReason: { type: Type.STRING, description: "20 words or fewer, no jargon" },
          guidelineIds: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: "IDs from the provided documents only. Never invent one.",
          },
        },
        required: ["ingredient", "severity", "plainReason", "guidelineIds"],
      },
    },
    alternatives: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          name: { type: Type.STRING },
          why: { type: Type.STRING, description: "why it scratches the same itch" },
        },
        required: ["name", "why"],
      },
    },
    modelConfidence: { type: Type.NUMBER, description: "0 to 1" },
  },
  required: ["severity", "headline", "reasoning", "flags", "alternatives", "modelConfidence"],
};

export const VERDICT_SYSTEM_INSTRUCTION = `
You are the reasoning layer of a pregnancy food-safety tool. You do not make
safety determinations from your own knowledge. You are given authoritative
guideline documents plus a food's ingredients and nutrition, and your job is to
determine which guidelines apply and explain it in plain language someone can
read in five seconds while standing in a grocery aisle.

- Every flag must cite at least one guideline ID from the provided documents. If
  no provided guideline applies, do not flag it.
- If a deterministic pre-check assigned a severity, you may raise it but never
  lower it.
- If ingredients are empty or unmappable, return UNKNOWN. UNKNOWN is correct
  behavior, not failure.
- Alternatives must match the *craving* — flavor, salt, texture, temperature —
  not the nutrition panel. Someone who wants deli meat wants something savory
  and salty, not a lecture about protein.
- No jargon, no hedging, no dosages, no diagnoses, no medical advice.
`.trim();

export function buildVerdictPrompt({
  item,
  trimester,
  week,
  conditions,
  guidelines,
  ruleMatches,
}: {
  item: FoodItem;
  trimester: Trimester;
  week?: number;
  conditions: string[];
  guidelines: Guideline[];
  ruleMatches: RuleMatch[];
}): string {
  const floor = ruleSeverityFloor(ruleMatches);

  const preCheck = floor
    ? `A deterministic pre-check assigned severity ${floor}. You may raise this, never lower it.\n` +
      ruleMatches
        .map((m) => `- ${m.ingredient} -> ${m.severity} (${m.guidelineIds.join(", ")})`)
        .join("\n")
    : "The deterministic pre-check found no high-stakes hazard. That is not the same as the food being safe — decide from the documents.";

  return [
    `GUIDELINE DOCUMENTS (the only sources you may cite):`,
    formatGuidelinesForPrompt(guidelines),
    ``,
    `PRE-CHECK RESULT:`,
    preCheck,
    ``,
    `READER:`,
    `Pregnant, ${week ? `week ${week}, ` : ""}trimester ${trimester}.`,
    conditions.length > 0 ? `Conditions: ${conditions.join(", ")}.` : `No listed conditions.`,
    ``,
    `FOOD:`,
    `Name: ${item.name}`,
    // Spread rather than a ternary to "": an empty string here is a blank-line
    // separator everywhere else in this array, and filtering would eat both.
    ...(item.brand ? [`Brand: ${item.brand}`] : []),
    `Ingredients: ${item.ingredients.length > 0 ? item.ingredients.join(", ") : "(none listed)"}`,
    `Nutrition per 100g: ${
      Object.keys(item.nutrition).length > 0
        ? Object.entries(item.nutrition)
            .map(([k, v]) => `${k}=${v}`)
            .join(", ")
        : "(not available)"
    }`,
  ].join("\n");
}
