import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { analyseItem } from "@/lib/gemini";
import { apiError, withTimeout } from "@/lib/api";
import { profileSchema } from "@/lib/schemas";

const schema = z.object({ query: z.string().min(2).max(500), profile: profileSchema });

export async function POST(request: NextRequest) {
  try {
    const body = schema.parse(await request.json());
    return NextResponse.json({ analysis: await withTimeout(analyseItem({ profile: body.profile, item: { searchQuery: body.query }, mode: "text" })) });
  } catch (error) {
    return apiError(error);
  }
}
