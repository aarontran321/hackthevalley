import { GoogleGenAI, type Schema } from "@google/genai";

import { GEMINI_MODEL } from "./config";

/**
 * Thin wrapper over the Gemini SDK: one timeout, one retry, and JSON repair.
 *
 * Deliberately dumb. It returns parsed JSON or it fails — it never inspects or
 * fixes up the content, because judging the content is layer 3's job and
 * splitting that across two files is how a validator quietly stops validating.
 */

/**
 * The spec called for 8s. Measured against gemini-3.6-flash with a full
 * six-document prompt, real calls land at 6.5-7.2s, so 8s aborts a healthy
 * request roughly as often as it catches a sick one. 15s leaves headroom
 * without making someone in an aisle wait on a hung request.
 */
const TIMEOUT_MS = 15000;

let client: GoogleGenAI | null = null;

function getClient(): GoogleGenAI {
  if (!client) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new GeminiError("no-key", "GEMINI_API_KEY is not set");
    client = new GoogleGenAI({ apiKey });
  }
  return client;
}

export type GeminiFailure =
  | "no-key"
  | "timeout"
  | "network"
  | "rate-limit"
  | "unparseable"
  | "empty";

/** Retrying these just wastes the user's remaining quota or their patience. */
const NO_RETRY: ReadonlySet<GeminiFailure> = new Set(["no-key", "rate-limit", "timeout"]);

export class GeminiError extends Error {
  constructor(
    readonly kind: GeminiFailure,
    message: string,
  ) {
    super(message);
    this.name = "GeminiError";
  }
}

export function hasApiKey(): boolean {
  return Boolean(process.env.GEMINI_API_KEY);
}

/**
 * Models sometimes wrap JSON in prose or a markdown fence even in JSON mode.
 * Recover the outermost object rather than throwing away a good response.
 */
export function repairJson(text: string): unknown {
  const trimmed = text.trim();

  const attempts = [
    trimmed,
    // Strip a ```json ... ``` fence.
    trimmed.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, ""),
  ];

  // Fall back to the outermost brace pair.
  const first = trimmed.indexOf("{");
  const last = trimmed.lastIndexOf("}");
  if (first !== -1 && last > first) attempts.push(trimmed.slice(first, last + 1));

  for (const a of attempts) {
    for (const candidate of [a, a.replace(/,(\s*[}\]])/g, "$1")]) {
      try {
        return JSON.parse(candidate);
      } catch {
        // try the next shape
      }
    }
  }

  throw new GeminiError("unparseable", `could not parse JSON from: ${trimmed.slice(0, 200)}`);
}

export async function generateJson({
  systemInstruction,
  prompt,
  schema,
  image,
  temperature = 0.2,
  model = GEMINI_MODEL,
  thinkingBudget = -1,
}: {
  systemInstruction: string;
  prompt: string;
  schema: Schema;
  /** Base64 payload for the photo path. Sent inline; never stored. */
  image?: { data: string; mimeType: string };
  temperature?: number;
  model?: string;
  /**
   * 0 disables extended thinking, -1 is automatic (the config is omitted).
   *
   * Left on automatic deliberately. Disabling thinking looked like a 2.8x
   * speedup on one sample (5.7s -> 2.0s), but on the real Coca-Cola prompt it
   * measured 16.6s against 5.5s for automatic — a timeout, not a speedup.
   * Automatic held at ~5.5s across every run; budget=0 swung between 2s and
   * 16.6s. Don't re-enable this without measuring more than one prompt.
   *
   * Also note gemini-3.5-flash-lite rejects budget=0 outright with a 400.
   */
  thinkingBudget?: number;
}): Promise<unknown> {
  const ai = getClient();

  const attempt = async (): Promise<unknown> => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

    try {
      const res = await ai.models.generateContent({
        model,
        contents: image
          ? [
              {
                role: "user",
                parts: [
                  { inlineData: { data: image.data, mimeType: image.mimeType } },
                  { text: prompt },
                ],
              },
            ]
          : prompt,
        config: {
          systemInstruction,
          responseMimeType: "application/json",
          responseSchema: schema,
          temperature,
          abortSignal: controller.signal,
          ...(thinkingBudget >= 0 ? { thinkingConfig: { thinkingBudget } } : {}),
        },
      });

      const text = res.text;
      if (!text || !text.trim()) throw new GeminiError("empty", "model returned no text");

      return repairJson(text);
    } catch (err) {
      if (err instanceof GeminiError) throw err;
      throw new GeminiError(classify(err, controller.signal), describe(err));
    } finally {
      clearTimeout(timer);
    }
  };

  try {
    return await attempt();
  } catch (first) {
    // One retry, but only for failures a second attempt can actually fix.
    // Transient 5xx and truncated JSON recover; a 429 or a timeout does not.
    if (first instanceof GeminiError && NO_RETRY.has(first.kind)) throw first;
    try {
      return await attempt();
    } catch {
      throw first;
    }
  }
}

function describe(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

/**
 * The SDK surfaces quota errors as an ApiError whose message carries the HTTP
 * status as JSON, and aborts inconsistently across runtimes — so check the
 * signal itself rather than trusting the error name.
 */
function classify(err: unknown, signal: AbortSignal): GeminiFailure {
  if (signal.aborted) return "timeout";

  const msg = describe(err);
  const status =
    (err as { status?: number })?.status ??
    Number(msg.match(/"code"\s*:\s*(\d{3})/)?.[1] ?? NaN);

  if (status === 429 || /quota|rate limit|RESOURCE_EXHAUSTED/i.test(msg)) {
    return "rate-limit";
  }
  if (err instanceof Error && /abort/i.test(err.name + msg)) return "timeout";
  return "network";
}
