import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { chatAboutWeek } from "@/lib/gemini";
import { apiError, withTimeout } from "@/lib/api";
import { profileSchema } from "@/lib/schemas";

const schema = z.object({
  profile: profileSchema,
  entries: z.array(z.record(z.unknown())).min(1).max(100),
  summary: z.record(z.unknown()).nullable().optional(),
  messages: z
    .array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().min(1).max(1000) }))
    .min(1)
    .max(12)
});

export async function POST(request: NextRequest) {
  try {
    const body = schema.parse(await request.json());
    return NextResponse.json({
      message: await withTimeout(
        chatAboutWeek(body.profile, body.entries as never, (body.summary ?? null) as never, body.messages),
        30000
      )
    });
  } catch (error) {
    return apiError(error);
  }
}
