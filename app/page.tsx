import { Receipt } from "@/components/Receipt";
import type { Verdict } from "@/lib/types";

/**
 * M1 stop condition: a deployed URL shows a verdict from fake data.
 * This hardcoded object is replaced by /api/verdict in M3.
 */
const FIXTURE: Verdict = {
  item: {
    name: "Deli Turkey Breast",
    brand: "Hillshire Farm",
    ingredients: [
      "turkey breast",
      "water",
      "salt",
      "sodium phosphate",
      "sodium diacetate",
      "sodium erythorbate",
      "sodium nitrite",
    ],
    nutrition: { sodium_mg: 720, protein_g: 12, fat_g: 1.5, carbs_g: 2 },
  },
  severity: "AVOID",
  headline: "Avoid this one",
  reasoning:
    "Ready-to-eat deli meat can carry listeria, which crosses the placenta even when you feel fine. Heating it to steaming kills the bacteria. Cold from the package, it's not worth the risk.",
  flags: [
    {
      ingredient: "ready-to-eat deli meat",
      severity: "AVOID",
      plainReason: "Listeria risk unless heated until steaming hot.",
      guidelineIds: ["FDA-LISTERIA-2022"],
    },
  ],
  alternatives: [
    { name: "Rotisserie chicken, sliced warm", why: "same savory, served hot" },
    { name: "Canned salmon salad", why: "salty and cold-ready, fully cooked" },
    { name: "Aged hard cheese + crackers", why: "salt and bite, no soft cheese" },
  ],
  modelConfidence: 0.91,
  ruleTriggered: true,
};

export default function Home() {
  return (
    <div className="px-5 py-8">
      <Receipt verdict={FIXTURE} week={22} />
    </div>
  );
}
