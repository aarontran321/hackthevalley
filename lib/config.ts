/**
 * Model ID is rendered on the receipt footer, so it lives in one place and the
 * UI reads it rather than hardcoding a string that can drift.
 *
 * Measured against this key on 2026-07-25, not taken from the docs:
 *   gemini-2.5-flash       404 — the spec's original ID is gone from the API
 *   gemini-3.6-flash       works, but free-tier quota is 20 requests PER DAY
 *   gemini-3.5-flash       works, own separate daily bucket  <- chosen
 *   gemini-3.5-flash-lite  works, ~440ms, own bucket
 *
 * Free-tier quota is per-project-per-model, so switching models buys a fresh
 * allowance. That is a workaround, not a fix: sustained live testing needs
 * billing enabled. Demo mode (?demo=1) makes no API calls at all by design.
 */
export const GEMINI_MODEL = "gemini-3.5-flash";

/** Same family, ~4x faster, separate quota bucket. Fallback if the main one is exhausted. */
export const GEMINI_MODEL_FAST = "gemini-3.5-flash-lite";

/** Below this, the UI asks the user to confirm the identification. */
export const IDENTIFY_CONFIDENCE_FLOOR = 0.6;

/** Below this, the receipt renders its confidence line in ochre. */
export const LOW_CONFIDENCE_THRESHOLD = 0.7;
