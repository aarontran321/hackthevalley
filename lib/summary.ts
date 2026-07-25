import { GUIDELINE_BY_ID } from "./guidelines";
import type { ScanRecord } from "./profile";
import type { HazardClass, Severity } from "./types";

/**
 * Aggregation over saved scans. Everything here is descriptive — it counts what
 * the user scanned and which guidelines were cited. It never derives anything
 * new about their health, because that would be a diagnosis dressed as a chart.
 */

export interface Summary {
  total: number;
  bySeverity: Record<Severity, number>;
  /** Hazard classes seen, most frequent first, resolved from cited guidelines. */
  hazards: Array<{ hazardClass: HazardClass; count: number }>;
  /** Scans in the last seven days. */
  recent: ScanRecord[];
  recentBySeverity: Record<Severity, number>;
  /** Distinct days with at least one scan, in the last seven. */
  activeDays: number;
  firstAt?: string;
  lastAt?: string;
}

const EMPTY_SEVERITY: Record<Severity, number> = {
  AVOID: 0,
  CAUTION: 0,
  OK: 0,
  UNKNOWN: 0,
};

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

function countSeverities(records: ScanRecord[]): Record<Severity, number> {
  const out = { ...EMPTY_SEVERITY };
  for (const r of records) out[r.verdict.severity] += 1;
  return out;
}

export function summarize(history: ScanRecord[], now = Date.now()): Summary {
  const sorted = [...history].sort((a, b) => b.at.localeCompare(a.at));
  const recent = sorted.filter((r) => now - Date.parse(r.at) <= WEEK_MS);

  // Hazard classes come from the guidelines each flag actually cited, so the
  // chart can't disagree with the receipts it was built from.
  const hazardCounts = new Map<HazardClass, number>();
  for (const r of sorted) {
    const seen = new Set<HazardClass>();
    for (const flag of r.verdict.flags) {
      for (const id of flag.guidelineIds) {
        const g = GUIDELINE_BY_ID.get(id);
        if (g && g.hazardClass !== "none") seen.add(g.hazardClass);
      }
    }
    for (const h of seen) hazardCounts.set(h, (hazardCounts.get(h) ?? 0) + 1);
  }

  const days = new Set(recent.map((r) => r.at.slice(0, 10)));

  return {
    total: sorted.length,
    bySeverity: countSeverities(sorted),
    hazards: [...hazardCounts.entries()]
      .map(([hazardClass, count]) => ({ hazardClass, count }))
      .sort((a, b) => b.count - a.count),
    recent,
    recentBySeverity: countSeverities(recent),
    activeDays: days.size,
    firstAt: sorted.at(-1)?.at,
    lastAt: sorted[0]?.at,
  };
}

/** Group by calendar day, newest first, for the history list. */
export function groupByDay(history: ScanRecord[]): Array<{ day: string; items: ScanRecord[] }> {
  const map = new Map<string, ScanRecord[]>();
  for (const r of [...history].sort((a, b) => b.at.localeCompare(a.at))) {
    const day = r.at.slice(0, 10);
    const list = map.get(day);
    if (list) list.push(r);
    else map.set(day, [r]);
  }
  return [...map.entries()].map(([day, items]) => ({ day, items }));
}

export function formatDay(iso: string, now = new Date()): string {
  const d = new Date(`${iso}T00:00:00`);
  const today = now.toISOString().slice(0, 10);
  const yesterday = new Date(now.getTime() - 86400000).toISOString().slice(0, 10);
  if (iso === today) return "Today";
  if (iso === yesterday) return "Yesterday";
  return d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}

export const HAZARD_LABELS: Record<HazardClass, string> = {
  listeria: "Listeria",
  mercury: "Mercury",
  retinol: "Vitamin A",
  "raw-animal-product": "Raw animal food",
  alcohol: "Alcohol",
  caffeine: "Caffeine",
  unpasteurized: "Unpasteurized dairy",
  "added-sugar-gdm": "Added sugar",
  none: "General",
};

/**
 * Plain-text report for an appointment. Deliberately a scan log, not a health
 * record: it lists what was scanned and which published guideline was cited,
 * and carries the same disclaimer as the app.
 */
export function buildReport(history: ScanRecord[], week?: number): string {
  const s = summarize(history);
  const lines: string[] = [
    "TARE — SCAN LOG",
    week ? `Pregnancy week at export: ${week}` : "",
    `Exported: ${new Date().toLocaleString()}`,
    `Total scans: ${s.total}  (avoid ${s.bySeverity.AVOID}, caution ${s.bySeverity.CAUTION}, ok ${s.bySeverity.OK}, unknown ${s.bySeverity.UNKNOWN})`,
    "",
    "SCANS",
  ].filter(Boolean);

  for (const r of [...history].sort((a, b) => b.at.localeCompare(a.at))) {
    const when = new Date(r.at).toLocaleDateString();
    lines.push(
      `- ${when}${r.week ? ` (week ${r.week})` : ""} · ${r.verdict.item.name} — ${r.verdict.severity}`,
    );
    for (const f of r.verdict.flags) {
      lines.push(`    ${f.ingredient}: ${f.plainReason} [${f.guidelineIds.join(", ")}]`);
    }
  }

  lines.push(
    "",
    "Tare explains public food-safety guidance from the FDA, NHS, ACOG and CDC.",
    "It is not medical advice and this log is not a medical record.",
  );

  return lines.join("\n");
}
