"use client";

import guidance from "@/data/guidance.json";
import type { FoodAnalysis, SafetyStatus } from "@/types";

/**
 * The verdict receipt — the reasoning chain made physical.
 *
 * It carries only the decision and the evidence for it: what the item is, the
 * verdict, which characteristic triggered it, and which published source said
 * so. Explanation, alternatives, logging and follow-up all live outside it, so
 * the strip stays glanceable instead of becoming a second copy of the page.
 */

const HEADLINE: Record<SafetyStatus, string> = {
  generally_suitable: "Nothing here to avoid",
  use_caution: "Worth a closer look",
  consider_avoiding: "Avoid this one",
  insufficient_information: "Not enough to say",
};

const TONE: Record<SafetyStatus, string> = {
  generally_suitable: "v-suitable",
  use_caution: "v-caution",
  consider_avoiding: "v-avoid",
  insufficient_information: "v-unknown",
};

/** Rules above and below for avoid; a single rule above for caution; good news
 *  gets neither, because a calm result should look calm. */
function verdictFrame(status: SafetyStatus): string {
  if (status === "consider_avoiding") return "receipt-verdict";
  if (status === "use_caution") return "receipt-verdict is-soft";
  return "";
}

/** Deterministic bars from the code, so server and client agree. */
function Barcode({ code }: { code: string }) {
  const digits = code.replace(/\D/g, "") || "0";
  const bars = Array.from({ length: 42 }, (_, i) => {
    const seed = digits.charCodeAt(i % digits.length) + i * 7;
    return (seed % 3) + 1;
  });
  return (
    <div className="receipt-sec" style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 16 }}>
      <div className="barcode" aria-hidden>
        {bars.map((w, i) => (
          <span key={i} style={{ width: `${w}px`, opacity: w === 1 ? 0.75 : 1 }} />
        ))}
      </div>
      <span className="mono" style={{ fontSize: 11.5, letterSpacing: ".14em", color: "var(--muted)" }}>
        {digits}
      </span>
    </div>
  );
}

export function Receipt({
  analysis,
  pregnancyWeek,
  barcode,
}: {
  analysis: FoodAnalysis;
  pregnancyWeek: number;
  /** Only the barcode path has one; a photo or text search does not. */
  barcode?: string;
}) {
  const tone = TONE[analysis.status];
  const trimester = pregnancyWeek <= 13 ? 1 : pregnancyWeek <= 27 ? 2 : 3;
  const lowConfidence = analysis.confidence < 0.7;
  const sources = guidance.filter((s) => analysis.sourceIds.includes(s.id));

  return (
    <article
      className={`receipt receipt-unroll${analysis.status === "insufficient_information" ? " is-unknown" : ""}`}
      aria-label="Verdict receipt"
    >
      {barcode ? (
        <Barcode code={barcode} />
      ) : (
        <div className="receipt-sec">
          <span className="receipt-label">Identified from an image</span>
        </div>
      )}

      <div className="receipt-sec">
        <div className="receipt-item">{analysis.itemName}</div>
      </div>

      <div className={`receipt-sec ${verdictFrame(analysis.status)}`}>
        <h1 className={`receipt-headline ${tone}`}>{HEADLINE[analysis.status]}</h1>
        <p className="receipt-label" style={{ marginTop: 6 }}>
          Week {pregnancyWeek} · Trimester {trimester}
        </p>
        <p style={{ margin: "12px 0 0", fontFamily: "var(--font-body)", fontSize: 14, lineHeight: 1.55 }}>
          {analysis.summary}
        </p>
      </div>

      {analysis.flaggedIngredients.length > 0 && (
        <div className="receipt-sec">
          <span className="receipt-label">What triggered this</span>
          <ul style={{ listStyle: "none", margin: "12px 0 0", padding: 0, display: "grid", gap: 14 }}>
            {analysis.flaggedIngredients.map((f) => (
              <li key={f.ingredient}>
                <div className="receipt-row">
                  <span>{f.ingredient}</span>
                  <span className="leader" aria-hidden />
                  <span className={tone} style={{ fontSize: 11, letterSpacing: ".08em", textTransform: "uppercase", fontWeight: 600 }}>
                    flagged
                  </span>
                </div>
                <p style={{ margin: "4px 0 0", paddingLeft: 12, color: "var(--muted)", fontSize: 12.5, lineHeight: 1.5 }}>
                  {f.reason}
                </p>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="receipt-sec">
        <span className="receipt-label">Source</span>
        {sources.length > 0 ? (
          <ul style={{ listStyle: "none", margin: "10px 0 0", padding: 0, display: "grid", gap: 6 }}>
            {sources.map((s) => (
              <li key={s.id} className="receipt-cite">
                <span aria-hidden style={{ color: "var(--muted)" }}>↳ </span>
                <a
                  href={s.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`Open ${s.title} from ${s.organization}`}
                  title={s.url}
                >
                  {s.title} · {s.organization} ↗
                </a>
              </li>
            ))}
          </ul>
        ) : (
          <p className="receipt-cite" style={{ margin: "8px 0 0" }}>
            No supplied source supported a firm conclusion.
          </p>
        )}
      </div>

      <div className="receipt-sec">
        <p className="receipt-cite" style={{ margin: 0, color: lowConfidence ? "var(--v-caution)" : "var(--muted)" }}>
          confidence {analysis.confidence.toFixed(2)}
        </p>
        <p className="receipt-cite" style={{ margin: "2px 0 0" }}>
          not medical advice — check with your provider
        </p>
      </div>
    </article>
  );
}
