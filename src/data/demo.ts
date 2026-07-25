import type { ConsumptionEntry, FoodAnalysis, ScreenshotItem, WeeklySummary } from "@/types";

const now = new Date().toISOString();

export const demoAnalyses: FoodAnalysis[] = [
  {
    id: "demo-yogurt",
    itemName: "Pasteurized Greek yogurt with berries",
    status: "generally_suitable",
    summary: "Generally suitable when made with pasteurized milk and kept refrigerated.",
    explanation: "The visible product appears to be pasteurized Greek yogurt with fruit. It can contribute protein and calcium, and no pregnancy-specific concern is apparent from the available details.",
    flaggedIngredients: [],
    trimesterContext: "Protein and calcium remain useful throughout pregnancy, including the third trimester.",
    conditionContext: "If you monitor blood sugar, compare added sugar and serving size with your care plan.",
    moderationGuidance: "Choose an unsweetened or lower-added-sugar version when that suits you.",
    alternatives: [{ name: "Plain Greek yogurt with fresh berries", reason: "Similar creamy option with control over added sugar." }],
    questionsForProvider: ["Do my individual calcium needs require any changes to my usual diet?"],
    confidence: 0.92,
    sourceIds: ["ACOG-NUTRITION-01", "FDA-RAWMILK-2024"],
    limitations: ["Pasteurization and cold-chain storage cannot be verified from a photo alone."],
    nutrition: { calories: 160, protein: 15, calcium: 180, sugar: 9 },
    isDemo: true,
    createdAt: now
  },
  {
    id: "demo-coffee",
    itemName: "Large cold brew coffee",
    status: "use_caution",
    summary: "Use caution because caffeine can add up across coffee, tea, chocolate, and other drinks.",
    explanation: "A large cold brew may contain a substantial and highly variable amount of caffeine. The exact amount depends on the café, beans, and serving size.",
    flaggedIngredients: [{ ingredient: "Caffeine", reason: "Total daily caffeine intake is relevant during pregnancy." }],
    trimesterContext: "Caffeine moderation is relevant throughout pregnancy rather than only in one trimester.",
    conditionContext: "If caffeine worsens nausea, reflux, sleep, or blood pressure concerns, ask your clinician for individualized guidance.",
    moderationGuidance: "Check the café’s published caffeine amount and include all caffeine sources in your daily total.",
    alternatives: [{ name: "Half-caf iced latte", reason: "Keeps a similar coffee ritual with less caffeine; confirm milk is pasteurized." }],
    questionsForProvider: ["What caffeine limit is appropriate for my pregnancy and health history?"],
    confidence: 0.86,
    sourceIds: ["ACOG-CAFFEINE-2010"],
    limitations: ["The drink’s exact caffeine content is unknown."],
    nutrition: { calories: 20, caffeine: 210 },
    isDemo: true,
    createdAt: now
  },
  {
    id: "demo-cheese",
    itemName: "Unpasteurized soft cheese",
    status: "consider_avoiding",
    summary: "Consider avoiding unless the label confirms pasteurized milk and appropriate storage.",
    explanation: "Soft cheese made from unpasteurized milk can carry a higher Listeria risk during pregnancy. The label shown does not confirm pasteurization.",
    flaggedIngredients: [{ ingredient: "Unpasteurized soft cheese", reason: "May increase exposure to Listeria during pregnancy." }],
    trimesterContext: "Foodborne illness precautions apply throughout pregnancy.",
    conditionContext: null,
    moderationGuidance: "This concern is about preparation and pasteurization, not portion size.",
    alternatives: [{ name: "Pasteurized baked brie", reason: "A similar option when clearly labeled pasteurized and heated until steaming hot." }],
    questionsForProvider: ["What should I do if I already ate an unpasteurized product and feel unwell?"],
    confidence: 0.94,
    sourceIds: ["NHS-SOFTCHEESE-2023", "FDA-LISTERIA-2022"],
    limitations: ["The demo assumes the package is labeled unpasteurized."],
    nutrition: { calories: 110, protein: 6, calcium: 100 },
    isDemo: true,
    createdAt: now
  }
];

export const demoScreenshotItems: ScreenshotItem[] = [
  { name: "Wild-caught salmon fillet", brand: "North Coast", visibleDetails: ["Fresh", "Skin-on"], locationInImage: "Top left card", confidence: 0.96, analysis: { ...demoAnalyses[0], id: "demo-salmon", itemName: "Cooked salmon fillet", summary: "Generally suitable when cooked thoroughly; salmon is a lower-mercury fish choice.", explanation: "Salmon can contribute protein and omega-3 fats. Cook it thoroughly and follow local storage guidance.", sourceIds: ["FDA-MERCURY-2021", "CDC-SAFERFOOD-2025"] } },
  { name: "Imported soft-ripened cheese", brand: "Maison Belle", visibleDetails: ["Soft cheese", "Pasteurization not visible"], locationInImage: "Top right card", confidence: 0.89, analysis: demoAnalyses[2] },
  { name: "Cold brew concentrate", brand: "Morning Oak", visibleDetails: ["Coffee concentrate", "946 mL"], locationInImage: "Bottom left card", confidence: 0.93, analysis: demoAnalyses[1] }
];

