import { NextResponse } from "next/server";
import { Type, type Content, type FunctionDeclaration, type Part } from "@google/genai";

import { GEMINI_MODEL_FAST } from "@/lib/config";
import { getChatClient } from "@/lib/gemini";
import { retrieveGuidelines } from "@/lib/retrieval";
import { runRules, ruleSeverityFloor } from "@/lib/rules";
import type { Trimester, Verdict } from "@/lib/types";

/**
 * POST /api/chat — follow-ups a static verdict can't handle.
 *
 * Two tools, both executed here rather than by the model:
 *
 *   get_scan_history    reads the history the client sent with the request.
 *                       All user data lives in localStorage, so the server has
 *                       no other way to see it — and shouldn't.
 *
 *   check_food_by_name  runs layer 1 against the name. A bare food name has no
 *                       ingredient list, so there is nothing to hand the full
 *                       pipeline. Rather than have the model invent ingredients
 *                       — which would let it originate a safety judgment, the
 *                       one thing the spine forbids — this matches the name
 *                       against the deterministic rules, which already key off
 *                       names like "brie" or "swordfish". When nothing matches,
 *                       it says so and suggests scanning, instead of guessing.
 */

const MAX_TURNS = 4;

interface ChatMessage {
  role: "user" | "model";
  text: string;
}

interface ScanContext {
  barcode?: string;
  verdict: Pick<Verdict, "severity" | "headline"> & { item: { name: string } };
  at: string;
}

const TOOLS: FunctionDeclaration[] = [
  {
    name: "get_scan_history",
    description: "Items the user has scanned, with their verdicts.",
    parameters: {
      type: Type.OBJECT,
      properties: { limit: { type: Type.NUMBER } },
      required: ["limit"],
    },
  },
  {
    name: "check_food_by_name",
    description:
      "Check a food named in conversation against the deterministic pregnancy safety rules. Use this before saying whether any specific food is safe.",
    parameters: {
      type: Type.OBJECT,
      properties: { foodName: { type: Type.STRING } },
      required: ["foodName"],
    },
  },
];

function systemInstruction(week: number, trimester: Trimester, conditions: string[]): string {
  return `
You are the assistant inside Tare, a pregnancy food-safety tool. The person you
are talking to is pregnant, currently week ${week}, trimester ${trimester}.
${conditions.length > 0 ? `They have told us: ${conditions.join(", ")}.` : "They listed no conditions."}

You already know their week and conditions — never ask them again.

- Never state that a specific food is safe or unsafe from your own knowledge.
  Call check_food_by_name first and answer from what it returns.
- When they ask what they *can* eat, check two or three concrete options and
  recommend the ones that came back clean. A no-match is useful news, not a
  dead end: say the food isn't flagged by any guideline Tare checks and offer
  it. Only tell them to scan something if they asked about a specific packaged
  product, or if a rule did match and preparation is what decides it.
- Answer the craving they actually described — salty, sweet, cold, crunchy —
  not the nutrition panel.
- For questions about what they have eaten or scanned, call get_scan_history.
- Cite guideline IDs when the tool gives you them.
- Plain, direct, short. No jargon, no hedging, no dosages, no diagnoses, no
  medical advice. Never use the words journey, empowering, mama, bump, or glow.
- Write plain prose. No markdown, no asterisks, no bullet syntax, no headings —
  the reply is rendered as raw text and any markup shows up literally.
`.trim();
}

/** Layer 1 against a bare name. Deterministic — no model inference involved. */
function checkFoodByName(foodName: string, trimester: Trimester, conditions: string[]) {
  const item = { name: foodName, ingredients: [], nutrition: {} };
  const matches = runRules(item, { trimester, conditions });
  const guidelines = retrieveGuidelines(item, matches, { conditions });

  return {
    foodName,
    ruleMatched: matches.length > 0,
    severity: ruleSeverityFloor(matches) ?? "NO_RULE_MATCH",
    flags: matches.map((m) => ({
      trigger: m.ingredient,
      severity: m.severity,
      reason: m.plainReason,
      guidelineIds: m.guidelineIds,
    })),
    relevantGuidelines: guidelines.map((g) => ({
      id: g.id,
      title: g.title,
      summary: g.summary,
    })),
    note:
      matches.length === 0
        ? "No pregnancy hazard rule matches this food by name — say so plainly and treat it as a reasonable suggestion. Do not call it 'safe' outright and do not tell the user to scan unless they asked about a specific packaged product, because a name has no ingredient list and preparation still matters."
        : "A deterministic rule matched. Report this severity; you may not lower it.",
  };
}

