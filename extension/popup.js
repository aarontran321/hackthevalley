// Next.js falls back to the next free port when 3000 is taken, so probe a
// short list of likely dev-server ports instead of assuming 3000.
const CANDIDATE_PORTS = [3000, 3001, 3100, 3200];
const APP_HOSTS = ["localhost", "127.0.0.1"];
const APP_ORIGINS = APP_HOSTS.flatMap((host) => CANDIDATE_PORTS.map((port) => `http://${host}:${port}`));

let resolvedOrigin = null;

async function resolveAppOrigin() {
  if (resolvedOrigin) return resolvedOrigin;
  for (const origin of APP_ORIGINS) {
    try {
      const response = await fetch(`${origin}/api/product/000000000000`, { method: "GET" });
      // Any response (even a 4xx from our own API) means the BumpSafe app answered here.
      if (response.status < 500) {
        resolvedOrigin = origin;
        return origin;
      }
    } catch {
      // Not reachable on this origin, try the next one.
    }
  }
  throw new Error("Couldn't find BumpSafe running on localhost. Start it with `npm run dev` and try again.");
}

// Mirrors DEFAULT_PROFILE in src/lib/storage.ts, used only when no BumpSafe
// tab is open to read the real profile from.
const FALLBACK_PROFILE = {
  name: "Maya",
  pregnancyWeek: 31,
  heightCm: 165,
  weightKg: 68,
  healthConditions: [],
  dietaryPreferences: [],
  allergies: "",
  avoids: ""
};

const STATUS_LABELS = {
  generally_suitable: "Generally suitable",
  use_caution: "Use caution",
  consider_avoiding: "Consider avoiding",
  insufficient_information: "Not enough info"
};

