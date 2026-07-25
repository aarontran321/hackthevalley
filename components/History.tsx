"use client";

import { useMemo, useState } from "react";

import { deleteScan, type Profile, type ScanRecord } from "@/lib/profile";
import { buildReport, formatDay, groupByDay, HAZARD_LABELS, summarize } from "@/lib/summary";
import type { Severity } from "@/lib/types";

const SEVERITY_TEXT: Record<Severity, string> = {
  AVOID: "text-avoid",
  CAUTION: "text-caution",
  OK: "text-safe",
  UNKNOWN: "text-unknown",
};

const SEVERITY_ORDER: Severity[] = ["AVOID", "CAUTION", "OK", "UNKNOWN"];

/**
 * Overview + history + report.
 *
 * Deliberately not charts. At this data size (tens of scans, 420px wide) the
 * right forms are a hero number, a status row, and a ranked list — a bar chart
 * of four counts would carry less information than the four numbers do.
 *
 * Hazard magnitude uses plain ink bars, never the severity hues: those are a
 * reserved status palette, and the design brief keeps saturated colour for
 * verdict semantics only. Every severity is labelled with its word, so identity
 * never rests on colour.
 */
export function History({
  profile,
  history,
  onBack,
  onOpenScan,
  onChanged,
}: {
  profile: Profile;
  history: ScanRecord[];
  onBack: () => void;
  onOpenScan: (record: ScanRecord) => void;
  onChanged: (next: ScanRecord[]) => void;
}) {
  const [copied, setCopied] = useState(false);
  /** Set when the clipboard is unavailable, so the text is still gettable. */
  const [fallbackText, setFallbackText] = useState<string | null>(null);
  const s = useMemo(() => summarize(history), [history]);
  const days = useMemo(() => groupByDay(history), [history]);
  const maxHazard = s.hazards[0]?.count ?? 1;

  async function copyReport() {
    const report = buildReport(history, profile.week);
    try {
      await navigator.clipboard.writeText(report);
      setFallbackText(null);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // clipboard needs a secure context and a real gesture, and Safari is
      // fussy about both. Failing silently would leave the button looking
      // broken, so show the text and let them select it.
      setFallbackText(report);
      setCopied(false);
    }
  }

  if (history.length === 0) {
    return (
      <div className="mx-auto w-full max-w-[420px] space-y-4">
        <BackLink onBack={onBack} />
        <p className="font-display text-lg font-semibold">Nothing saved yet.</p>
        <p className="text-sm text-graphite">
          Scan something and tap Save. Saved scans stay on this device.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-[420px] space-y-8">
      <BackLink onBack={onBack} />

      {/* Hero number — the headline is one figure, not a chart. */}
      <div>
        <p className="font-mono text-xs tracking-[0.16em] text-graphite">SAVED SCANS</p>
        <p className="font-display text-3xl font-bold leading-none tabular-nums">{s.total}</p>
        <p className="mt-2 font-mono text-xs text-graphite">
          {s.recent.length} in the last 7 days
          {s.activeDays > 0 && ` · ${s.activeDays} day${s.activeDays === 1 ? "" : "s"}`}
        </p>
      </div>

      <div className="border-t border-rule pt-4">
        <p className="font-mono text-xs tracking-[0.16em] text-graphite">BY VERDICT</p>
        <ul className="mt-3 space-y-2">
          {SEVERITY_ORDER.map((sev) => (
            <li key={sev} className="flex items-baseline gap-2">
              <span className={`font-mono text-xs tracking-[0.14em] ${SEVERITY_TEXT[sev]}`}>
                {sev}
              </span>
              <span aria-hidden className="leader" />
              <span className="font-mono text-sm tabular-nums">{s.bySeverity[sev]}</span>
            </li>
          ))}
        </ul>
      </div>

      {s.hazards.length > 0 && (
        <div className="border-t border-rule pt-4">
          <p className="font-mono text-xs tracking-[0.16em] text-graphite">
            WHAT KEEPS COMING UP
          </p>
          <ul className="mt-3 space-y-3">
            {s.hazards.map((h) => (
              <li key={h.hazardClass}>
                <div className="flex items-baseline gap-2">
                  <span className="text-sm">{HAZARD_LABELS[h.hazardClass]}</span>
                  <span aria-hidden className="leader" />
                  <span className="font-mono text-xs tabular-nums text-graphite">
                    {h.count}
                  </span>
                </div>
                {/* Magnitude in ink, not in a severity hue. */}
                <div
                  aria-hidden
                  className="mt-1 h-1.5 rounded-r-xs bg-ink"
                  style={{ width: `${Math.max(4, (h.count / maxHazard) * 100)}%` }}
                />
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="border-t border-rule pt-4">
        <p className="font-mono text-xs tracking-[0.16em] text-graphite">EVERY SCAN</p>
        <div className="mt-3 space-y-5">
          {days.map(({ day, items }) => (
            <div key={day}>
              <p className="font-mono text-xs text-graphite">{formatDay(day)}</p>
              <ul className="mt-2 space-y-1">
                {items.map((r) => (
                  <li key={r.at} className="flex items-baseline gap-2">
                    <button
                      onClick={() => onOpenScan(r)}
                      className="flex min-w-0 flex-1 items-baseline gap-2 py-1 text-left"
                    >
                      <span className="truncate text-sm">{r.verdict.item.name}</span>
                      {r.week && (
                        <span className="shrink-0 font-mono text-xs text-graphite">
                          wk {r.week}
                        </span>
                      )}
                      <span aria-hidden className="leader" />
                      <span
                        className={`shrink-0 font-mono text-xs tracking-[0.14em] ${SEVERITY_TEXT[r.verdict.severity]}`}
                      >
                        {r.verdict.severity}
                      </span>
                    </button>
                    <button
                      onClick={() => onChanged(deleteScan(r.at))}
                      aria-label={`Delete ${r.verdict.item.name}`}
                      className="shrink-0 px-1 font-mono text-xs text-graphite hover:text-avoid"
                    >
                      ×
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>

      <div className="border-t border-rule pt-4">
        <p className="font-mono text-xs tracking-[0.16em] text-graphite">TAKE IT WITH YOU</p>
        <p className="mt-2 text-sm text-graphite">
          A plain list of what you scanned and which guideline was cited. It
          isn&rsquo;t a medical record.
        </p>
        <div className="mt-3 flex gap-2">
          <button
            onClick={copyReport}
            className="flex-1 rounded-xs border border-ink px-4 py-3 font-mono text-xs tracking-[0.14em]"
          >
            {copied ? "COPIED ✓" : "COPY"}
          </button>
          <button
            onClick={() => window.print()}
            className="flex-1 rounded-xs border border-ink px-4 py-3 font-mono text-xs tracking-[0.14em]"
          >
            PRINT
          </button>
        </div>

        {fallbackText && (
          <div className="mt-3">
            <p className="font-mono text-xs text-caution">
              Couldn&rsquo;t reach the clipboard. Select and copy this instead.
            </p>
            <textarea
              readOnly
              value={fallbackText}
              rows={10}
              aria-label="Scan log, ready to copy"
              onFocus={(e) => e.currentTarget.select()}
              className="mt-2 w-full rounded-xs border border-rule bg-white p-3 font-mono text-xs"
            />
          </div>
        )}
      </div>
    </div>
  );
}

function BackLink({ onBack }: { onBack: () => void }) {
  return (
    <button onClick={onBack} className="font-mono text-xs text-graphite underline">
      &larr; back
    </button>
  );
}
