import {
  Type,
  type Content,
  type FunctionCall,
  type FunctionDeclaration,
  type Part,
} from "@google/genai";
import { GoogleGenAI } from "@google/genai";
import { NextResponse } from "next/server";

import { conditionSlugs, statusForSeverity, trimesterForWeek } from "@/lib/spine/analysis";
import { GUIDELINE_BY_ID } from "@/lib/spine/guidelines";
import { retrieveGuidelines } from "@/lib/spine/retrieval";
import { runRules, ruleSeverityFloor } from "@/lib/spine/rules";
import type { Trimester } from "@/lib/spine/types";
import type { UserProfile } from "@/types";

/**
 * POST /api/ask — the general assistant behind the Ask panel.
 *
 * Unlike /api/chat, this needs no prior analysis and no logged entries: it is
 * reachable from any page at any time, including on a first visit.
 *
 * Two tools, both executed here rather than by the model:
 *
 *   get_scan_history    reads the history the client sent with the request.
 *                       Everything lives in localStorage, so the server has no
 *                       other way to see it — and shouldn't.
 *
 *   check_food_by_name  runs the deterministic rules against the name. A bare
 *                       food name has no ingredient list, so rather than let
 *                       the model invent one — which would let it originate a
 *                       safety judgement, the one thing the spine forbids —
 *                       this matches the name against rules that already key
 *                       off terms like "brie" or "swordfish".
 */

const MAX_TURNS = 4;
const model = process.env.GEMINI_MODEL || "gemini-3.5-flash";

interface AskMessage {
  role: "user" | "model";
  text: string;
}

interface ScanContext {
  itemName: string;
  status: string;
  summary?: string;
  createdAt?: string;
}

const TOOLS: FunctionDeclaration[] = [
  {
    name: "get_scan_history",
    description: "Foods the user has already scanned, with the verdict each one got.",
    parameters: {
      type: Type.OBJECT,
      properties: { limit: { type: Type.NUMBER } },
      required: ["limit"],
    },
  },
  {
    name: "check_food_by_name",
    description:
      "Check a food named in conversation against the deterministic pregnancy safety rules. Use this before saying anything about whether a specific food is suitable.",
    parameters: {
      type: Type.OBJECT,
      properties: { foodName: { type: Type.STRING } },
      required: ["foodName"],
    },
  },
];

function systemInstruction(profile: UserProfile, trimester: Trimester): string {
  const conditions = profile.healthConditions ?? [];
  return `
You are the assistant inside BumpSafe, a pregnancy food-safety tool. The person
you are talking to is pregnant, currently week ${profile.pregnancyWeek}, trimester ${trimester}.
${profile.babies === "twins" ? "They are carrying twins." : profile.babies === "three_plus" ? "They are carrying three or more babies." : ""}
${profile.age ? `They are ${profile.age}.` : ""}
${conditions.length > 0 ? `They have told us: ${conditions.join(", ")}.` : "They listed no conditions."}
${profile.noAllergies ? "They have confirmed they have no food allergies." : profile.allergies ? `Allergies: ${profile.allergies}.` : ""}
${profile.avoids ? `They avoid: ${profile.avoids}.` : ""}

You already know their week and conditions — never ask again.

- Never state that a specific food is suitable or unsuitable from your own
  knowledge. Call check_food_by_name first and answer from what it returns.
- When they ask what they *can* eat, check two or three concrete options and
  recommend the ones that came back clean. A no-match is useful news, not a
  dead end: say the food isn't flagged by any guideline BumpSafe checks and
  offer it. Only suggest scanning if they asked about a specific packaged
  product, or if a rule matched and preparation is what decides it.
- Answer the craving they actually described — salty, sweet, cold, crunchy —
  not the nutrition panel.
- For questions about what they have eaten or scanned, call get_scan_history.
- Cite source IDs when a tool returns them.
- Plain, direct, short. No diagnoses, no dosages, no supplement advice, no
  absolute guarantees. Respect their allergies and the foods they avoid.
- Write plain prose. No markdown, no asterisks, no bullet syntax — the reply is
  rendered as raw text and any markup shows up literally.
`.trim();
}

/** Layer 1 against a bare name. Deterministic — no model inference involved. */
function checkFoodByName(foodName: string, trimester: Trimester, conditions: string[]) {
  const item = { name: foodName, ingredients: [], nutrition: {} };
  const matches = runRules(item, { trimester, conditions });
  const guidelines = retrieveGuidelines(item, matches, { conditions });
  const floor = ruleSeverityFloor(matches);

  return {
    foodName,
    ruleMatched: matches.length > 0,
    status: floor ? statusForSeverity(floor) : "no_rule_match",
    flags: matches.map((m) => ({
      trigger: m.ingredient,
      status: statusForSeverity(m.severity),
      reason: m.plainReason,
      sourceIds: m.guidelineIds,
    })),
    relevantSources: guidelines.map((g) => ({ id: g.id, title: g.title, summary: g.summary })),
    note:
      matches.length === 0
        ? "No pregnancy hazard rule matches this food by name — say so plainly and treat it as a reasonable suggestion. Do not call it 'safe' outright, because a name has no ingredient list and preparation still matters."
        : "A deterministic rule matched. Report this status; you may not lower it.",
  };
}

