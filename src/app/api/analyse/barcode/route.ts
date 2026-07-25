import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { analyseItem } from "@/lib/gemini";
import { apiError, withTimeout } from "@/lib/api";
import { profileSchema } from "@/lib/schemas";

const schema = z.object({ product: z.record(z.unknown()), profile: profileSchema });

export async function POST(request: NextRequest) {
  try {
    const body = schema.parse(await request.json());
    return NextResponse.json({ analysis: await withTimeout(analyseItem({ profile: body.profile, item: body.product, mode: "barcode" })) });
  } catch (error) {
    return apiError(error);
  }
}
