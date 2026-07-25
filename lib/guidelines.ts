import type { Guideline } from "./types";

/**
 * The grounding corpus. Hand-written from published FDA / NHS / ACOG / CDC
 * guidance — deliberately NOT model-generated, because grounding you generated
 * with the model you're grounding is not grounding.
 *
 * Every sourceUrl below was verified to resolve on 2026-07-25. Note that
 * cdc.gov and acog.org return 403/402 to scripted requests; both were confirmed
 * in a real browser instead. FDA and NHS return 200 to curl directly.
 *
 * The `summary` field is the retrievable body — it is what gets put in front of
 * the model. Keep each one <=60 words and close to the source's own wording.
 */
export const GUIDELINES: Guideline[] = [
  {
    id: "FDA-MERCURY-2021",
    hazardClass: "mercury",
    authority: "FDA",
    title: "Fish to avoid during pregnancy",
    summary:
      "Highest-mercury species — shark, swordfish, king mackerel, tilefish, " +
      "bigeye tuna, marlin, orange roughy — are in the Choices to Avoid " +
      "category and should not be eaten in pregnancy. Best Choices fish remain " +
      "recommended at 2–3 servings weekly, four ounces per serving.",
    sourceUrl: "https://www.fda.gov/food/consumers/advice-about-eating-fish",
  },
  {
    id: "FDA-LISTERIA-2022",
    hazardClass: "listeria",
    authority: "FDA",
    title: "Listeria risk in pregnancy",
    summary:
      "Pregnant people are about ten times more likely to get listeriosis. " +
      "Listeria monocytogenes grows at refrigerator temperatures in " +
      "ready-to-eat foods. Infection can cause miscarriage, stillbirth, " +
      "premature delivery, or death of the newborn, even when the pregnant " +
      "person feels only mildly ill.",
    sourceUrl:
      "https://www.fda.gov/food/health-educators/listeria-food-safety-moms-be",
  },
  {
    id: "FDA-DELI-RTE-2022",
    hazardClass: "listeria",
    authority: "FDA",
    title: "Deli meat and ready-to-eat foods",
    summary:
      "Hot dogs, deli meats, and luncheon meats should not be eaten unless " +
      "reheated until steaming hot. Contamination can occur after the food is " +
      "cooked at the factory but before it is packaged. Refrigerated smoked " +
      "seafood is also unsafe unless cooked into a dish such as a casserole.",
    sourceUrl:
      "https://www.fda.gov/food/people-risk-foodborne-illness/ready-eat-foods-food-safety-moms-be",
  },
  {
    id: "FDA-RAWMILK-2024",
    hazardClass: "unpasteurized",
    authority: "FDA",
    title: "Raw and unpasteurized milk",
    summary:
      "FDA advises pregnant people not to drink raw (unpasteurized) milk or " +
      "eat foods made from it. Raw milk can carry Listeria, Salmonella, " +
      "E. coli, and Campylobacter. Drinking it can harm the baby even if the " +
      "pregnant person does not feel sick.",
    sourceUrl:
      "https://www.fda.gov/food/buy-store-serve-safe-food/dangers-raw-milk-unpasteurized-milk-can-pose-serious-health-risk",
  },
  {
    id: "NHS-SOFTCHEESE-2023",
    hazardClass: "unpasteurized",
    authority: "NHS",
    title: "Soft mould-ripened and blue cheeses",
    summary:
      "Mould-ripened soft cheeses with a white coating — brie, camembert, " +
      "chèvre — and soft blue cheeses must be thoroughly cooked before eating, " +
      "whether pasteurised or not, because they may contain listeria. Hard " +
      "cheeses and pasteurised cottage cheese, cream cheese and mozzarella are fine.",
    sourceUrl: "https://www.nhs.uk/pregnancy/keeping-well/foods-to-avoid/",
  },
  {
    id: "NHS-VITAMINA-2023",
    hazardClass: "retinol",
    authority: "NHS",
    title: "Liver, pâté and vitamin A",
    summary:
      "Liver and foods containing liver, such as pâté and liver sausage, have " +
      "high levels of vitamin A (retinol), which can be harmful to the baby. " +
      "Avoid them, along with high-dose vitamin A supplements. All types of " +
      "pâté, including vegetable pâté, can also contain listeria.",
    sourceUrl: "https://www.nhs.uk/pregnancy/keeping-well/foods-to-avoid/",
  },
  {
    id: "NHS-RAWANIMAL-2023",
    hazardClass: "raw-animal-product",
    authority: "NHS",
    title: "Raw and undercooked meat and eggs",
    summary:
      "Raw or undercooked meat carries a toxoplasmosis risk and should be " +
      "avoided; cook meat thoroughly. Hen eggs without a British Lion stamp, " +
      "and eggs from other birds, should not be eaten raw or partially cooked " +
      "— cook until the white and yolk are solid.",
    sourceUrl: "https://www.nhs.uk/pregnancy/keeping-well/foods-to-avoid/",
  },
  {
    id: "FDA-SPROUTS-2023",
    hazardClass: "listeria",
    authority: "FDA",
    title: "Raw sprouts",
    summary:
      "People more vulnerable to foodborne illness should avoid raw or lightly " +
      "cooked sprouts of any kind, including alfalfa, clover, radish, onion " +
      "and mung bean. Bacteria can enter the seed through cracks in the shell " +
      "and are nearly impossible to wash out. Cook sprouts thoroughly.",
    sourceUrl:
      "https://www.fda.gov/food/buy-store-serve-safe-food/selecting-and-serving-produce-safely",
  },
  {
    id: "CDC-ALCOHOL-2026",
    hazardClass: "alcohol",
    authority: "CDC",
    title: "Alcohol use during pregnancy",
    summary:
      "There is no known safe amount of alcohol use during pregnancy, and no " +
      "safe time during pregnancy to drink. All types of alcohol can be " +
      "harmful, including red or white wine, beer, and liquor. Use is " +
      "associated with miscarriage, preterm birth, stillbirth, and fetal " +
      "alcohol spectrum disorders.",
    sourceUrl: "https://www.cdc.gov/alcohol-pregnancy/about/index.html",
  },
  {
    id: "ACOG-CAFFEINE-2010",
    hazardClass: "caffeine",
    authority: "ACOG",
    title: "Moderate caffeine consumption",
    summary:
      "Experts recommend no more than 200 mg of caffeine a day during " +
      "pregnancy, about one 12-ounce cup of coffee. Moderate consumption below " +
      "that level does not appear to be a major contributing factor in " +
      "miscarriage or preterm birth. Caffeine from all sources counts, " +
      "including tea, cola and chocolate.",
    sourceUrl:
      "https://www.acog.org/womens-health/experts-and-stories/ask-acog/how-much-coffee-can-i-drink-while-pregnant",
  },
  {
    id: "NHS-GDM-2023",
    hazardClass: "added-sugar-gdm",
    authority: "NHS",
    title: "Diet with gestational diabetes",
    summary:
      "Gestational diabetes causes high blood sugar during pregnancy. NHS " +
      "guidance is that blood sugar levels may be reduced by changing your " +
      "diet and being more active. People diagnosed with it are referred for " +
      "dietary advice and given blood-sugar targets to monitor against.",
    sourceUrl: "https://www.nhs.uk/conditions/gestational-diabetes/",
  },
  {
    // hazardClass 'none': folate is a positive recommendation, not a hazard, so
    // this entry can never produce a flag. It exists so the chat layer can
    // retrieve and cite it when asked what to eat rather than what to avoid.
    id: "CDC-FOLATE-2026",
    hazardClass: "none",
    authority: "CDC",
    title: "Folic acid and neural tube defects",
    summary:
      "All people capable of becoming pregnant should get 400 micrograms of " +
      "folic acid daily to help prevent neural tube defects — severe birth " +
      "defects of the brain and spine. These defects form in the first few " +
      "weeks of pregnancy, often before pregnancy is known.",
    sourceUrl: "https://www.cdc.gov/folic-acid/about/index.html",
  },
];

/** Fast lookup used by the validator to reject IDs that aren't in the corpus. */
export const GUIDELINE_BY_ID: ReadonlyMap<string, Guideline> = new Map(
  GUIDELINES.map((g) => [g.id, g]),
);

export function isRealGuidelineId(id: string): boolean {
  return GUIDELINE_BY_ID.has(id);
}

export function resolveGuidelineUrl(id: string): string | undefined {
  return GUIDELINE_BY_ID.get(id)?.sourceUrl;
}
