# TARE — Project Spec

Pregnancy food scanner. Scan a barcode or photograph food, get a trimester-aware verdict
on whether it's safe, why, and what to eat instead.

*Tare* = the weighing term for deducting packaging to get at the true contents. Strip the
marketing off the label and show what's actually there.

**Priority: get a working end-to-end loop as fast as possible, then make it good.** A
scan that produces a real verdict on a real product beats a beautiful screen with fake
data. Build order below is sequenced for that.

---

## What the app does

### The core loop

You're 22 weeks pregnant, standing in a grocery aisle holding a package of deli turkey.
You open Tare, point the camera at the barcode, and a receipt unrolls down the screen:
**"Avoid this one."** Below it, in receipt line-item form, is the actual reasoning —
*ready-to-eat deli meat → listeria risk unless heated to steaming → FDA-LISTERIA-2022* —
with the citation tappable so you can read the source guidance yourself. Under that, three
things you could eat instead that scratch the same itch: warm rotisserie chicken, canned
salmon salad, aged hard cheese and crackers. Not "have a salad" — things that are salty
and savory, because that's what the person actually wanted.

### The four surfaces

**Setup.** Once, about fifteen seconds. Current week, diet pattern, optional conditions
like gestational diabetes. Stored in localStorage. No account, no server, nothing to leak.

**Scanning — two paths.** The barcode path decodes via webcam locally and looks the product
up in Open Food Facts for the real ingredient list and nutrition panel. The photo path
exists because most food has no barcode — a restaurant plate, a deli counter, a farmer's
market item, a menu in another language. Gemini vision identifies it. If it isn't
confident, it says so and asks the user to confirm rather than guessing, because the output
is a safety verdict.

**The verdict.** Deliberately not a red/yellow/green light. The user's actual problem is
that four sources already gave them four different answers, so a bare verdict is useless —
what they need is a verdict they can *check*. The receipt shows the item, the severity,
which specific ingredient triggered the flag, why, and which published guideline says so.
It also handles not knowing: if nothing in the corpus applies, it says so plainly and shows
the ingredients anyway, with a dashed border so uncertainty is legible before you've read a
word.

**Chat.** For follow-ups a static verdict can't handle — *"I'm craving something salty,
what's safe?"* or *"what have I scanned this week that I should be careful with?"* The
assistant already knows the user's week and conditions, and it can call into the app:
pulling scan history, or running a food mentioned in conversation through the full safety
pipeline before answering. The user sees it do this as an inline trace, so an answer never
appears from nowhere.

### Why the product is scoped to pregnancy

This shapes design decisions, so read it:

- Pregnancy food risks are near-binary and documented — listeria, mercury, retinol,
  unpasteurized dairy, alcohol, caffeine ceilings. General "healthy eating" is fuzzy and
  unanswerable; this is answerable, which means verdicts can be decisive rather than hedged.
- Guidance changes for the same user across 40 weeks, so trimester is a first-class input,
  not a preference toggle.
- The real pain is contradictory advice. Trust is the product — which is why every answer
  shows its reasoning and cites its source. That single fact drives the entire UI.

---

## Non-negotiable: the safety spine

This touches real health risk. **Gemini explains guidance. It never originates a safety
judgment.**

```
1 · RULES     Deterministic TypeScript matchers for high-stakes hazards.
              Returns AVOID / CAUTION / null. Model cannot override this.
                              ↓
2 · GEMINI    Gets ingredients + nutrition + trimester + retrieved guideline
              docs + the rule result. Returns structured JSON with reasoning
              and cited guideline IDs. May raise severity, never lower it.
                              ↓
3 · VALIDATE  Reject any cited ID not in the corpus. Reject any downgrade of a
              rule flag. Reject bad schema. On failure → fall back to layer 1.
```

Hard rules:
- Every flag cites ≥1 real guideline ID. No citation → verdict is `UNKNOWN`.
- `UNKNOWN` is a valid, well-designed state. Never guess to avoid it.
- No dosages, no diagnoses, no treatment advice, ever.
- Persistent disclaimer in the app shell: *"Tare explains public food-safety guidance.
  It isn't medical advice — check with your provider."*
- **All user data stays in localStorage.** Nothing server-side. No auth, no database.

---

## Scope

**Build these four things. Nothing else.**

1. **Setup** — one inline form: current week, diet pattern, optional conditions.
2. **Scan** — webcam barcode via ZXing → Open Food Facts. Photo tab → Gemini vision.
   Both feed the same pipeline.
3. **Verdict** — the receipt. Severity, reasoning, flagged ingredients with citations,
   three safe alternatives.
