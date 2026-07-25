"use client";

import { demoEntries } from "@/data/demo";
import { weekFor, type ConsumptionEntry, type FoodAnalysis, type UserProfile, type WeeklySummary } from "@/types";

export const DEFAULT_PROFILE: UserProfile = {
  name: "Maya",
  pregnancyWeek: 31,
  dateBasis: "due",
  dateValue: "",
  babies: "one",
  units: "metric",
  heightCm: 165,
  prePregnancyWeightKg: 68,
  currentWeightKg: null,
  age: 30,
  healthConditions: [],
  dietaryPreferences: [],
  allergies: "",
  noAllergies: false,
  avoids: ""
};

/** Profiles saved before a field existed are missing it, so fill the gaps and
 *  recompute the week rather than trusting whatever was stored. */
const round1 = (value: number) => Math.round(value * 10) / 10;

const hydrateProfile = (stored: Partial<UserProfile>): UserProfile => {
  const merged = { ...DEFAULT_PROFILE, ...stored };
  // Rebuild from the known keys so fields retired in older versions do not
  // ride along into the payload the model sees.
  const clean = Object.fromEntries(
    Object.keys(DEFAULT_PROFILE).map((key) => [key, merged[key as keyof UserProfile]])
  ) as UserProfile;
  return {
    ...clean,
    pregnancyWeek: weekFor(clean),
    // Unit conversions leave long floats behind; nobody needs 72.57477920000001 kg.
    heightCm: round1(clean.heightCm),
    prePregnancyWeightKg: round1(clean.prePregnancyWeightKg),
    currentWeightKg: clean.currentWeightKg === null ? null : round1(clean.currentWeightKg)
  };
};

const read = <T>(key: string, fallback: T): T => {
  if (typeof window === "undefined") return fallback;
  try {
    const value = localStorage.getItem(key);
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
};

const write = <T>(key: string, value: T) => {
  localStorage.setItem(key, JSON.stringify(value));
  window.dispatchEvent(new Event("bumpsafe-storage"));
};

const drop = (...keys: string[]) => {
  keys.forEach((key) => localStorage.removeItem(key));
  window.dispatchEvent(new Event("bumpsafe-storage"));
};

export const storage = {
  profile: () => hydrateProfile(read<Partial<UserProfile>>("bumpsafe-profile", DEFAULT_PROFILE)),
  saveProfile: (profile: UserProfile) => write("bumpsafe-profile", hydrateProfile(profile)),
  analyses: () => read<FoodAnalysis[]>("bumpsafe-analyses", []),
  saveAnalysis: (analysis: FoodAnalysis) => {
    const existing = read<FoodAnalysis[]>("bumpsafe-analyses", []);
    write("bumpsafe-analyses", [analysis, ...existing.filter((item) => item.id !== analysis.id)].slice(0, 20));
  },
  analysis: (id: string) => read<FoodAnalysis[]>("bumpsafe-analyses", []).find((item) => item.id === id),
  entries: () => read<ConsumptionEntry[]>("bumpsafe-entries", []),
  saveEntries: (entries: ConsumptionEntry[]) => write("bumpsafe-entries", entries),
  seedEntries: () => write("bumpsafe-entries", demoEntries),
  summary: () => read<WeeklySummary | null>("bumpsafe-summary", null),
  saveSummary: (summary: WeeklySummary) => write("bumpsafe-summary", summary),

  /** Forgets one food everywhere it appears, both as a scan and as a log entry. */
  forgetFood: (name: string) => {
    const match = (value: string) =>
      value.trim().toLowerCase() === name.trim().toLowerCase();
    write(
      "bumpsafe-analyses",
      read<FoodAnalysis[]>("bumpsafe-analyses", []).filter((item) => !match(item.itemName))
    );
    write(
      "bumpsafe-entries",
      read<ConsumptionEntry[]>("bumpsafe-entries", []).filter((item) => !match(item.itemName))
    );
  },

  /** Everything this browser holds, for the profile's export action. */
  exportAll: () => ({
    exportedAt: new Date().toISOString(),
    profile: hydrateProfile(read<Partial<UserProfile>>("bumpsafe-profile", DEFAULT_PROFILE)),
    analyses: read<FoodAnalysis[]>("bumpsafe-analyses", []),
    entries: read<ConsumptionEntry[]>("bumpsafe-entries", []),
    summary: read<WeeklySummary | null>("bumpsafe-summary", null)
  }),

  /** Clears scans, logs and summaries but keeps the profile intact. */
  clearActivity: () => drop("bumpsafe-analyses", "bumpsafe-entries", "bumpsafe-summary"),

  /** Full reset, including the profile. */
  clearEverything: () =>
    drop("bumpsafe-analyses", "bumpsafe-entries", "bumpsafe-summary", "bumpsafe-profile")
};