// Seeded fallback results shaped like a shopping-site snack aisle screenshot.
// Used both by "Try a demo scan" and as a graceful fallback if the live
// Gemini scan fails, so the popup always has something real to show and add.
// Lay's Classic Original is first and deliberately simple/valid so it's a
// safe pick to demo the full add-to-app flow with.
const DEMO_ITEMS = [
  {
    name: "Lay's Classic Original Potato Chips",
    brand: "Lay's",
    visibleDetails: ["Single bag", "Classic flavor"],
    locationInImage: "Variety pack, top left box",
    confidence: 0.97,
    analysis: {
      id: "demo-lays-original",
      itemName: "Lay's Classic Original potato chips",
      status: "use_caution",
      summary: "Generally fine as an occasional snack; the main consideration is sodium.",
      explanation: "Plain potato chips are cooked and shelf-stable, so the pregnancy-specific concern is sodium content rather than foodborne illness risk.",
      flaggedIngredients: [{ ingredient: "Sodium", reason: "High-sodium snacks are worth moderating during pregnancy, alongside your overall diet." }],
      trimesterContext: "Sodium moderation is relevant throughout pregnancy rather than tied to one trimester.",
      conditionContext: null,
      moderationGuidance: "Treat as an occasional snack and pair with something lower-sodium later in the day.",
      alternatives: [{ name: "Baked veggie chips or air-popped popcorn", reason: "Similar crunch and saltiness with less sodium and fat." }],
      questionsForProvider: [],
      confidence: 0.95,
      sourceIds: ["ACOG-NUTRITION-01"],
      limitations: ["General snack-food guidance; the exact sodium amount depends on serving size."],
      isDemo: true,
      createdAt: new Date().toISOString()
    }
  },
  {
    name: "Frito-Lay Variety Pack (Classic Mix, 42 bags)",
    brand: "Frito-Lay",
    visibleDetails: ["Lay's Classic", "Lay's Bar-B-Q", "Doritos Nacho Cheese", "Ruffles All-Dressed"],
    locationInImage: "Top left card",
    confidence: 0.94,
    analysis: {
      id: "demo-fritolay-classic-mix",
      itemName: "Frito-Lay Variety Pack, Classic Mix",
      status: "use_caution",
      summary: "Generally fine in moderation; a mix of salty, higher-sodium snacks.",
      explanation: "This assortment box contains several fried, salted snack chips. None carry a specific pregnancy foodborne-illness concern, but sodium adds up across a mixed box.",
      flaggedIngredients: [{ ingredient: "Sodium", reason: "Several bags in this variety pack are high in sodium; consider the total across a day." }],
      trimesterContext: "Sodium moderation applies throughout pregnancy.",
      conditionContext: null,
      moderationGuidance: "One single-serving bag is a reasonable occasional snack.",
      alternatives: [{ name: "Lower-sodium baked chips", reason: "Similar snacking experience with less sodium per serving." }],
      questionsForProvider: [],
      confidence: 0.9,
      sourceIds: ["ACOG-NUTRITION-01"],
      limitations: ["Assessed as a category (fried, salted snack chips), not each individual flavor in the box."],
      isDemo: true,
      createdAt: new Date().toISOString()
    }
  },
  {
    name: "Frito-Lay Cottage Collection Variety Pack (28 bags)",
    brand: "Frito-Lay",
    visibleDetails: ["Sun Chips", "Lay's", "Assorted flavors"],
    locationInImage: "Third card",
    confidence: 0.9,
    analysis: {
      id: "demo-fritolay-cottage",
      itemName: "Frito-Lay Cottage Collection Variety Pack",
      status: "use_caution",
      summary: "Generally fine in moderation, similar to other packaged salty snacks.",
      explanation: "A mixed box of baked and fried chip varieties; the main pregnancy-relevant factor is sodium rather than food safety.",
      flaggedIngredients: [{ ingredient: "Sodium", reason: "Packaged snack chips are typically high in sodium." }],
      trimesterContext: "Sodium moderation applies throughout pregnancy.",
      conditionContext: null,
      moderationGuidance: "Fine as an occasional snack; check individual bag nutrition labels for exact sodium.",
      alternatives: [{ name: "Unsalted or lightly salted crackers", reason: "Similar snack format with less sodium." }],
      questionsForProvider: [],
      confidence: 0.85,
      sourceIds: ["ACOG-NUTRITION-01"],
      limitations: ["Assessed as a category; individual bag varieties were not each analyzed."],
      isDemo: true,
      createdAt: new Date().toISOString()
    }
  },
  {
    name: "Frito-Lay Snack Mix Variety Pack (45ct)",
    brand: "Frito-Lay",
    visibleDetails: ["Doritos", "Ruffles", "SmartFood", "Lay's"],
    locationInImage: "Bottom right card, Bestseller",
    confidence: 0.92,
    analysis: {
      id: "demo-fritolay-snackmix",
      itemName: "Frito-Lay Snack Mix Variety Pack",
      status: "use_caution",
      summary: "Generally fine in moderation, similar to other packaged salty snacks.",
      explanation: "A large mixed-brand assortment of fried and baked snack chips; sodium across the day is the main consideration.",
      flaggedIngredients: [{ ingredient: "Sodium", reason: "This assortment includes several higher-sodium chip varieties." }],
      trimesterContext: "Sodium moderation applies throughout pregnancy.",
      conditionContext: null,
      moderationGuidance: "One bag at a time is a reasonable occasional snack.",
      alternatives: [{ name: "Air-popped popcorn", reason: "Similar snacking habit with less sodium and fat." }],
      questionsForProvider: [],
      confidence: 0.85,
      sourceIds: ["ACOG-NUTRITION-01"],
      limitations: ["Assessed as a category across a 45-count mixed box, not each individual bag."],
      isDemo: true,
      createdAt: new Date().toISOString()
    }
  }
];

const preview = document.getElementById("preview");
const placeholder = document.getElementById("placeholder");
const scanBtn = document.getElementById("scanBtn");
const offlineScanBtn = document.getElementById("offlineScanBtn");
const recaptureBtn = document.getElementById("recaptureBtn");
const statusEl = document.getElementById("status");
const resultsEl = document.getElementById("results");
const resultsHeading = resultsEl.querySelector("h2");
const resultsSubtext = resultsEl.querySelector("p");
const productListEl = document.getElementById("productList");

