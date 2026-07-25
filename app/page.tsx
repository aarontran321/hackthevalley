"use client";

import { useCallback, useEffect, useState, type CSSProperties } from "react";

import { Chat } from "@/components/Chat";
import { ConfirmFood, needsConfirmation } from "@/components/ConfirmFood";
import { PhotoCapture } from "@/components/PhotoCapture";
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
import type { FoodItem, IdentifiedFood, Verdict } from "@/lib/types";

type Tab = "barcode" | "photo" | "chat";

const TAB_LABELS: Record<Tab, string> = {
  barcode: "BARCODE",
  photo: "PHOTO",
  chat: "ASK",
};

type Screen =
  | { kind: "loading" }
  | { kind: "setup" }
  | { kind: "scanning" }
  | { kind: "confirm"; food: IdentifiedFood; previewUrl?: string }
  | { kind: "working"; label: string }
  | { kind: "verdict"; barcode?: string; verdict: Verdict; degraded?: string; saved?: boolean }
  | { kind: "error"; message: string };

export default function Home() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [screen, setScreen] = useState<Screen>({ kind: "loading" });
  const [tab, setTab] = useState<Tab>("barcode");
  const [demo, setDemo] = useState(false);

  useEffect(() => {
    // Hydrating from browser-only sources. localStorage and location.search do
    // not exist during SSR, so this genuinely cannot happen before mount and
    // cannot be a lazy initializer without a hydration mismatch. React batches
    // these into a single render.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDemo(new URLSearchParams(window.location.search).get("demo") === "1");
    const existing = loadProfile();
    setProfile(existing);
    setScreen(existing ? { kind: "scanning" } : { kind: "setup" });
  }, []);

  const requestVerdict = useCallback(
    async (payload: { barcode?: string; item?: FoodItem }, label: string) => {
      if (!profile) return;
      setScreen({ kind: "working", label });

      try {
        const res = await fetch("/api/verdict", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            ...payload,
            week: profile.week,
            trimester: trimesterForWeek(profile.week),
            conditions: profile.conditions,
          }),
        });

        if (res.status === 404) {
          setScreen({
            kind: "error",
            message:
              "That barcode isn't in the Open Food Facts database. Try the photo tab instead.",
          });
          return;
        }
        if (!res.ok) throw new Error(`verdict responded ${res.status}`);

        const data = (await res.json()) as { verdict: Verdict; degradedReason?: string };
        setScreen({
          kind: "verdict",
          barcode: payload.barcode,
          verdict: data.verdict,
          degraded: data.degradedReason,
        });
      } catch {
        setScreen({
          kind: "error",
          message: "Couldn't reach the verdict service. Check your connection and try again.",
        });
      }
    },
    [profile],
  );

  const handleBarcode = useCallback(
    (barcode: string) => {
      const seeded = getDemoVerdict(barcode);
      if (demo && seeded) {
        setScreen({ kind: "verdict", barcode, verdict: seeded });
        return;
      }
      void requestVerdict({ barcode }, barcode);
    },
    [demo, requestVerdict],
  );

  const handleIdentified = useCallback(
    (food: IdentifiedFood, previewUrl: string) => {
      // Below the confidence floor, or with nothing to reason over, ask rather
      // than build a safety verdict on a guess.
      if (needsConfirmation(food)) {
        setScreen({ kind: "confirm", food, previewUrl });
        return;
      }
      void requestVerdict(
        { item: { name: food.name, ingredients: food.likelyIngredients, nutrition: {} } },
        food.name,
      );
    },
    [requestVerdict],
  );

  const reset = useCallback(() => setScreen({ kind: "scanning" }), []);

  if (screen.kind === "loading") return <div className="px-5 py-8" aria-busy="true" />;

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
        <div className="space-y-5">
          <Header profile={profile} onEdit={() => setScreen({ kind: "setup" })} />

          <div className="mx-auto flex w-full max-w-[420px] border-b border-rule">
            {(["barcode", "photo", "chat"] as Tab[]).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                aria-current={tab === t}
                className={`-mb-px border-b-2 px-4 py-2 font-mono text-xs tracking-[0.14em] ${
                  tab === t ? "border-ink text-ink" : "border-transparent text-graphite"
                }`}
              >
                {TAB_LABELS[t]}
              </button>
            ))}
          </div>

          {/* Keyed so switching tabs tears the old camera stream down. */}
          {tab === "barcode" && <Scanner key="barcode" onDecode={handleBarcode} />}
          {tab === "photo" && (
            <PhotoCapture
              key="photo"
              onIdentified={handleIdentified}
              onError={(message) => setScreen({ kind: "error", message })}
            />
          )}
          {tab === "chat" && profile && <Chat key="chat" profile={profile} />}

          {demo && tab === "barcode" && <DemoPicker onPick={handleBarcode} />}
        </div>
      )}

      {screen.kind === "confirm" && (
        <ConfirmFood
          food={screen.food}
          previewUrl={screen.previewUrl}
          onRetake={reset}
          onConfirm={(item) => void requestVerdict({ item }, item.name)}
        />
      )}

      {screen.kind === "working" && <Working label={screen.label} />}

      {screen.kind === "error" && (
        <div className="mx-auto w-full max-w-[420px] space-y-4">
          <p className="font-display text-lg font-semibold">Couldn&rsquo;t read that one.</p>
          <p className="text-sm text-graphite">{screen.message}</p>
          <button
            onClick={reset}
            className="rounded-xs border border-ink px-4 py-2 font-mono text-xs tracking-[0.14em]"
          >
            TRY AGAIN
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
            {/* Stay on the receipt and confirm. Bouncing straight back to the
                scanner made saving look like it had done nothing. */}
            <button
              disabled={screen.saved}
              onClick={() => {
                saveScan({
                  barcode: screen.barcode,
                  verdict: screen.verdict,
                  at: new Date().toISOString(),
                });
                setScreen({ ...screen, saved: true });
              }}
              className="flex-1 rounded-xs border border-ink px-4 py-3 font-mono text-xs tracking-[0.14em] disabled:border-rule disabled:text-graphite"
            >
              {screen.saved ? "SAVED ✓" : "SAVE"}
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

/**
 * The verdict round trip runs about nine seconds, which makes this the
 * second-longest-lived screen in the app. It borrows the receipt's shape and
 * names the three stages of the spine — the same "show your working" the
 * verdict itself is built on, rather than a spinner.
 *
 * The stages are labelled, not tracked: it is one request, so claiming live
 * per-stage progress would be a lie.
 */
function Working({ label }: { label: string }) {
  const stages = [
    "reading the ingredients",
    "matching published guidelines",
    "writing it in plain language",
  ];

  return (
    <div
      className="receipt mx-auto w-full max-w-[420px] border-x border-rule bg-white"
      aria-busy="true"
      aria-live="polite"
    >
      <div className="px-5 py-4">
        <p className="font-mono text-xs tracking-[0.16em] text-graphite">{label}</p>
      </div>
      <div className="space-y-3 border-t border-rule px-5 py-4">
        {stages.map((s, i) => (
          <div
            key={s}
            className="receipt-line flex items-baseline gap-2"
            style={{ "--i": i * 3 } as CSSProperties}
          >
            <span className="font-mono text-sm">{s}</span>
            <span aria-hidden className="leader" />
            <span aria-hidden className="sweep-dot font-mono text-xs text-graphite">
              ···
            </span>
          </div>
        ))}
      </div>
      <div className="border-t border-rule px-5 py-4">
        <p className="font-mono text-xs text-graphite">
          nothing is saved unless you tap save
        </p>
      </div>
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
