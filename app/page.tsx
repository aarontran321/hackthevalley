"use client";

import { useCallback, useEffect, useState } from "react";

import { Receipt } from "@/components/Receipt";
import { Scanner } from "@/components/Scanner";
import { Setup } from "@/components/Setup";
import { getDemoVerdict, DEMO_VERDICTS } from "@/lib/demo";
import { resolveGuidelineUrl } from "@/lib/guidelines";
import {
  loadProfile,
  type Profile,
  saveProfile,
  saveScan,
  trimesterForWeek,
} from "@/lib/profile";
import type { Verdict } from "@/lib/types";

type Screen =
  | { kind: "loading" }
  | { kind: "setup" }
  | { kind: "scanning" }
  | { kind: "working"; barcode: string }
  | { kind: "verdict"; barcode?: string; verdict: Verdict; degraded?: string }
  | { kind: "error"; barcode: string; message: string };

export default function Home() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [screen, setScreen] = useState<Screen>({ kind: "loading" });
  const [demo, setDemo] = useState(false);

  // Read once on mount. useSearchParams would force a Suspense boundary on a
  // statically rendered page, and this app is client-only anyway.
  useEffect(() => {
    setDemo(new URLSearchParams(window.location.search).get("demo") === "1");
    const existing = loadProfile();
    setProfile(existing);
    setScreen(existing ? { kind: "scanning" } : { kind: "setup" });
  }, []);

  const handleDecode = useCallback(
    async (barcode: string) => {
      if (!profile) return;

      // Demo mode never touches the network or the API quota.
      const seeded = getDemoVerdict(barcode);
      if (demo && seeded) {
        setScreen({ kind: "verdict", barcode, verdict: seeded });
        return;
      }

      setScreen({ kind: "working", barcode });

      try {
        const res = await fetch("/api/verdict", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            barcode,
            week: profile.week,
            trimester: trimesterForWeek(profile.week),
            conditions: profile.conditions,
          }),
        });

        if (res.status === 404) {
          setScreen({
            kind: "error",
            barcode,
            message:
              "That barcode isn't in the Open Food Facts database. Try the photo tab, or type a different code.",
          });
          return;
        }
        if (!res.ok) throw new Error(`verdict responded ${res.status}`);

        const data = (await res.json()) as { verdict: Verdict; degradedReason?: string };
        setScreen({
          kind: "verdict",
          barcode,
          verdict: data.verdict,
          degraded: data.degradedReason,
        });
      } catch {
        setScreen({
          kind: "error",
          barcode,
          message: "Couldn't reach the verdict service. Check your connection and try again.",
        });
      }
    },
    [profile, demo],
  );

  function reset() {
    setScreen({ kind: "scanning" });
  }

  if (screen.kind === "loading") {
    return <div className="px-5 py-8" aria-busy="true" />;
  }

  if (screen.kind === "setup") {
    return (
      <div className="px-5 py-8">
        <Setup
          initial={profile}
          onDone={(p) => {
            saveProfile(p);
            setProfile(p);
            setScreen({ kind: "scanning" });
          }}
        />
      </div>
    );
  }

  return (
    <div className="px-5 py-8">
      {screen.kind === "scanning" && (
        <div className="space-y-6">
          <Header profile={profile} onEdit={() => setScreen({ kind: "setup" })} />
          <Scanner onDecode={handleDecode} />
          {demo && <DemoPicker onPick={handleDecode} />}
        </div>
      )}

      {screen.kind === "working" && (
        <div className="mx-auto w-full max-w-[420px] space-y-3" aria-busy="true">
          <p className="font-mono text-xs tracking-[0.16em] text-graphite">
            {screen.barcode}
          </p>
          <p className="font-display text-lg font-semibold">Reading the label…</p>
          <p className="text-sm text-graphite">
            Looking up the ingredients, then checking them against published guidance.
          </p>
        </div>
      )}

      {screen.kind === "error" && (
        <div className="mx-auto w-full max-w-[420px] space-y-4">
          <p className="font-mono text-xs tracking-[0.16em] text-graphite">
            {screen.barcode}
          </p>
          <p className="font-display text-lg font-semibold">Couldn&rsquo;t read that one.</p>
          <p className="text-sm text-graphite">{screen.message}</p>
          <button
            onClick={reset}
            className="rounded-xs border border-ink px-4 py-2 font-mono text-xs tracking-[0.14em]"
          >
            SCAN AGAIN
          </button>
        </div>
      )}

      {screen.kind === "verdict" && (
        <div className="space-y-4">
          <Receipt
            verdict={screen.verdict}
            week={profile?.week ?? 22}
            barcode={screen.barcode}
            resolveGuidelineUrl={resolveGuidelineUrl}
          />
          {screen.degraded && (
            <p className="mx-auto w-full max-w-[420px] font-mono text-xs text-caution">
              Explanation step unavailable ({screen.degraded}) — showing the rule match only.
            </p>
          )}
          <div className="mx-auto flex w-full max-w-[420px] gap-2">
            <button
              onClick={() => {
                saveScan({
                  barcode: screen.barcode,
                  verdict: screen.verdict,
                  at: new Date().toISOString(),
                });
                reset();
              }}
              className="flex-1 rounded-xs border border-ink px-4 py-3 font-mono text-xs tracking-[0.14em]"
            >
              SAVE
            </button>
            <button
              onClick={reset}
              className="flex-1 rounded-xs bg-ink px-4 py-3 font-mono text-xs tracking-[0.14em] text-paper"
            >
              SCAN ANOTHER
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function Header({ profile, onEdit }: { profile: Profile | null; onEdit: () => void }) {
  if (!profile) return null;
  return (
    <div className="mx-auto flex w-full max-w-[420px] items-baseline justify-between">
      <p className="font-mono text-xs tracking-[0.16em] text-graphite">
        WEEK {profile.week} · TRIMESTER {trimesterForWeek(profile.week)}
      </p>
      <button onClick={onEdit} className="font-mono text-xs text-graphite underline">
        edit
      </button>
    </div>
  );
}

/** Demo mode has no camera to point at anything, so the seeds need a way in. */
function DemoPicker({ onPick }: { onPick: (barcode: string) => void }) {
  return (
    <div className="mx-auto w-full max-w-[420px] space-y-2 border-t border-rule pt-4">
      <p className="font-mono text-xs tracking-[0.16em] text-graphite">DEMO PRODUCTS</p>
      {Object.entries(DEMO_VERDICTS).map(([barcode, v]) => (
        <button
          key={barcode}
          onClick={() => onPick(barcode)}
          className="flex w-full items-baseline justify-between rounded-xs border border-rule bg-white px-3 py-2 text-left text-sm hover:border-graphite"
        >
          <span>{v.item.name}</span>
          <span className="font-mono text-xs text-graphite">{v.severity}</span>
        </button>
      ))}
    </div>
  );
}