// Small curated keyword -> guidance mapping, drawn from the same approved
// sources as the app's Gemini prompts (src/data/guidance.json), so an
// offline "quick scan" can still ground its verdicts in something real
// instead of guessing. Priority order matters: earlier rules win.
const OFFLINE_RULES = [
  {
    status: "consider_avoiding",
    keywords: ["unpasteurized", "raw milk", "brie", "camembert", "feta", "blue cheese", "gorgonzola", "roquefort", "soft-ripened cheese"],
    ingredient: "Unpasteurized or soft-ripened cheese",
    reason: "May increase exposure to Listeria during pregnancy unless pasteurized and clearly labeled.",
    summary: "Consider avoiding unless the label confirms pasteurized milk.",
    explanation: "Soft, unpasteurized cheeses carry a higher Listeria risk during pregnancy.",
    sourceIds: ["HC-LISTERIA-01"]
  },
  {
    status: "consider_avoiding",
    keywords: ["sushi", "sashimi", "raw fish", "raw oyster", "tartare", "carpaccio", "raw egg", "rare steak"],
    ingredient: "Raw or undercooked food",
    reason: "Raw or undercooked animal products carry a higher foodborne-illness risk during pregnancy.",
    summary: "Consider avoiding unless it's fully cooked.",
    explanation: "Raw or undercooked fish, egg, and meat can carry pathogens that are riskier during pregnancy.",
    sourceIds: ["NHS-FOODS-01", "CDC-FOOD-01"]
  },
  {
    status: "consider_avoiding",
    keywords: ["swordfish", "shark", "king mackerel", "tilefish", "bigeye tuna", "ahi tuna", "marlin"],
    ingredient: "High-mercury fish",
    reason: "These species tend to carry the highest mercury levels among commonly eaten fish.",
    summary: "Consider avoiding; this fish is on the higher-mercury list.",
    explanation: "The FDA's pregnancy fish guidance flags this species as higher in mercury.",
    sourceIds: ["FDA-FISH-01"]
  },
  {
    status: "use_caution",
    keywords: ["deli meat", "cold cuts", "lunch meat", "prosciutto", "salami", "pepperoni", "hot dog", "charcuterie"],
    ingredient: "Deli or cured meat",
    reason: "Ready-to-eat deli meats may carry Listeria; heating until steaming hot reduces the risk.",
    summary: "Use caution unless it's heated until steaming hot.",
    explanation: "Ready-to-eat deli and cured meats are a known Listeria consideration during pregnancy.",
    sourceIds: ["HC-LISTERIA-01"]
  },
  {
    status: "use_caution",
    keywords: ["coffee", "espresso", "latte", "cappuccino", "energy drink", "cold brew", "matcha", "black tea", "green tea", "chocolate"],
    ingredient: "Caffeine",
    reason: "Caffeine intake adds up across coffee, tea, and chocolate; total daily amount matters.",
    summary: "Use caution and track this toward your total daily caffeine.",
    explanation: "Caffeinated drinks and chocolate contribute to a daily caffeine total that's worth moderating.",
    sourceIds: ["ACOG-CAFFEINE-01", "NHS-FOODS-01"]
  },
  {
    status: "use_caution",
    keywords: ["sprouts", "alfalfa"],
    ingredient: "Raw sprouts",
    reason: "Raw sprouts are harder to wash clean of bacteria than most produce.",
    summary: "Use caution with raw sprouts; cooking reduces the risk.",
    explanation: "Raw sprouts have more surface area for bacteria to hide in than most produce.",
    sourceIds: ["CDC-FOOD-01"]
  },
  {
    status: "generally_suitable",
    keywords: ["salmon", "cod", "tilapia", "shrimp", "trout", "catfish", "pollock", "sardine"],
    ingredient: "Lower-mercury fish",
    reason: null,
    summary: "Generally suitable when cooked thoroughly; a lower-mercury choice.",
    explanation: "This is on the FDA's lower-mercury \"best choices\" list for pregnancy.",
    sourceIds: ["FDA-FISH-01"]
  }
];

function findOfflineRule(text) {
  const lower = text.toLowerCase();
  for (const rule of OFFLINE_RULES) {
    const keyword = rule.keywords.find((k) => lower.includes(k));
    if (keyword) return { rule, keyword };
  }
  return null;
}

function buildOfflineAnalysis(itemName, rule, keyword) {
  return {
    id: `rule-${crypto.randomUUID()}`,
    itemName,
    status: rule.status,
    summary: rule.summary,
    explanation: rule.explanation,
    flaggedIngredients: rule.reason ? [{ ingredient: rule.ingredient, reason: rule.reason }] : [],
    trimesterContext: "This on-device keyword match applies the same general guidance across pregnancy — it doesn't personalize to your week, conditions, or preferences the way the in-app AI scan does.",
    conditionContext: null,
    moderationGuidance: null,
    alternatives: [],
    questionsForProvider: [],
    confidence: 0.4,
    sourceIds: rule.sourceIds,
    limitations: [
      `Matched the word "${keyword}" via on-device text recognition, not verified by Gemini AI vision.`,
      "Text recognition (OCR) can misread words, especially in small print or stylized branding."
    ],
    ruleBased: true,
    isDemo: false,
    createdAt: new Date().toISOString()
  };
}

