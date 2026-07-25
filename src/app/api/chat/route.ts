import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { chatAboutAnalysis } from "@/lib/gemini";
import { apiError, withTimeout } from "@/lib/api";
import { foodAnalysisSchema, profileSchema } from "@/lib/schemas";

const schema = z.object({
  profile: profileSchema,
  analysis: foodAnalysisSchema.passthrough(),
  messages: z.array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().min(1).max(1000) })).min(1).max(12)
});

export async function POST(request: NextRequest) {
  try {
    const body = schema.parse(await request.json());
    return NextResponse.json({ message: await withTimeout(chatAboutAnalysis(body.profile, body.analysis as never, body.messages), 30000) });
  } catch (error) {
    return apiError(error);
  }
}