const daysAgo = (days: number, hour: number) => {
  const date = new Date();
  date.setDate(date.getDate() - days);
  date.setHours(hour, 0, 0, 0);
  return date.toISOString();
};

export const demoEntries: ConsumptionEntry[] = [
  { id: "log-1", itemName: "Greek yogurt with berries", timestamp: daysAgo(0, 8), mealType: "breakfast", quantity: "1 bowl", safetyStatus: "generally_suitable", flaggedIngredients: [], estimatedNutrients: { calories: 260, protein: 19, calcium: 220, iron: 1, folate: 30, sugar: 14 }, originalAnalysis: demoAnalyses[0] },
  { id: "log-2", itemName: "Spinach and lentil salad", timestamp: daysAgo(1, 12), mealType: "lunch", quantity: "1 large bowl", safetyStatus: "generally_suitable", flaggedIngredients: [], estimatedNutrients: { calories: 410, protein: 20, iron: 6, calcium: 140, folate: 210 }, originalAnalysis: { ...demoAnalyses[0], id: "demo-lentils", itemName: "Spinach and lentil salad" } },
  { id: "log-3", itemName: "Half-caf iced latte", timestamp: daysAgo(1, 15), mealType: "snack", quantity: "12 oz", safetyStatus: "generally_suitable", flaggedIngredients: ["Caffeine"], estimatedNutrients: { calories: 130, protein: 7, calcium: 220, caffeine: 65, sugar: 10 }, originalAnalysis: demoAnalyses[1] },
  { id: "log-4", itemName: "Cooked salmon rice bowl", timestamp: daysAgo(2, 19), mealType: "dinner", quantity: "1 bowl", safetyStatus: "generally_suitable", flaggedIngredients: [], estimatedNutrients: { calories: 540, protein: 32, iron: 2, calcium: 45, folate: 38 }, originalAnalysis: demoScreenshotItems[0].analysis! },
  { id: "log-5", itemName: "Deli turkey sandwich", timestamp: daysAgo(3, 12), mealType: "lunch", quantity: "1 sandwich", safetyStatus: "use_caution", flaggedIngredients: ["Deli meat"], estimatedNutrients: { calories: 430, protein: 25, iron: 3, calcium: 120 }, originalAnalysis: { ...demoAnalyses[1], id: "demo-deli", itemName: "Deli turkey sandwich", summary: "Use caution unless the deli meat was heated until steaming hot.", flaggedIngredients: [{ ingredient: "Deli turkey", reason: "Ready-to-eat deli meat may carry Listeria; heating reduces risk." }], sourceIds: ["FDA-LISTERIA-2022"] } },
  { id: "log-6", itemName: "Banana and peanut butter toast", timestamp: daysAgo(4, 8), mealType: "breakfast", quantity: "2 slices", safetyStatus: "generally_suitable", flaggedIngredients: [], estimatedNutrients: { calories: 390, protein: 12, iron: 2, calcium: 60, folate: 45, sugar: 14 }, originalAnalysis: demoAnalyses[0] }
];

export const demoWeeklySummary: WeeklySummary = {
  headline: "A varied week with a steady protein pattern",
  overview: "Your logged meals show several identifiable protein sources and some calcium-rich foods. One deli-meat entry needed extra preparation care. This is a pattern summary of the foods you logged—not an assessment of your overall diet or nutrient status.",
  patterns: [
    "Protein appeared across yogurt, lentils, salmon, turkey, and peanut butter.",
    "Calcium-rich foods appeared in yogurt and a milk-based latte on two logged days.",
    "One ready-to-eat deli item was flagged because heating details were unclear.",
    "Your entries included one identifiable iron-rich plant meal; unlogged foods may change this picture.",
    "Recorded caffeine was moderate in the available data, but not every source may have been logged."
  ],
  addMore: [
    { name: "Lentils, beans, tofu, or well-cooked eggs", reason: "Practical ways to vary protein and identifiable iron-containing foods." },
    { name: "Pasteurized yogurt or fortified plant yogurt", reason: "Can add another calcium-rich option that fits a snack." }
  ],
  moderate: [
    { name: "Unheated deli meats", reason: "Heat until steaming hot when following pregnancy food-safety guidance." },
    { name: "Concentrated coffee drinks", reason: "Caffeine varies widely, so checking the listed amount helps track the total." }
  ],
  alternatives: [
    { name: "Freshly roasted turkey sandwich", reason: "Similar savoury lunch without relying on cold deli meat." },
    { name: "Half-caf cold brew", reason: "Keeps the coffee flavour while making caffeine totals easier to manage." }
  ],
  providerQuestions: ["Are there nutrients you want me to prioritize based on my labs and pregnancy?", "Does my personal health history change your caffeine advice?"],
  limitations: ["Only logged foods were reviewed.", "Nutrient values are estimates and cannot diagnose a deficiency."],
  generatedAt: now,
  isDemo: true
};