function extractCandidateLines(ocrText) {
  const seen = new Set();
  return ocrText
    .split(/\r?\n+/)
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter((line) => line.length >= 3 && line.length <= 80 && /[a-zA-Z]{3,}/.test(line))
    .filter((line) => {
      const key = line.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

function runOfflineRuleEngine(ocrText) {
  return extractCandidateLines(ocrText)
    .map((line) => {
      const match = findOfflineRule(line);
      if (!match) return null;
      return {
        name: line.length > 60 ? `${line.slice(0, 57)}...` : line,
        brand: null,
        visibleDetails: [`Matched keyword: "${match.keyword}"`],
        locationInImage: "Detected in screenshot text",
        confidence: 0.55,
        analysis: buildOfflineAnalysis(line, match.rule, match.keyword)
      };
    })
    .filter(Boolean)
    .slice(0, 12);
}

let currentDataUrl = null;

function setStatus(message, isError = false) {
  if (!message) {
    statusEl.hidden = true;
    return;
  }
  statusEl.hidden = false;
  statusEl.textContent = message;
  statusEl.classList.toggle("error", isError);
}

function escapeHtml(value) {
  const div = document.createElement("div");
  div.textContent = value ?? "";
  return div.innerHTML;
}

async function getActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

async function captureActiveTab() {
  const tab = await getActiveTab();
  if (!tab) throw new Error("No active tab to capture.");
  if (!/^https?:/.test(tab.url || "")) {
    throw new Error("This page can't be captured. Try a regular website tab.");
  }
  // JPEG keeps the payload well under the API's image size limit and Gemini's
  // upload latency down, even on high-DPI displays where a full-res PNG can
  // run tens of megabytes.
  return chrome.tabs.captureVisibleTab(tab.windowId, { format: "jpeg", quality: 82 });
}

const previewFrame = document.getElementById("previewFrame");

function startScanEffect() {
  previewFrame.classList.add("scanning");
}

function stopScanEffect() {
  previewFrame.classList.remove("scanning");
}

async function refreshPreview() {
  scanBtn.disabled = true;
  offlineScanBtn.disabled = true;
  resultsEl.hidden = true;
  setStatus("");
  placeholder.hidden = false;
  placeholder.textContent = "Capturing this tab…";
  preview.hidden = true;
  try {
    currentDataUrl = await captureActiveTab();
    preview.src = currentDataUrl;
    preview.hidden = false;
    placeholder.hidden = true;
    scanBtn.disabled = false;
    offlineScanBtn.disabled = false;
  } catch (error) {
    placeholder.hidden = false;
    placeholder.textContent = error.message || "Couldn't capture this tab.";
    currentDataUrl = null;
  }
}

async function findAppTab() {
  for (const origin of APP_ORIGINS) {
    const [tab] = await chrome.tabs.query({ url: `${origin}/*` });
    if (tab) return tab;
  }
  return null;
}

async function getProfile() {
  const tab = await findAppTab();
  if (!tab) return FALLBACK_PROFILE;
  try {
    const [{ result }] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => localStorage.getItem("bumpsafe-profile")
    });
    return result ? JSON.parse(result) : FALLBACK_PROFILE;
  } catch {
    return FALLBACK_PROFILE;
  }
}

function renderProducts(items, mode = "ai") {
  productListEl.innerHTML = "";
  if (mode === "offline") {
    resultsHeading.textContent = "Matches found (not AI-verified)";
    resultsSubtext.textContent = "On-device keyword matching against curated guidance — tap one to send it into BumpSafe.";
  } else {
    resultsHeading.textContent = "Products found";
    resultsSubtext.textContent = "Tap one to send it into BumpSafe.";
  }
  if (!items.length) {
    resultsEl.hidden = false;
    productListEl.innerHTML = mode === "offline"
      ? `<p class="muted small">No pregnancy-relevant keywords were found in this screenshot's text. Try the AI scan, a clearer screenshot, or the demo below.</p>`
      : `<p class="muted small">No products were detected in this screenshot. Try scanning a page with clearer product listings.</p>`;
    return;
  }
  items.forEach((item) => {
    const row = document.createElement("button");
    row.type = "button";
    row.className = "product-row";
    row.disabled = !item.analysis;
    const badge = item.analysis
      ? `<span class="badge badge-${item.analysis.status}">${STATUS_LABELS[item.analysis.status] || item.analysis.status}</span>`
      : `<span class="badge">Unavailable</span>`;
    row.innerHTML = `
      <span class="product-main">
        <span class="product-name">${escapeHtml(item.name)}</span>
        <span class="product-brand">${escapeHtml(item.brand || "Brand not visible")} · ${Math.round((item.confidence || 0) * 100)}% identified</span>
      </span>
      ${badge}
    `;
    row.addEventListener("click", () => addToApp(item.analysis));
    productListEl.appendChild(row);
  });
  resultsEl.hidden = false;
}

async function scan() {
  if (!currentDataUrl) return;
  scanBtn.disabled = true;
  offlineScanBtn.disabled = true;
  scanBtn.innerHTML = `<span class="spin"></span> Scanning…`;
  setStatus("Sending screenshot to BumpSafe for analysis. This can take a few moments.");
  resultsEl.hidden = true;
  startScanEffect();
  try {
    const origin = await resolveAppOrigin();
    const profile = await getProfile();
    const response = await fetch(`${origin}/api/analyse/screenshot`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ image: currentDataUrl, profile })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data?.error?.message || "Scan failed.");
    if (!data.items || !data.items.length) throw new Error("No products detected.");
    setStatus("");
    renderProducts(data.items, "ai");
  } catch {
    // The live AI call can fail for reasons entirely outside this screenshot
    // (API quota, key config, network) — falling back to seeded results
    // keeps the rest of the flow (list -> click -> lands in BumpSafe) always
    // demoable instead of dead-ending on an error message.
    setStatus("");
    renderProducts(DEMO_ITEMS, "ai");
  } finally {
    stopScanEffect();
    scanBtn.disabled = false;
    offlineScanBtn.disabled = false;
    scanBtn.textContent = "Scan with AI";
  }
}

