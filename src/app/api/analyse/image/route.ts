import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { analyseItem } from "@/lib/gemini";
import { apiError, withTimeout } from "@/lib/api";
import { profileSchema } from "@/lib/schemas";

export const runtime = "nodejs";
const schema = z.object({ image: z.string().max(10_000_000), profile: profileSchema });

export async function POST(request: NextRequest) {
  try {
    const body = schema.parse(await request.json());
    return NextResponse.json({ analysis: await withTimeout(analyseItem({ profile: body.profile, item: { description: "Uploaded food photo" }, imageDataUrl: body.image, mode: "image" }), 45000) });
  } catch (error) {
    return apiError(error);
  }
}
