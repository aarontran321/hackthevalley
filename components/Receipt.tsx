import type { CSSProperties } from "react";

import { LOW_CONFIDENCE_THRESHOLD, GEMINI_MODEL } from "@/lib/config";
import type { Severity, Verdict } from "@/lib/types";

/**
 * The verdict receipt — the reasoning chain made physical. Each line is one
 * inference, in order, with its source.
 *
 * Top and bottom edges are torn (a three-layer CSS mask, see globals.css), so
 * the strip has no top/bottom border: only the sides are drawn.
 */

type SeverityStyle = {
  text: string;
  /** Rules above/below the headline block. */
  rules: "both" | "top" | "none";
  /** Side borders — the only borders the tear leaves visible. */
  sides: string;
};

const SEVERITY_STYLES: Record<Severity, SeverityStyle> = {
  AVOID: { text: "text-avoid", rules: "both", sides: "border-rule" },
  CAUTION: { text: "text-caution", rules: "top", sides: "border-rule" },
  // Good news is calm — no rules, the quietest of the four.
  OK: { text: "text-safe", rules: "none", sides: "border-rule" },
  // Dashed, so uncertainty is legible before you've read a word.
  UNKNOWN: { text: "text-unknown", rules: "none", sides: "border-unknown border-dashed" },
};

/** Stagger index — each section arrives just behind the unrolling edge. */
function line(i: number): CSSProperties {
  return { "--i": i } as CSSProperties;
}

/** Deterministic bars from the code string — stable across server and client. */
function Barcode({ code }: { code: string }) {
  const digits = code.replace(/\D/g, "") || "0";
  const bars = Array.from({ length: 46 }, (_, i) => {
    const seed = digits.charCodeAt(i % digits.length) + i * 7;
    return (seed % 3) + 1;
  });

  return (
    <div className="flex items-end justify-between gap-4 px-5 py-4">
      <div aria-hidden className="flex h-6 items-stretch gap-[2px]">
        {bars.map((w, i) => (
          <span
            key={i}
            className="bg-ink"
            style={{ width: `${w}px`, opacity: w === 1 ? 0.75 : 1 }}
          />
        ))}
      </div>
      <span className="font-mono text-xs tracking-[0.18em] text-graphite">{digits}</span>
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="font-mono text-xs tracking-[0.16em] text-graphite">{children}</p>
  );
}