export async function POST(request: Request) {
  let body: {
    messages?: ChatMessage[];
    context?: { week?: number; trimester?: number; conditions?: string[]; history?: ScanContext[] };
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "bad-request" }, { status: 400 });
  }

  const messages = Array.isArray(body.messages) ? body.messages : [];
  if (messages.length === 0) {
    return NextResponse.json({ error: "no-messages" }, { status: 400 });
  }

  const ctx = body.context ?? {};
  const week = typeof ctx.week === "number" ? ctx.week : 20;
  const trimester = ([1, 2, 3].includes(Number(ctx.trimester))
    ? Number(ctx.trimester)
    : 2) as Trimester;
  const conditions = Array.isArray(ctx.conditions) ? ctx.conditions : [];
  const history = Array.isArray(ctx.history) ? ctx.history : [];

  let ai;
  try {
    ai = getChatClient();
  } catch {
    return NextResponse.json({ error: "no-key" }, { status: 503 });
  }

  const contents: Content[] = messages.map((m) => ({
    role: m.role === "model" ? "model" : "user",
    parts: [{ text: m.text }],
  }));

  const trace: Array<{ tool: string; label: string }> = [];

  try {
    for (let turn = 0; turn < MAX_TURNS; turn++) {
      const res = await ai.models.generateContent({
        model: GEMINI_MODEL_FAST,
        contents,
        config: {
          systemInstruction: systemInstruction(week, trimester, conditions),
          tools: [{ functionDeclarations: TOOLS }],
          temperature: 0.3,
        },
      });

      const calls = res.functionCalls ?? [];
      if (calls.length === 0) {
        return NextResponse.json({ reply: res.text ?? "", trace });
      }

      // Push back the model's own content, not a reconstruction. Gemini 3.x
      // attaches a thoughtSignature to functionCall parts and rejects the next
      // turn with a 400 if it doesn't come back verbatim — rebuilding the turn
      // from res.functionCalls silently drops it.
      const modelTurn = res.candidates?.[0]?.content;
      contents.push(
        modelTurn ?? { role: "model", parts: calls.map((c) => ({ functionCall: c })) },
      );

      const responses: Part[] = calls.map((call) => {
        const args = (call.args ?? {}) as Record<string, unknown>;
        let result: Record<string, unknown>;

        if (call.name === "get_scan_history") {
          const limit = Math.min(20, Math.max(1, Number(args.limit) || 5));
          const items = history.slice(0, limit).map((h) => ({
            name: h.verdict.item.name,
            severity: h.verdict.severity,
            headline: h.verdict.headline,
            at: h.at,
          }));
          result = { count: items.length, items };
          trace.push({
            tool: "get_scan_history",
            label: `checked your last ${items.length} scan${items.length === 1 ? "" : "s"}`,
          });
        } else if (call.name === "check_food_by_name") {
          const foodName = String(args.foodName ?? "").slice(0, 80);
          result = checkFoodByName(foodName, trimester, conditions);
          trace.push({ tool: "check_food_by_name", label: `ran the rules on ${foodName}` });
        } else {
          result = { error: `unknown tool ${call.name}` };
        }

        return { functionResponse: { name: call.name ?? "", response: result } };
      });

      contents.push({ role: "user", parts: responses });
    }

    return NextResponse.json({
      reply: "That took more steps than expected. Try asking it more simply.",
      trace,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`[chat] failed: ${msg.slice(0, 400)}`);
    const rateLimited = /429|quota|RESOURCE_EXHAUSTED/i.test(msg);
    return NextResponse.json(
      { error: rateLimited ? "rate-limit" : "network" },
      { status: rateLimited ? 429 : 502 },
    );
  }
}
