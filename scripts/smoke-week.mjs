// Manual smoke test for the tracker's Gemini endpoints.
// Usage: node scripts/smoke-week.mjs [baseUrl]
const base = process.argv[2] ?? "http://localhost:3100";

const profile = {
  name: "Maya",
  pregnancyWeek: 31,
  heightCm: 165,
  weightKg: 68,
  healthConditions: ["Gestational diabetes"],
  dietaryPreferences: ["Vegetarian"],
  allergies: "peanuts",
  avoids: "mushrooms"
};

const entries = [
  { id: "1", itemName: "Greek yogurt with berries", timestamp: new Date().toISOString(), mealType: "breakfast", quantity: "1 bowl", safetyStatus: "generally_suitable", flaggedIngredients: [], estimatedNutrients: { calories: 260, protein: 19, calcium: 220, folate: 30 } },
  { id: "2", itemName: "Spinach and lentil salad", timestamp: new Date().toISOString(), mealType: "lunch", quantity: "1 bowl", safetyStatus: "generally_suitable", flaggedIngredients: [], estimatedNutrients: { calories: 410, protein: 20, iron: 6, folate: 210 } },
  { id: "3", itemName: "Large cold brew coffee", timestamp: new Date().toISOString(), mealType: "snack", quantity: "16 oz", safetyStatus: "use_caution", flaggedIngredients: ["Caffeine"], estimatedNutrients: { calories: 20, caffeine: 210 } }
];

const post = async (path, body) => {
  const started = Date.now();
  const response = await fetch(base + path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  const data = await response.json().catch(() => ({}));
  return { status: response.status, ms: Date.now() - started, data };
};

console.log("POST /api/weekly-summary …");
const weekly = await post("/api/weekly-summary", { profile, entries });
console.log(`  HTTP ${weekly.status} in ${weekly.ms}ms`);
if (weekly.data.summary) {
  const s = weekly.data.summary;
  console.log("  headline:", s.headline);
  console.log("  patterns:", s.patterns.length);
  console.log("  addMore:", s.addMore.map((i) => i.name));
  console.log("  moderate:", s.moderate.map((i) => i.name));
  console.log("  alternatives:", s.alternatives.map((i) => i.name));
  console.log("  limitations:", s.limitations.length);
} else {
  console.log("  error:", JSON.stringify(weekly.data));
}

console.log("\nPOST /api/week-chat …");
const chat = await post("/api/week-chat", {
  profile,
  entries,
  summary: weekly.data.summary ?? null,
  messages: [{ role: "user", content: "What should I eat more of this week?" }]
});
console.log(`  HTTP ${chat.status} in ${chat.ms}ms`);
console.log("  reply:", chat.data.message ? chat.data.message.slice(0, 400) + "…" : JSON.stringify(chat.data));

console.log("\nPOST /api/week-chat (peanut-allergy safety check) …");
const allergy = await post("/api/week-chat", {
  profile,
  entries,
  summary: weekly.data.summary ?? null,
  messages: [{ role: "user", content: "Suggest three high-protein snacks I could add." }]
});
console.log(`  HTTP ${allergy.status} in ${allergy.ms}ms`);
const reply = allergy.data.message ?? "";
console.log("  mentions peanut?", /peanut/i.test(reply));
console.log("  reply:", reply.slice(0, 400) + "…");
