/**
 * Model ID is rendered on the receipt footer, so it lives in one place and the
 * UI reads it rather than hardcoding a string that can drift.
 *
 * Verified against ai.google.dev on 2026-07-25: `gemini-2.5-flash` is still
 * valid but superseded; `gemini-3.6-flash` is the current stable fast model
 * and handles both text and vision, which the photo path needs.
 */
export const GEMINI_MODEL = "gemini-3.6-flash";

/** Below this, the UI asks the user to confirm the identification. */
export const IDENTIFY_CONFIDENCE_FLOOR = 0.6;

/** Below this, the receipt renders its confidence line in ochre. */
export const LOW_CONFIDENCE_THRESHOLD = 0.7;
