# BumpSafe

**Know what’s on your plate, and why it matters.**

BumpSafe is an AI-powered pregnancy food safety and nutrition assistant. It helps pregnant users check packaged products, meals, and online listings against their pregnancy stage, health context, allergies, and dietary preferences. It presents calm, structured educational guidance with the exact ingredient or product characteristic that affected its result.

Pregnancy is a particularly important use case because foodborne-illness precautions, caffeine context, and nutritional needs can differ from the general population—and vague or alarmist search results are hard to act on. BumpSafe makes the reasoning visible and grounds medical and food-safety claims in a curated set of public-health source summaries.

> BumpSafe provides educational information and is not medical advice. Food safety and nutritional needs vary by person and pregnancy. Confirm important decisions with a qualified healthcare professional.

## Demo highlights

- Local pregnancy profile with automatically calculated trimester
- Camera or manual barcode entry with Open Food Facts lookup
- Gemini multimodal analysis for meal photos
- Multi-product extraction and analysis from shopping/menu screenshots
- Source-grounded, structured pregnancy-aware results
- Ingredient-level reasoning, confidence, limitations, and preference-matched alternatives
- Contextual follow-up chat
- Local consumption tracker with editing, filtering, and weekly chart
- Gemini weekly pattern synthesis without deficiency diagnosis
- Seeded examples and a mock shopping screenshot for a reliable offline-friendly demo

Seeded content is always labeled **Demo data** and is never presented as live Gemini output.

## How Gemini is used

Gemini is the reasoning and synthesis layer; curated public-health guidance is the fact layer.

1. **Multimodal food identification:** Gemini vision identifies likely foods, visible ingredients, preparation cues, and uncertainty from a meal photo.
2. **Screenshot understanding:** It extracts every visible food or product from a shopping, delivery, or restaurant screenshot and returns a location and confidence for each.
3. **Personalized reasoning:** Structured product details are considered alongside pregnancy week/trimester, conditions, allergies, and dietary preferences.
4. **Ingredient-level explanations and alternatives:** The result identifies the exact characteristic behind a caution and suggests a similar option that fits the profile.
5. **Follow-up conversation:** The current profile, result, conversation, and same approved sources stay in context.
6. **Weekly pattern analysis:** Gemini synthesizes only logged foods, using careful wording such as “few identifiable iron-rich foods” rather than diagnosing deficiency.
7. **Source grounding:** The model receives repository-controlled source summaries and may cite only their supplied IDs. Unknown IDs are removed server-side; an unsupported conclusion is downgraded to “Not enough information.”

All model responses used by the interface are JSON-schema constrained and validated with Zod. Gemini keys and calls remain server-side.

## Technology

- Next.js App Router, React, and TypeScript
- Tailwind CSS plus a small custom design system
- Google Gemini via `@google/genai`
- Zod validation and Gemini structured output schemas
- Open Food Facts API
- `@zxing/browser` barcode camera scanner
- Recharts
- Browser local storage for profile, analyses, log, and weekly summary

## Local setup

Requires Node.js 20.9 or newer.

```bash
npm install
cp .env.example .env.local
```

Add a server-side Gemini API key:

```env
GEMINI_API_KEY=your_key_here
GEMINI_MODEL=gemini-3.6-flash
GOOGLE_GENAI_USE_VERTEXAI=false
```

To use a Vertex AI Express Mode API key instead, set:

```env
GEMINI_API_KEY=your_vertex_express_key
GEMINI_MODEL=gemini-3.6-flash
GOOGLE_GENAI_USE_VERTEXAI=true
```

For full Vertex AI authentication with Application Default Credentials, also set
`GOOGLE_CLOUD_PROJECT` and `GOOGLE_CLOUD_LOCATION=global`, enable the Vertex AI
API, and run `gcloud auth application-default login` locally.

Run the development server:

```bash
npm run dev
```

Then open [http://localhost:3000](http://localhost:3000).

## Chrome extension

`extension/` contains a companion "BumpSafe Scanner" browser extension that
screenshots the current tab, scans it for products via the same Gemini
screenshot-analysis endpoint, and lets you click a detected product to send it
into the running BumpSafe app. See `extension/README.md` for setup.

Quality checks:

```bash
npm run lint
npm run typecheck
npm run build
```

Open Food Facts does not require a key. Barcode data is fetched server-side from its public API. A missing product returns a helpful prompt to try photo or text input.

### Demo mode

The app remains navigable without `GEMINI_API_KEY`. Open **Scan** and choose any of the three clearly labeled examples:

1. Pasteurized Greek yogurt with berries — generally suitable
2. Large cold brew coffee — use caution
3. Unpasteurized soft cheese — consider avoiding

The Screenshot tab includes a seeded three-product shopping screenshot. On the Tracker page, choose **Load demo week**, then open the weekly summary and choose **View seeded demo summary**. Demo data is stored locally and clearly distinguished from live AI output.

## API routes

| Method | Route | Purpose |
| --- | --- | --- |
| `GET` | `/api/product/:barcode` | Open Food Facts product lookup |
| `POST` | `/api/analyse/barcode` | Product and profile reasoning |
| `POST` | `/api/analyse/image` | Multimodal meal identification and analysis |
| `POST` | `/api/analyse/screenshot` | Multi-product screenshot extraction and analysis |
| `POST` | `/api/analyse/text` | Text food/ingredient analysis |
| `POST` | `/api/chat` | Context-maintaining follow-up |
| `POST` | `/api/weekly-summary` | Logged-food pattern synthesis |

Requests have input validation, payload limits, model timeouts, structured errors, and schema validation. The curated source knowledge base is in `src/data/guidance.json`.

## Chrome extension roadmap

The screenshot endpoint is deliberately client-agnostic. A future Manifest V3 extension can:

1. Capture the visible tab with `chrome.tabs.captureVisibleTab`.
2. Send the data URL and the user’s BumpSafe profile to `/api/analyse/screenshot`.
3. Use returned `locationInImage` metadata to associate identified Amazon products, groceries, or menu items with page elements.
4. Render status badges in an isolated content-script overlay.
5. Link each badge to a persisted full analysis in the web app.

Production extension work would add authenticated cross-device profiles, extension origin controls, short-lived upload tokens, and stronger visual-to-DOM matching. It is intentionally not part of this hackathon MVP.

## Team

- Aaron Tran
- Aaron Wang
- Anita Jiang
- Kaley Wu

Repository: https://github.com/aarontran321/hackthevalley

## Safety

BumpSafe never diagnoses a condition, recommends supplement dosages, advises stopping medication, makes absolute guarantees, or makes appearance/weight-loss recommendations. It uses calm uncertainty-aware language and directs individual or high-risk decisions to qualified healthcare professionals.
