import { NextResponse } from "next/server";
import { Type, type Schema } from "@google/genai";

import { GeminiError, generateJson, hasApiKey } from "@/lib/gemini";
import type { IdentifiedFood } from "@/lib/types";

/**
 * POST /api/identify — the photo path.
 *
 * Most food has no barcode: a restaurant plate, a deli counter, a farmer's
 * market item. This turns a photo into a candidate ingredient list, which then
 * goes through the same rules -> model -> validate pipeline as a scan.
 *
 * This step identifies. It never adjudicates safety.
 */

const IDENTIFY_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    name: { type: Type.STRING, description: "What the food is, plainly named" },
    likelyIngredients: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: "Ingredients you can actually see or safely infer",
    },
    preparationMethod: {
      type: Type.STRING,
      description: "raw, cooked, cured, fried, baked, unknown",
    },
    confidence: { type: Type.NUMBER, description: "0 to 1" },
    ambiguities: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: "What you could not determine from this image",
    },
  },
  required: ["name", "likelyIngredients", "preparationMethod", "confidence", "ambiguities"],
};

const IDENTIFY_SYSTEM_INSTRUCTION = `
You identify food from a photograph for a pregnancy food-safety tool. You do not
assess safety — a later step does that. Your only job is to say what the food is
and what is likely in it.

- Name the food as a person would say it, not as a menu would.
- List only ingredients you can see or safely infer from what is visible.
- preparationMethod matters more than usual here: raw, lightly cooked, cured and
  fully cooked are different risks downstream. If you cannot tell, say unknown.
- If you can't determine ingredients with reasonable certainty, say so in
  ambiguities and lower confidence. Do not guess.
- A confident wrong answer is worse than an honest uncertain one, because a
  safety verdict is built on top of this.
`.trim();

/** Rough ceiling on the inline payload. Gemini takes larger, but a phone photo
 *  past this is wasted bytes on a connection someone is using in a shop. */
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

const ALLOWED_MIME = new Set(["image/jpeg", "image/png", "image/webp", "image/heic"]);

export async function POST(request: Request) {
  let body: { imageBase64?: string; mimeType?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "bad-request" }, { status: 400 });
  }

  // Accept a bare base64 string or a full data: URL.
  const raw = (body.imageBase64 ?? "").replace(/^data:[^;]+;base64,/, "");
  const mimeType = body.mimeType ?? "image/jpeg";

  if (!raw) {
    return NextResponse.json({ error: "no-image" }, { status: 400 });
  }
  if (!ALLOWED_MIME.has(mimeType)) {
    return NextResponse.json({ error: "unsupported-type", mimeType }, { status: 400 });
  }
  if (raw.length * 0.75 > MAX_IMAGE_BYTES) {
    return NextResponse.json({ error: "image-too-large" }, { status: 413 });
  }
  if (!hasApiKey()) {
    return NextResponse.json({ error: "no-key" }, { status: 503 });
  }

  let parsed: unknown;
  try {
    parsed = await generateJson({
      systemInstruction: IDENTIFY_SYSTEM_INSTRUCTION,
      prompt:
        "Identify this food. If the image is blurry, dark, or ambiguous, lower your confidence and list what you cannot tell in ambiguities.",
      schema: IDENTIFY_SCHEMA,
      image: { data: raw, mimeType },
    });
  } catch (err) {
    const kind = err instanceof GeminiError ? err.kind : "network";
    return NextResponse.json({ error: kind }, { status: kind === "rate-limit" ? 429 : 502 });
  }

  const p = parsed as Partial<IdentifiedFood>;
  if (typeof p.name !== "string" || !Array.isArray(p.likelyIngredients)) {
    return NextResponse.json({ error: "bad-model-output" }, { status: 502 });
  }

  const identified: IdentifiedFood = {
    name: p.name.trim() || "Unidentified food",
    likelyIngredients: p.likelyIngredients.filter((i): i is string => typeof i === "string"),
    preparationMethod: typeof p.preparationMethod === "string" ? p.preparationMethod : "unknown",
    confidence:
      typeof p.confidence === "number" && Number.isFinite(p.confidence)
        ? Math.min(1, Math.max(0, p.confidence))
        : 0,
    ambiguities: Array.isArray(p.ambiguities)
      ? p.ambiguities.filter((a): a is string => typeof a === "string")
      : [],
  };

  // An empty ingredient list is not a usable basis for a verdict, whatever the
  // model claimed about its own confidence.
  if (identified.likelyIngredients.length === 0) {
    identified.confidence = Math.min(identified.confidence, 0.3);
    if (identified.ambiguities.length === 0) {
      identified.ambiguities.push("Could not make out any ingredients.");
    }
  }

  return NextResponse.json({ identified });
}
