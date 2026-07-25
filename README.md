# Tare

Pregnancy food scanner. Scan a barcode or photograph food, get a trimester-aware
verdict on whether it's safe, why, and what to eat instead.

*Tare* = the weighing term for deducting packaging to get at the true contents.

## Why it can be trusted

The real problem isn't "is this safe" — it's that four sources already gave four
different answers. So every verdict shows its reasoning and cites the published
guideline it came from, and the model is never allowed to originate a safety
judgment:

```
1 · RULES     Deterministic TypeScript matchers for high-stakes hazards.
              Returns AVOID / CAUTION / null. The model cannot override this.
                              ↓
2 · GEMINI    Gets ingredients + nutrition + trimester + retrieved guideline
              docs + the rule result. Returns structured JSON with reasoning
              and cited guideline IDs. May raise severity, never lower it.
                              ↓
3 · VALIDATE  Rejects any cited ID not in the corpus, any uncited flag, and
              any downgrade of a rule flag. On failure → falls back to layer 1.
```

`UNKNOWN` is a designed state, not a failure. All user data stays in
localStorage — no account, no database, nothing server-side to leak.

## Running it

```bash
npm install
cp .env.example .env.local     # then paste a key from aistudio.google.com/apikey
npm run dev
```

Open http://localhost:3000.

**`?demo=1`** seeds four known products with cached verdicts covering every
severity state. It makes **no network calls at all** — useful for demoing
without quota, and for iterating on the receipt.

### Camera on a phone

iOS and Android both refuse camera access on plain HTTP from a non-localhost
origin. To scan with a real phone camera you need HTTPS:

```bash
npx localtunnel --port 3000
```

Barcode decoding happens on-device via ZXing; only the resulting number is
looked up. The photo path does send the image to Google for identification.

## Checks

Two regression batteries guard the safety spine. Both need the dev server up.

```bash
./scripts/check-rules.sh       # 22 cases: must-fire, must-not-fire, condition-gated
./scripts/check-validator.sh   # 12 hand-written model responses layer 3 must reject
```

`check-rules.sh` matters in both directions: a missed deli meat is a safety
failure, and a hard-flagged Brussels sprout teaches people to ignore hard flags.

Dev-only helpers: `/states` renders every severity side by side, and
`/api/scratch` exposes the rule matcher and validator directly. Both 404 in
production.

## Stack

Next.js 16 (App Router) · TypeScript · Tailwind 4 · `@google/genai` ·
`@zxing/browser` · Open Food Facts · localStorage.

Three route handlers: `/api/verdict`, `/api/identify`, `/api/chat`.

## Known constraints

- **Gemini free tier is 20 requests/day per model.** Quota is per-project *per
  model*, so switching model IDs buys a fresh allowance, but sustained use needs
  billing enabled. Verdicts degrade gracefully to the layer-1 rule match when
  the model is unavailable — still correct, still cited, and labelled as such.
- Open Food Facts coverage is patchy for US products and its *search* endpoint
  is often down; product lookup by barcode is reliable.
- The rule matchers are English-first, with Spanish and French terms added for
  the highest-stakes hazards because Open Food Facts is Europe-heavy.
