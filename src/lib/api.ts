import { NextResponse } from "next/server";
import { ZodError } from "zod";

export const apiError = (error: unknown) => {
  console.error(error);
  if (error instanceof ZodError) {
    return NextResponse.json({ error: { code: "INVALID_INPUT", message: "Some submitted details were invalid.", details: error.flatten() } }, { status: 400 });
  }
  const message = error instanceof Error ? error.message : "";
  if (message === "GEMINI_NOT_CONFIGURED") {
    return NextResponse.json({ error: { code: "DEMO_ONLY", message: "Live AI is not configured. Try one of the clearly labeled demo examples." } }, { status: 503 });
  }
  if (message === "INVALID_IMAGE") {
    return NextResponse.json({ error: { code: "INVALID_IMAGE", message: "Please upload a JPEG, PNG, or WebP image." } }, { status: 400 });
  }
  return NextResponse.json({ error: { code: "ANALYSIS_FAILED", message: "We couldn’t complete that analysis. Your information was not saved—please retry or use a demo." } }, { status: 502 });
};

export const withTimeout = async <T>(promise: Promise<T>, milliseconds = 30000): Promise<T> =>
  Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error("TIMEOUT")), milliseconds))
  ]);
