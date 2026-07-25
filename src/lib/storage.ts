"use client";

import { demoEntries } from "@/data/demo";
import type { ConsumptionEntry, FoodAnalysis, UserProfile, WeeklySummary } from "@/types";

export const DEFAULT_PROFILE: UserProfile = {
  name: "Maya",
  pregnancyWeek: 31,
  heightCm: 165,
  weightKg: 68,
  healthConditions: [],
  dietaryPreferences: [],
  allergies: "",
  avoids: ""
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
  profile: () => read<UserProfile>("bumpsafe-profile", DEFAULT_PROFILE),
  saveProfile: (profile: UserProfile) => write("bumpsafe-profile", profile),
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
    profile: read<UserProfile>("bumpsafe-profile", DEFAULT_PROFILE),
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
