"use client";

import type { Profile, ScanRecord } from "@/lib/profile";
import { trimesterForWeek } from "@/lib/profile";
import { summarize } from "@/lib/summary";
import type { Severity } from "@/lib/types";

const SEVERITY_TEXT: Record<Severity, string> = {
  AVOID: "text-avoid",
  CAUTION: "text-caution",
  OK: "text-safe",
  UNKNOWN: "text-unknown",
};

const RECENT_SHOWN = 5;

/**
 * Landing surface. The scan button is the only thing with weight on this
 * screen — everything else is a way back to something already decided.
 */
export function Home({
  profile,
  history,
  onScan,
  onPhoto,
  onAsk,
  onOpenScan,
  onOpenHistory,
  onEdit,
}: {
  profile: Profile;
  history: ScanRecord[];
  onScan: () => void;
  onPhoto: () => void;
  onAsk: () => void;
  onOpenScan: (record: ScanRecord) => void;
  onOpenHistory: () => void;
  onEdit: () => void;
}) {
  const recent = history.slice(0, RECENT_SHOWN);
  const s = summarize(history);

  return (
    <div className="mx-auto w-full max-w-[420px] space-y-8">
      <div className="flex items-baseline justify-between">
        <p className="font-mono text-xs tracking-[0.16em] text-graphite">
          WEEK {profile.week} · TRIMESTER {trimesterForWeek(profile.week)}
        </p>
        <button onClick={onEdit} className="font-mono text-xs text-graphite underline">
          edit
        </button>
      </div>

      <div className="space-y-3">
        <button
          onClick={onScan}
          className="w-full rounded-xs bg-ink px-4 py-6 font-display text-lg font-bold tracking-tight text-paper"
        >
          Scan a barcode
        </button>
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={onPhoto}
            className="rounded-xs border border-ink px-4 py-3 font-mono text-xs tracking-[0.14em]"
          >
            PHOTOGRAPH IT
          </button>
          <button
            onClick={onAsk}
            className="rounded-xs border border-ink px-4 py-3 font-mono text-xs tracking-[0.14em]"
          >
            ASK A QUESTION
          </button>
        </div>
      </div>

      {history.length === 0 ? (
        <div className="border-t border-rule pt-4">
          <p className="text-sm text-graphite">
            Nothing saved yet. Scan something and tap Save, and it&rsquo;ll show
            up here.
          </p>
        </div>
      ) : (
        <div className="border-t border-rule pt-4">
          <div className="flex items-baseline justify-between">
            <p className="font-mono text-xs tracking-[0.16em] text-graphite">RECENT</p>
            <button
              onClick={onOpenHistory}
              className="font-mono text-xs text-graphite underline"
            >
              all {s.total}
            </button>
          </div>

          <ul className="mt-3 space-y-2">
            {recent.map((r) => (
              <li key={r.at}>
                <button
                  onClick={() => onOpenScan(r)}
                  className="flex w-full items-baseline gap-2 py-1 text-left"
                >
                  <span className="truncate text-sm">{r.verdict.item.name}</span>
                  <span aria-hidden className="leader" />
                  <span
                    className={`shrink-0 font-mono text-xs tracking-[0.14em] ${SEVERITY_TEXT[r.verdict.severity]}`}
                  >
                    {r.verdict.severity}
                  </span>
                </button>
              </li>
            ))}
          </ul>

          {s.recent.length > 0 && (
            <p className="mt-3 font-mono text-xs text-graphite">
              {s.recent.length} scan{s.recent.length === 1 ? "" : "s"} in the last
              7 days
              {s.recentBySeverity.AVOID > 0 && ` · ${s.recentBySeverity.AVOID} to avoid`}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
