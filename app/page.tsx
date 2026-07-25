import { Receipt } from "@/components/Receipt";
import { DEMO_VERDICTS } from "@/lib/demo";
import { resolveGuidelineUrl } from "@/lib/guidelines";

/**
 * M2 scaffold view: the four severity states rendered from `?demo=1` seed data
 * with live citations. Replaced by the real setup -> scan -> verdict flow in M4;
 * until then this is how the receipt gets iterated without burning API calls.
 */
export default function Home() {
  return (
    <div className="space-y-10 px-5 py-8">
      {Object.entries(DEMO_VERDICTS).map(([barcode, verdict]) => (
        <section key={barcode}>
          <p className="mx-auto mb-2 w-full max-w-[420px] font-mono text-xs tracking-[0.16em] text-graphite">
            {verdict.severity}
            {verdict.ruleTriggered ? " · rule-matched" : ""}
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