/**
 * No model available. The rules still are — and they read plain text — so run
 * them straight against the question. Someone asking "can I eat brie" gets a
 * real cited answer even with the Gemini account empty.
 */
function deterministicAnswer(question: string, trimester: Trimester, conditions: string[]) {
  const result = checkFoodByName(question, trimester, conditions);
  if (!result.ruleMatched) {
    return {
      reply:
        "The assistant is unavailable right now, so I checked your question against the safety rules directly. Nothing in them matched. That isn't a clearance — scan the actual product for a real check.",
      trace: [{ tool: "check_food_by_name", label: "ran the rules on your question" }],
    };
  }

  const flag = result.flags[0];
  const cited = flag.sourceIds
    .map((id) => GUIDELINE_BY_ID.get(id)?.title ?? id)
    .join("; ");

  return {
    reply: `The assistant is unavailable right now, so I checked your question against the safety rules directly.\n\n${flag.trigger}: ${flag.reason}\n\nSource: ${cited} (${flag.sourceIds.join(", ")}).`,
    trace: [{ tool: "check_food_by_name", label: `ran the rules on ${flag.trigger}` }],
  };
}

export async function POST(request: Request) {
  let body: { messages?: AskMessage[]; profile?: UserProfile; history?: ScanContext[] };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "bad-request" }, { status: 400 });
  }

  const messages = Array.isArray(body.messages) ? body.messages : [];
  if (messages.length === 0) {
    return NextResponse.json({ error: "no-messages" }, { status: 400 });
  }

  const profile = body.profile;
  if (!profile || typeof profile.pregnancyWeek !== "number") {
    return NextResponse.json({ error: "no-profile" }, { status: 400 });
  }

  const trimester = trimesterForWeek(profile.pregnancyWeek);
  const conditions = conditionSlugs(profile);
  // History is optional on purpose. Their /api/chat requires a prior analysis
  // and /api/week-chat requires a non-empty log, so both 400 on a first visit.
  const history = Array.isArray(body.history) ? body.history : [];
  const lastUserText = [...messages].reverse().find((m) => m.role === "user")?.text ?? "";

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (obj: unknown) =>
        controller.enqueue(encoder.encode(`${JSON.stringify(obj)}\n`));

      const degrade = (reason: string) => {
        const { reply, trace } = deterministicAnswer(lastUserText, trimester, conditions);
        for (const t of trace) send({ type: "trace", ...t });
        send({ type: "degraded", reason });
        send({ type: "text", delta: reply });
        send({ type: "done" });
        controller.close();
      };

      if (!process.env.GEMINI_API_KEY) return degrade("no-key");
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

      const contents: Content[] = messages.map((m) => ({
        role: m.role === "model" ? "model" : "user",
        parts: [{ text: m.text }],
      }));

      try {
        for (let turn = 0; turn < MAX_TURNS; turn++) {
          const result = await ai.models.generateContentStream({
            model,
            contents,
            config: {
              systemInstruction: systemInstruction(profile, trimester),
              tools: [{ functionDeclarations: TOOLS }],
              temperature: 0.3,
            },
          });

          const calls: FunctionCall[] = [];
          const modelParts: Part[] = [];

          for await (const chunk of result) {
            for (const part of chunk.candidates?.[0]?.content?.parts ?? []) {
              // Keep every part verbatim: Gemini 3.x hangs a thoughtSignature
              // off functionCall parts and 400s the next turn if it does not
              // come back exactly as sent.
              modelParts.push(part);
              if (part.functionCall) calls.push(part.functionCall);
            }
            const delta = chunk.text;
            if (delta) send({ type: "text", delta });
          }

          if (calls.length === 0) {
            send({ type: "done" });
            controller.close();
            return;
          }

          contents.push({ role: "model", parts: modelParts });

          const responses: Part[] = calls.map((call) => {
            const args = (call?.args ?? {}) as Record<string, unknown>;
            let result: Record<string, unknown>;
            let label: string;

            if (call?.name === "get_scan_history") {
              const limit = Math.min(20, Math.max(1, Number(args.limit) || 5));
              const items = history.slice(0, limit);
              result = { count: items.length, items };
              label =
                items.length === 0
                  ? "checked your scans — none saved yet"
                  : `checked your last ${items.length} scan${items.length === 1 ? "" : "s"}`;
            } else if (call?.name === "check_food_by_name") {
              const foodName = String(args.foodName ?? "").slice(0, 80);
              result = checkFoodByName(foodName, trimester, conditions);
              label = `ran the rules on ${foodName}`;
            } else {
              result = { error: `unknown tool ${call?.name}` };
              label = "unknown tool";
            }

            send({ type: "trace", tool: call?.name ?? "unknown", label });
            return { functionResponse: { name: call?.name ?? "", response: result } };
          });

          contents.push({ role: "user", parts: responses });
        }

        send({ type: "text", delta: "That took more steps than expected. Try asking more simply." });
        send({ type: "done" });
        controller.close();
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        const status = (err as { status?: number })?.status;
        const rateLimited =
          status === 429 || /RESOURCE_EXHAUSTED|quota|credits are depleted/i.test(msg);
        console.warn(`[ask] model unavailable: ${msg.slice(0, 160)}`);
        return degrade(rateLimited ? "rate-limit" : "network");
      }
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "application/x-ndjson; charset=utf-8",
      "cache-control": "no-store",
      "x-accel-buffering": "no",
    },
  });
}