4. **Chat** — follow-up questions with two function-calling tools.

**Out of scope:** nutrient dashboard, weekly synthesis, ingredient explainer, multilingual,
settings page, provider export.

---

## Stack

```
Next.js 15 App Router + TypeScript + Tailwind
@google/genai        server-side only, in route handlers
@zxing/browser       webcam barcode decode
Open Food Facts      free REST API, no key
localStorage         no Dexie, no database
CSS animation        no Motion, no charting library
```

Three route handlers, no more:

```
POST /api/verdict    { item, trimester, conditions } → Verdict  (includes alternatives)
POST /api/identify   { imageBase64, mimeType }       → IdentifiedFood
POST /api/chat       { messages, context }           → reply + tool calls
```

`GEMINI_API_KEY` in `.env.local`, referenced only inside route handlers, never in a client
component. Model: `gemini-2.5-flash` throughout — verify the current ID at ai.google.dev
before starting.

**Build `?demo=1`** that seeds three known products with cached responses, so the app is
fully explorable with no network and no API quota. Early, not at the end — it also lets you
iterate on the receipt without burning a call on every hot reload.

---

## Types

```ts
type Trimester = 1 | 2 | 3;
type Severity  = 'AVOID' | 'CAUTION' | 'OK' | 'UNKNOWN';
type HazardClass = 'listeria' | 'mercury' | 'retinol' | 'raw-animal-product'
                 | 'alcohol' | 'caffeine' | 'unpasteurized' | 'added-sugar-gdm' | 'none';

interface Guideline {
  id: string;                    // 'FDA-MERCURY-2021'
  hazardClass: HazardClass;
  authority: 'FDA' | 'NHS' | 'ACOG' | 'CDC';
  title: string;
  summary: string;               // ≤60 words — this is the retrievable body
  sourceUrl: string;
}

interface Verdict {
  item: { name: string; brand?: string; ingredients: string[]; nutrition: Record<string, number> };
  severity: Severity;
  headline: string;              // ≤8 words
  reasoning: string;             // 2–3 plain sentences
  flags: Array<{
    ingredient: string;
    severity: Severity;
    plainReason: string;         // ≤20 words, no jargon
    guidelineIds: string[];      // must be non-empty and must resolve
  }>;
  alternatives: Array<{ name: string; why: string }>;  // sensory match, not nutritional
  modelConfidence: number;
  ruleTriggered: boolean;        // layer 1 fired → render the HARD FLAG tag
}
```

---

## Guideline corpus

`lib/guidelines.ts` — **12 entries**, hand-written, covering every hazard class. Derive the
summaries from published FDA / NHS / ACOG / CDC pregnancy guidance and include the real
`sourceUrl`.

**Do not have Gemini generate these.** Grounding you generated with the model you're
grounding is not grounding.

Retrieval is keyword + hazard-class matching over 12 docs. No vector store — at this corpus
size exhaustive matching beats embedding retrieval and has no recall failure mode.

```ts
export const GUIDELINES: Guideline[] = [
  {
    id: 'FDA-MERCURY-2021',
    hazardClass: 'mercury',
    authority: 'FDA',
    title: 'Fish to avoid during pregnancy',
    summary: 'Highest-mercury species — shark, swordfish, king mackerel, tilefish, ' +
             'bigeye tuna, marlin, orange roughy — should be avoided in pregnancy. ' +
             'Lower-mercury fish remain recommended at 2–3 servings weekly.',
    sourceUrl: 'https://www.fda.gov/food/consumers/advice-about-eating-fish',
  },
  // + listeria, unpasteurized dairy, deli meat, retinol, alcohol, caffeine,
  //   raw/undercooked animal products, sprouts, pâté, GDM carbs, folate
];
```

---

## Gemini calls

### `/api/verdict` — verdict + alternatives in one call

Combining these saves a route, a schema, and a round-trip. Use
`responseMimeType: 'application/json'` with a `responseSchema` mirroring `Verdict`, and
`temperature: 0.2`.

System instruction:

> You are the reasoning layer of a pregnancy food-safety tool. You do not make safety
> determinations from your own knowledge. You are given authoritative guideline documents
> plus a food's ingredients and nutrition, and your job is to determine which guidelines
> apply and explain it in plain language someone can read in five seconds while standing
> in a grocery aisle.
>
> - Every flag must cite at least one guideline ID from the provided documents. If no
>   provided guideline applies, do not flag it.
> - If a deterministic pre-check assigned a severity, you may raise it but never lower it.
> - If ingredients are empty or unmappable, return UNKNOWN. UNKNOWN is correct behavior,
>   not failure.
> - Alternatives must match the *craving* — flavor, salt, texture, temperature — not the
>   nutrition panel. Someone who wants deli meat wants something savory and salty, not a
>   lecture about protein.
> - No jargon, no hedging, no dosages, no diagnoses, no medical advice.

