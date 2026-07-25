import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { summarizeWeek } from "@/lib/gemini";
import { apiError, withTimeout } from "@/lib/api";
import { profileSchema } from "@/lib/schemas";

const schema = z.object({ profile: profileSchema, entries: z.array(z.record(z.unknown())).min(1).max(100) });

export async function POST(request: NextRequest) {
  try {
    const body = schema.parse(await request.json());
    return NextResponse.json({ summary: await withTimeout(summarizeWeek(body.profile, body.entries as never), 40000) });
  } catch (error) {
    return apiError(error);
  }
}