export function Receipt({
  verdict,
  week,
  barcode,
  resolveGuidelineUrl,
}: {
  verdict: Verdict;
  week: number;
  /** Scanned code, if there was one. The photo path has no barcode. */
  barcode?: string;
  resolveGuidelineUrl?: (id: string) => string | undefined;
}) {
  const style = SEVERITY_STYLES[verdict.severity];
  const trimester = week <= 13 ? 1 : week <= 27 ? 2 : 3;
  const lowConfidence = verdict.modelConfidence < LOW_CONFIDENCE_THRESHOLD;
  const hasNutrition = Object.keys(verdict.item.nutrition).length > 0;

  // "HARD FLAG" next to a caffeine caution overstates it. The tag exists to say
  // a deterministic rule fired, not the model — true at both severities, but
  // only AVOID has earned the harder word.
  const ruleTag =
    verdict.severity === "AVOID" ? "HARD FLAG · RULE-MATCHED" : "RULE-MATCHED";

  return (
    <article
      className={`receipt receipt-unroll mx-auto w-full max-w-[420px] border-x bg-white ${style.sides}`}
    >
      <div className="receipt-line" style={line(0)}>
        {barcode ? (
          <Barcode code={barcode} />
        ) : (
          // The photo path has nothing to render a barcode from; say so rather
          // than faking one, since the whole point is showing your working.
          <p className="px-5 py-4 font-mono text-xs tracking-[0.16em] text-graphite">
            IDENTIFIED FROM PHOTO
          </p>
        )}
      </div>

      <div className="receipt-line border-t border-rule px-5 py-4" style={line(1)}>
        <h2 className="font-display text-lg font-semibold uppercase tracking-tight">
          {verdict.item.name}
        </h2>
        {(verdict.item.brand || hasNutrition) && (
          <p className="font-mono text-xs text-graphite">
            {verdict.item.brand}
            {verdict.item.brand && hasNutrition ? " · " : ""}
            {/* Only claim a basis when there are numbers it applies to. */}
            {hasNutrition ? "per 100g" : ""}
          </p>
        )}
      </div>

      {/* Verdict headline. Severity is carried by the words, not only the color. */}
      <div
        className={`receipt-line px-5 py-4 ${
          style.rules === "both"
            ? "border-y-2 border-ink"
            : style.rules === "top"
              ? "border-t-2 border-ink"
              : "border-t border-rule"
        }`}
        style={line(2)}
      >
        <h1
          className={`font-display text-2xl font-bold uppercase leading-[1.05] tracking-tight ${style.text}`}
        >
          {verdict.headline}
        </h1>
        <p className="mt-1 font-mono text-xs tracking-[0.16em] text-graphite">
          WEEK {week} &middot; TRIMESTER {trimester}
        </p>
        {verdict.ruleTriggered && (
          <p className="mt-3 inline-block border border-ink px-2 py-1 font-mono text-xs font-medium tracking-[0.14em]">
            {ruleTag}
          </p>
        )}
        <p className="mt-3 text-sm leading-relaxed">{verdict.reasoning}</p>
      </div>

      {verdict.flags.length > 0 && (
        <div className="receipt-line border-t border-rule px-5 py-4" style={line(3)}>
          <SectionLabel>FLAGGED</SectionLabel>
          <ul className="mt-3 space-y-4">
            {verdict.flags.map((flag, i) => (
              <li key={i}>
                <div className="flex items-baseline gap-2">
                  <span className="font-mono text-sm">{flag.ingredient}</span>
                  <span aria-hidden className="leader" />
                  <span
                    className={`font-mono text-xs font-medium tracking-[0.14em] ${SEVERITY_STYLES[flag.severity].text}`}
                  >
                    {flag.severity}
                  </span>
                </div>
                <p className="mt-1 pl-3 text-sm text-graphite">{flag.plainReason}</p>
                <ul className="mt-1 pl-3">
                  {flag.guidelineIds.map((id) => {
                    const href = resolveGuidelineUrl?.(id);
                    return (
                      <li key={id} className="font-mono text-xs">
                        <span aria-hidden className="text-graphite">
                          &#8627;{" "}
                        </span>
                        {href ? (
                          <a
                            href={href}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="underline decoration-rule underline-offset-2 hover:decoration-ink"
                          >
                            {id}
                            {" ↗"}
                          </a>
                        ) : (
                          <span>{id}</span>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </li>
            ))}
          </ul>
        </div>
      )}

      {verdict.alternatives.length > 0 && (
        <div className="receipt-line border-t border-rule px-5 py-4" style={line(4)}>
          <SectionLabel>INSTEAD, TRY</SectionLabel>
          <ul className="mt-3 space-y-2">
            {verdict.alternatives.map((alt, i) => (
              <li key={i} className="flex gap-2 text-sm">
                <span aria-hidden className="text-graphite">
                  &rarr;
                </span>
                <span>
                  {alt.name}
                  <span className="text-graphite"> &mdash; {alt.why}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Ingredients are shown even when nothing applies — especially then. */}
      {verdict.severity === "UNKNOWN" && verdict.item.ingredients.length > 0 && (
        <div className="receipt-line border-t border-rule px-5 py-4" style={line(5)}>
          <SectionLabel>WHAT&rsquo;S IN IT</SectionLabel>
          <p className="mt-2 font-mono text-xs leading-relaxed text-graphite">
            {verdict.item.ingredients.join(", ")}
          </p>
        </div>
      )}

      <div className="receipt-line border-t border-rule px-5 py-4" style={line(6)}>
        <p
          className={`font-mono text-xs ${lowConfidence ? "text-caution" : "text-graphite"}`}
        >
          confidence {verdict.modelConfidence.toFixed(2)} &middot; {GEMINI_MODEL}
        </p>
        <p className="mt-1 font-mono text-xs text-graphite">
          not medical advice &mdash; ask your provider
        </p>
      </div>
    </article>
  );
}
