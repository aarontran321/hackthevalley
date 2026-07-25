import { NextResponse } from "next/server";
import { ZodError } from "zod";

const rateLimitSeconds = (message: string) =>
  message.match(/"retryDelay":\s*"(\d+)s"/)?.[1] ?? message.match(/retry in ([\d.]+)s/i)?.[1];

const isRateLimit = (error: unknown, message: string) => {
  const status = typeof error === "object" && error !== null ? (error as { status?: number }).status : undefined;
  return status === 429 || /RESOURCE_EXHAUSTED|exceeded your current quota/i.test(message);
};

export const apiError = (error: unknown) => {
  const errorMessage = error instanceof Error ? error.message : "";
  // A free-tier rate limit is an expected condition, not a fault, so keep it to
  // one line instead of dumping a stack trace into the server log.
  if (isRateLimit(error, errorMessage)) {
    const seconds = rateLimitSeconds(errorMessage);
    console.warn(`Gemini rate limit hit${seconds ? `; retry in ${Math.ceil(Number(seconds))}s` : ""}`);
  } else {
    console.error(error);
  }
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
  if (message === "TIMEOUT") {
    return NextResponse.json({ error: { code: "TIMEOUT", message: "Gemini took too long to respond. Please try again." } }, { status: 504 });
  }
  // Gemini's free tier allows only a handful of requests per minute, which is
  // easy to hit while demoing. Say so plainly instead of implying a failure.
  if (isRateLimit(error, message)) {
    const seconds = rateLimitSeconds(message);
    const wait = seconds ? ` Try again in about ${Math.ceil(Number(seconds))} seconds.` : "";
    return NextResponse.json({ error: { code: "RATE_LIMITED", message: `Gemini's free tier is rate limited and this project just hit it.${wait}` } }, { status: 429 });
  }
  return NextResponse.json({ error: { code: "ANALYSIS_FAILED", message: "We couldn’t complete that analysis. Your information was not saved—please retry or use a demo." } }, { status: 502 });
};

export const withTimeout = async <T>(promise: Promise<T>, milliseconds = 30000): Promise<T> =>
  Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error("TIMEOUT")), milliseconds))
  ]);
