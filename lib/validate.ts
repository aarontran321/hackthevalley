import { isRealGuidelineId } from "./guidelines";
import type { RuleMatch } from "./rules";
import { ruleSeverityFloor } from "./rules";
import type { FoodItem, Severity, Verdict, VerdictFlag } from "./types";

/**
 * Safety spine, layer 3. Everything the model returns passes through here
 * before a user ever sees it.
 *
 * The rule is fail-closed: anything suspect degrades to the deterministic
 * layer-1 verdict rather than being patched up. A wrong-but-plausible verdict
 * is more dangerous than an honest UNKNOWN, because the whole product promise
 * is that the reasoning can be checked.
 */

export type ValidationFailure =
  | "bad-schema"
  | "bad-severity"
  | "uncited-flag"
  | "unknown-guideline-id"
  | "severity-downgrade";

export type ValidationResult =
  | { ok: true; verdict: Verdict }
  | { ok: false; reason: ValidationFailure; detail: string };

const SEVERITIES: Severity[] = ["AVOID", "CAUTION", "OK", "UNKNOWN"];

/** OK and UNKNOWN both rank 0: neither is permitted to sit under a rule flag. */
function rank(s: Severity): number {
  return s === "AVOID" ? 2 : s === "CAUTION" ? 1 : 0;
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function asString(v: unknown): string | null {
  return typeof v === "string" && v.trim().length > 0 ? v.trim() : null;
}

export function validateVerdict(
  raw: unknown,
  ctx: { item: FoodItem; ruleMatches: RuleMatch[] },
): ValidationResult {
  if (!isRecord(raw)) {
    return { ok: false, reason: "bad-schema", detail: "response was not an object" };
  }

  const severity = asString(raw.severity) as Severity | null;
  if (!severity || !SEVERITIES.includes(severity)) {
    return {
      ok: false,
      reason: "bad-severity",
      detail: `severity was ${JSON.stringify(raw.severity)}`,
    };
  }

  const headline = asString(raw.headline);
  const reasoning = asString(raw.reasoning);
  if (!headline || !reasoning) {
    return { ok: false, reason: "bad-schema", detail: "missing headline or reasoning" };
  }

  // --- Flags: every one must cite at least one guideline that actually exists.
  const rawFlags = Array.isArray(raw.flags) ? raw.flags : [];
  const flags: VerdictFlag[] = [];

  for (const f of rawFlags) {
    if (!isRecord(f)) {
      return { ok: false, reason: "bad-schema", detail: "a flag was not an object" };
    }

    const ingredient = asString(f.ingredient);
    const plainReason = asString(f.plainReason);
    const flagSeverity = asString(f.severity) as Severity | null;

    if (!ingredient || !plainReason || !flagSeverity || !SEVERITIES.includes(flagSeverity)) {
      return { ok: false, reason: "bad-schema", detail: `malformed flag: ${ingredient ?? "?"}` };
    }

    const ids = Array.isArray(f.guidelineIds)
      ? f.guidelineIds.filter((i): i is string => typeof i === "string")
      : [];

    if (ids.length === 0) {
      return {
        ok: false,
        reason: "uncited-flag",
        detail: `flag "${ingredient}" cited no guideline`,
      };
    }

    // This is the check that matters most. A hallucinated ID looks exactly like
    // a real one to a user glancing at the receipt.
    const bogus = ids.filter((id) => !isRealGuidelineId(id));
    if (bogus.length > 0) {
      return {
        ok: false,
        reason: "unknown-guideline-id",
        detail: `flag "${ingredient}" cited ${bogus.join(", ")}, not in corpus`,
      };
    }

    flags.push({ ingredient, severity: flagSeverity, plainReason, guidelineIds: ids });
  }

  // --- A non-neutral verdict with nothing cited fails closed.
  if (rank(severity) > 0 && flags.length === 0) {
    return {
      ok: false,
      reason: "uncited-flag",
      detail: `${severity} verdict carried no flags`,
    };
  }

  // --- The model may raise severity. It may never lower it.
  const floor = ruleSeverityFloor(ctx.ruleMatches);
  if (floor && rank(severity) < rank(floor)) {
    return {
      ok: false,
      reason: "severity-downgrade",
      detail: `model returned ${severity} under a ${floor} rule flag`,
    };
  }

  const alternatives = (Array.isArray(raw.alternatives) ? raw.alternatives : [])
    .filter(isRecord)
    .map((a) => ({ name: asString(a.name), why: asString(a.why) }))
    .filter((a): a is { name: string; why: string } => !!a.name && !!a.why)
    .slice(0, 3);

  const confidence =
    typeof raw.modelConfidence === "number" && Number.isFinite(raw.modelConfidence)
      ? Math.min(1, Math.max(0, raw.modelConfidence))
      : 0.5;

  return {
    ok: true,
    verdict: {
      // Item comes from our data, never from the model — it must not be able to
      // rewrite the ingredient list its own verdict was judged against.
      item: ctx.item,
      severity,
      headline,
      reasoning,
      flags,
      alternatives,
      modelConfidence: confidence,
      ruleTriggered: ctx.ruleMatches.length > 0,
    },
  };
}

/**
 * Deterministic OK, for when we have a real ingredient list, no rule fired, and
 * retrieval surfaced no document that could even plausibly apply.
 *
 * This is distinct from UNKNOWN on purpose. UNKNOWN means "we can't tell what
 * this is"; this means "we can see exactly what it is and no hazard applies."
 * Collapsing the two would make the app return UNKNOWN for oats, which reads as
 * broken and teaches people to ignore the state that actually matters.
 *
 * Safe without a model call: it asserts the absence of a citation, not the
 * presence of one, so there is nothing for layer 3 to verify.
 */
export function noHazardVerdict(item: FoodItem): Verdict {
  return {
    item,
    severity: "OK",
    headline: "Nothing here to avoid",
    reasoning:
      "None of the pregnancy food-safety guidelines Tare checks against apply to these ingredients. That covers listeria, mercury, retinol, unpasteurized dairy, alcohol and caffeine — not general nutrition.",
    flags: [],
    alternatives: [],
    modelConfidence: 1,
    ruleTriggered: false,
  };
}

/**
 * Layer-1-only verdict, used whenever the model output is rejected or the call
 * fails. Deterministic, always citable, never guesses.
 */
export function fallbackVerdict(item: FoodItem, ruleMatches: RuleMatch[]): Verdict {
  const floor = ruleSeverityFloor(ruleMatches);

  if (!floor) {
    return {
      item,
      severity: "UNKNOWN",
      headline: "No specific pregnancy guidance found",
      reasoning:
        "Nothing in the guideline corpus applies to this item's ingredients, and the reasoning step didn't return a usable answer. The ingredients are listed below so you can check them yourself.",
      flags: [],
      alternatives: [],
      modelConfidence: 0,
      ruleTriggered: false,
    };
  }

  return {
    item,
    severity: floor,
    headline: floor === "AVOID" ? "Avoid this one" : "Worth a closer look",
    reasoning:
      floor === "AVOID"
        ? "A published guideline flags something in this item directly. The explanation step was unavailable, so this is the rule match on its own."
        : "A published guideline says this is worth watching. The explanation step was unavailable, so this is the rule match on its own.",
    flags: ruleMatches.map((m) => ({
      ingredient: m.ingredient,
      severity: m.severity,
      plainReason: m.plainReason,
      guidelineIds: m.guidelineIds,
    })),
    alternatives: [],
    modelConfidence: 0,
    ruleTriggered: true,
  };
}