### `/api/identify` — photo path

`inlineData` base64 + prompt returning
`{ name, likelyIngredients[], preparationMethod, confidence, ambiguities[] }`.

Tell it explicitly: *"If you can't determine ingredients with reasonable certainty, say so
in `ambiguities` and lower `confidence`. Do not guess."*

Confidence < 0.6 → the UI asks the user to confirm or correct the identification before
running the verdict. On a health app, asking beats guessing.

### `/api/chat` — two tools

```ts
functionDeclarations: [
  {
    name: 'get_scan_history',
    description: 'Items the user has scanned, with their verdicts.',
    parameters: { type: 'OBJECT', properties: { limit: { type: 'NUMBER' } }, required: ['limit'] },
  },
  {
    name: 'check_food_by_name',
    description: 'Run the full safety pipeline on a food named in conversation.',
    parameters: { type: 'OBJECT', properties: { foodName: { type: 'STRING' } }, required: ['foodName'] },
  },
]
```

Carry trimester and conditions in the system instruction so follow-ups don't need
re-explaining. **Render tool calls as an inline trace** (`→ checked your scans`) so the user
can see where an answer came from.

---

## Design

**Do not build the pregnancy app everyone expects.** The default is soft pink, rounded
everything, a watercolor bump, and the word *journey*. It's a tell, and it undercuts a
product whose entire value is credibility. Also avoid the current AI-design defaults:
cream backgrounds with terracotta accents, near-black with one acid accent.

**Direction: the grocery label, taken seriously.** Nutrition panels, receipt tape, barcode
geometry, ink on coated stock.

```css
--paper:    #FAF9F5;   /* canvas */
--ink:      #16181C;   /* all primary type */
--graphite: #6A7078;   /* secondary, metadata */
--rule:     #E2E0D9;   /* hairlines */
--safe:     #0E7C58;   /* deep green, not mint */
--caution:  #B26A12;   /* ochre — "read this," not "panic" */
--avoid:    #A82F22;   /* brick, not emergency-room red */
--unknown:  #4A5A9E;   /* indigo */
```

**Saturated color appears only in verdict semantics.** Nowhere else. When everything is
paper and ink, one ochre bar carries enormous weight — and severity is legible at a glance.

**Type** (all Google Fonts, load with `next/font`):
- Display · **Bricolage Grotesque** 600/700 — headlines, verdict headline
- Body · **Inter Tight** 400/500 — reasoning, chat
- Utility · **IBM Plex Mono** 400/500 — nutrient values, guideline IDs, the receipt

Scale `12/14/16/20/28/40/56`. Global radius `2px` — not 0 (brutalist affectation), not 16
(every SaaS template since 2021). Mobile-first at 390px; it must work one-handed, because
the user is holding a jar in the other hand.

**Copy voice** — plain, direct, never cute:
- Headlines: *"Avoid this one"* / *"Fine in moderation"* / *"Good for week 22"*
- Unknown: *"No specific pregnancy guidance found for this."* — then show ingredients anyway
- Error: *"Couldn't read that barcode. Try more light, or take a photo instead."*
- Banned words: journey, empowering, mama, bump, glow, wellness

### The signature element — the verdict receipt

The one thing the app is remembered by. Keep everything around it quiet.

The verdict is not a card with a colored border. It's a **receipt strip** — narrow, mono,
torn top and bottom edge — that **unrolls downward on load**. Each reasoning step is a
line item.

```
  ╔═══════════════════════════════════════╗
  ║  ▌▌▌ ▌ ▌▌▌▌ ▌▌ ▌ ▌▌▌  0 4 9 0 0 0 4 1 ║
  ╠═══════════════════════════════════════╣
  ║  DELI TURKEY BREAST                   ║
  ║  Hillshire Farm · 100g                ║
  ╠═══════════════════════════════════════╣
  ║  AVOID THIS ONE                       ║  ← brick, 40px
  ║  WEEK 22 · TRIMESTER 2                ║
  ╟───────────────────────────────────────╢
  ║  FLAGGED                              ║
  ║  ready-to-eat deli meat ........ AVOID║  ← dot leader to value
  ║    listeria risk unless heated        ║
  ║    ↳ FDA-LISTERIA-2022  ↗             ║  ← tappable citation
  ╟───────────────────────────────────────╢
  ║  INSTEAD, TRY                         ║
  ║  → rotisserie chicken, sliced warm    ║
  ║  → canned salmon salad                ║
  ║  → aged hard cheese + crackers        ║
  ╟───────────────────────────────────────╢
  ║  confidence 0.91 · gemini-2.5-flash   ║
  ║  not medical advice — ask your provider║
  ╚═══════════════════════════════════════╝
        [ Save ]      [ Ask about it ]
```

