import { GUIDELINES } from "./guidelines";
import type { RuleMatch } from "./rules";
import type { FoodItem, Guideline } from "./types";

/**
 * Retrieval over the corpus: keyword + hazard-class matching, no vector store.
 * At this size exhaustive matching beats embedding retrieval and has no recall
 * failure mode — every document is compared every time.
 *
 * Keywords live on each source in guidance.json, so a source and the terms that
 * surface it cannot drift apart.
 */

function normalize(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

/**
 * Cap on how many documents go in the prompt. All of them would still fit, but
 * a tighter set measurably reduces the model reaching for a marginal citation.
 */
const MAX_DOCS = 6;

export function retrieveGuidelines(
  item: FoodItem,
  ruleMatches: RuleMatch[],
  { conditions = [] as string[] } = {},
): Guideline[] {
  const hay = normalize([item.name, item.brand ?? "", ...item.ingredients].join(" "));

  // Hazard classes layer 1 already fired on are non-negotiable: the model must
  // see the document behind every rule flag or it cannot cite it.
  const forcedIds = new Set(ruleMatches.flatMap((m) => m.guidelineIds));

  const scored = GUIDELINES.map((g) => {
    if (forcedIds.has(g.id)) return { g, score: Infinity };

    let score = g.keywords.reduce((n, w) => (hay.includes(normalize(w)) ? n + 1 : n), 0);

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
