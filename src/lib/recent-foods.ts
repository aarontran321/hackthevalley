import type { ConsumptionEntry, FoodAnalysis, SafetyStatus } from "@/types";

/** Where a recent food came from. An item can be both scanned and logged. */
export type RecentSource = "scanned" | "logged";

export type RecentFood = {
  key: string;
  name: string;
  status: SafetyStatus;
  /** ISO timestamp of the most recent time this food appeared. */
  at: string;
  /** Set when a full analysis page exists to link to. */
  analysisId?: string;
  sources: RecentSource[];
  mealType?: ConsumptionEntry["mealType"];
  isDemo?: boolean;
};

/**
 * The same food often exists twice: once as a scan and again as a tracker entry.
 * Collapse on name so the profile shows six distinct foods rather than three
 * duplicated pairs.
 */
const normalize = (name: string) => name.trim().toLowerCase();

/**
 * Merge scans and logged entries into one reverse-chronological activity list.
 *
 * @param limit Maximum foods to return; pass `Infinity` for all of them.
 */
export function mergeRecentFoods(
  analyses: FoodAnalysis[],
  entries: ConsumptionEntry[],
  limit = 6
): RecentFood[] {
  const byName = new Map<string, RecentFood>();

  const add = (candidate: RecentFood) => {
    const existing = byName.get(candidate.key);
    if (!existing) {
      byName.set(candidate.key, candidate);
      return;
    }
    byName.set(candidate.key, {
      ...existing,
      // Keep whichever sighting is newer, but never lose an analysis link.
      at: candidate.at > existing.at ? candidate.at : existing.at,
      analysisId: existing.analysisId ?? candidate.analysisId,
      mealType: existing.mealType ?? candidate.mealType,
      sources: [...new Set([...existing.sources, ...candidate.sources])],
      isDemo: existing.isDemo && candidate.isDemo
    });
  };

  for (const analysis of analyses) {
    add({
      key: normalize(analysis.itemName),
      name: analysis.itemName,
      status: analysis.status,
      at: analysis.createdAt,
      analysisId: analysis.id,
      sources: ["scanned"],
      isDemo: analysis.isDemo
    });
  }

  for (const entry of entries) {
    add({
      key: normalize(entry.itemName),
      name: entry.itemName,
      status: entry.safetyStatus,
      at: entry.timestamp,
      analysisId: entry.originalAnalysis?.id,
      sources: ["logged"],
      mealType: entry.mealType,
      isDemo: entry.originalAnalysis?.isDemo
    });
  }

  return [...byName.values()]
    .sort((a, b) => b.at.localeCompare(a.at))
    .slice(0, limit);
}

/** Counts for the profile's at-a-glance strip. */
export function activityTotals(analyses: FoodAnalysis[], entries: ConsumptionEntry[]) {
  const flagged = (status: SafetyStatus) =>
    status === "use_caution" || status === "consider_avoiding";
  return {
    scanned: analyses.length,
    logged: entries.length,
    needsCare:
      analyses.filter((item) => flagged(item.status)).length +
      entries.filter((item) => flagged(item.safetyStatus)).length
  };
}