The receipt *is* the reasoning chain made physical — each line one inference, in order,
with its source.

Implementation: torn edges via CSS `mask-image` with a repeating SVG zigzag. Dot leaders
via a flex row with a `border-bottom: 1px dotted` filler span. Max-width ~420px even on
desktop — a wide receipt is not a receipt.

**Severity treatments:**
- `AVOID` brick headline, full-width rules above and below
- `CAUTION` ochre headline, single rule above
- `OK` green headline, no rules — quietest of the four, good news is calm
- `UNKNOWN` indigo headline, **dashed** strip border so uncertainty reads before you do
- `ruleTriggered` → mono tag `HARD FLAG · RULE-MATCHED`
- `confidence < 0.7` → confidence line renders ochre instead of graphite

**Motion:** one showpiece — the unroll. Height 0 → auto with sections revealing at ~40ms
stagger, ~600ms total, `cubic-bezier(.2,.8,.2,1)`. Scanner gets a single hairline sweep.
Everything else 120ms opacity/transform. `prefers-reduced-motion` disables both.

**Quality floor:** works at 360px, visible focus rings, contrast ≥4.5:1, severity never
communicated by color alone, loading and error states everywhere.

---

## Build order

Sequenced to close the loop early. **The app should be genuinely usable — real barcode in,
real verdict out — before any time goes into visual polish.** Deploy at the end of every
milestone; a deployed rough app beats a beautiful localhost one.

Each milestone has a stop condition. Don't move on until it's true.

**1 · Skeleton on screen**
Scaffold Next.js + TS + Tailwind. Install deps. Fonts and color tokens wired into
`globals.css`. Deploy to Vercel and confirm the live URL works. Render one hardcoded
`Verdict` object through a rough, unstyled receipt component.
→ *Stop when: a deployed URL shows a verdict from fake data.*

**2 · Data spine**
All 12 guidelines. Rule matchers. Open Food Facts fetcher. `?demo=1` seed data.
→ *Stop when: a scratch route logs real ingredients for a real barcode, and the rule
matcher correctly hard-flags deli meat.*

**3 · Verdict engine**
Gemini wrapper (8s timeout, one retry, JSON repair), response schema, system instruction,
validator, `/api/verdict`. Test three barcodes: one `OK`, one `CAUTION`, one hard-flagged
`AVOID`.
→ *Stop when: the validator rejects a hand-written response citing a fake guideline ID.
Write that bad response by hand and confirm it's caught before moving on.*

**4 · Real input — the loop closes**
ZXing webcam scanner, three-question setup form, scan → verdict wiring.
→ *Stop when: you can scan an actual product with your phone camera and get a real verdict.
This is the milestone that matters most. Everything after it is improvement.*

**5 · Receipt to final quality**
Unroll animation, torn edges, dot leaders, all four severity states, the `HARD FLAG` tag,
low-confidence treatment. Screenshot it and look at it critically.
→ *Stop when: the `UNKNOWN` and `AVOID` states both look deliberate, not unfinished.*

**6 · Photo path**
`/api/identify`, camera capture tab, the low-confidence confirmation step.
→ *Stop when: photographing an unpackaged food produces a verdict, and a deliberately
blurry photo triggers the confirm step instead of a guess.*

**7 · Chat**
Two tools, execution against localStorage, streamed rendering, inline tool-call trace.
→ *Stop when: "I'm craving something salty, what's safe?" visibly calls a tool and answers
with a food that went through the pipeline.*

**8 · Polish**
Empty states, error states, focus rings, reduced motion, 360px check. Fix the three
worst-looking things. Verify `?demo=1` works with the network off.

If you run short: cut 7, then 6. Never cut the validator in 3 or the stop condition in 4.

---

## Don't

- Generate the guideline corpus with Gemini.
- Return a severity with no citation. Fail closed to `UNKNOWN`.
- Build auth, a database, or a settings page.
- Use pink, watercolor, rounded-everything, or the word *journey*.
- Install a charting, component, or state-management library.
- Skip `?demo=1`.
- Output dosages, diagnoses, or medical advice anywhere.
- Polish a screen before the loop it belongs to actually runs.

---

**First:** confirm the plan in under 150 words, flag anything you think is wrong or
over-scoped, then start milestone 1.