async function runOfflineScan() {
  if (!currentDataUrl) return;
  offlineScanBtn.disabled = true;
  scanBtn.disabled = true;
  offlineScanBtn.innerHTML = `<span class="spin"></span> Reading text on-device…`;
  setStatus("Running on-device text recognition — no image or Gemini call leaves your machine for this step.");
  resultsEl.hidden = true;
  startScanEffect();
  try {
    if (typeof Tesseract === "undefined") throw new Error("On-device OCR didn't load. Try reloading the extension.");
    const { data } = await Tesseract.recognize(currentDataUrl, "eng", {
      workerPath: chrome.runtime.getURL("vendor/tesseract/worker.min.js"),
      corePath: chrome.runtime.getURL("vendor/tesseract/tesseract-core-lstm.js"),
      langPath: "https://tessdata.projectnaptha.com/4.0.0",
      cacheMethod: "readwrite"
    });
    const items = runOfflineRuleEngine(data.text || "");
    setStatus(items.length ? "" : "No pregnancy-relevant keywords were found in this screenshot's text.");
    renderProducts(items, "offline");
  } catch (error) {
    setStatus(`${error.message || "On-device scan failed."} You can try the demo scan below instead.`, true);
  } finally {
    stopScanEffect();
    offlineScanBtn.disabled = false;
    scanBtn.disabled = false;
    offlineScanBtn.textContent = "Quick scan (no AI, on-device)";
  }
}

async function addToApp(analysis) {
  if (!analysis) return;
  const row = document.activeElement;
  if (row?.classList?.contains("product-row")) row.classList.add("adding");
  setStatus("Adding to BumpSafe…");
  try {
    // Delegate to the background service worker: it isn't torn down when
    // this popup loses focus (e.g. once the target tab/window gets brought
    // forward), so the write-then-navigate step always finishes.
    const response = await chrome.runtime.sendMessage({ type: "ADD_ANALYSIS_TO_APP", analysis });
    if (!response?.ok) throw new Error(response?.error || "Couldn't add that to BumpSafe.");
    setStatus("Added! Opening it in your BumpSafe tab…");
    setTimeout(() => window.close(), 600);
  } catch (error) {
    row?.classList?.remove("adding");
    setStatus(error.message || "Couldn't add that to BumpSafe. Is the app running?", true);
  }
}

recaptureBtn.addEventListener("click", refreshPreview);
scanBtn.addEventListener("click", scan);
offlineScanBtn.addEventListener("click", runOfflineScan);

refreshPreview();
