import type { Trimester, Verdict } from "./types";

/**
 * Everything the user tells us lives in localStorage and nowhere else. No
 * account, no server, nothing to leak.
 */

export type DietPattern = "omnivore" | "pescatarian" | "vegetarian" | "vegan";

export interface Profile {
  week: number;
  diet: DietPattern;
  /** Slugs, e.g. 'gestational-diabetes'. Only that one drives a layer-1 rule;
   *  the rest reach the model through the prompt context. */
  conditions: string[];
}

export interface ScanRecord {
  barcode?: string;
  verdict: Verdict;
  /** ISO timestamp. */
  at: string;
}

const PROFILE_KEY = "tare.profile.v1";
const HISTORY_KEY = "tare.history.v1";
const HISTORY_LIMIT = 50;

export const DIET_LABELS: Record<DietPattern, string> = {
  omnivore: "Everything",
  pescatarian: "Fish, no meat",
  vegetarian: "No meat or fish",
  vegan: "No animal products",
};

export const CONDITION_OPTIONS: Array<{ slug: string; label: string }> = [
  { slug: "gestational-diabetes", label: "Gestational diabetes" },
  { slug: "high-blood-pressure", label: "High blood pressure" },
  { slug: "iron-deficiency", label: "Low iron" },
];

export function trimesterForWeek(week: number): Trimester {
  if (week <= 13) return 1;
  if (week <= 27) return 2;
  return 3;
}

function readJson<T>(key: string): T | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    // Corrupt or unavailable storage is not worth crashing the app over.
    return null;
  }
}

function writeJson(key: string, value: unknown): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Private mode / quota. Losing a saved scan is survivable.
  }
}

export function loadProfile(): Profile | null {
  const p = readJson<Partial<Profile>>(PROFILE_KEY);
  if (!p || typeof p.week !== "number") return null;
  return {
    week: Math.min(42, Math.max(1, p.week)),
    diet: (p.diet ?? "omnivore") as DietPattern,
    conditions: Array.isArray(p.conditions) ? p.conditions : [],
  };
}

export function saveProfile(profile: Profile): void {
  writeJson(PROFILE_KEY, profile);
}

export function clearProfile(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(PROFILE_KEY);
}

export function loadHistory(): ScanRecord[] {
  return readJson<ScanRecord[]>(HISTORY_KEY) ?? [];
}

export function saveScan(record: ScanRecord): void {
  const next = [record, ...loadHistory()].slice(0, HISTORY_LIMIT);
  writeJson(HISTORY_KEY, next);
}
