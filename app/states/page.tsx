import { notFound } from "next/navigation";

import { Receipt } from "@/components/Receipt";
import { DEMO_VERDICTS } from "@/lib/demo";
import { resolveGuidelineUrl } from "@/lib/guidelines";

/**
 * Dev-only gallery of every severity state. M5's stop condition is a judgment
 * about how these look next to each other, which is hard to make four clicks
 * apart in the real flow.
 */
export default function States() {
  if (process.env.NODE_ENV === "production") notFound();

  return (
    <div className="space-y-12 px-5 py-8">
      {Object.entries(DEMO_VERDICTS).map(([barcode, verdict]) => (
        <section key={barcode}>
          <p className="mx-auto mb-3 w-full max-w-[420px] font-mono text-xs tracking-[0.16em] text-graphite">
            {verdict.severity}
            {verdict.ruleTriggered ? " · rule-matched" : ""}
            {verdict.modelConfidence < 0.7 ? " · low confidence" : ""}
          </p>
          <Receipt
            verdict={verdict}
            week={22}
            barcode={barcode === "0000000000000" ? undefined : barcode}
            resolveGuidelineUrl={resolveGuidelineUrl}
          />
        </section>
      ))}
    </div>
  );
}
