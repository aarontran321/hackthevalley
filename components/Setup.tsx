"use client";

import { useState } from "react";

import {
  CONDITION_OPTIONS,
  DIET_LABELS,
  type DietPattern,
  type Profile,
  trimesterForWeek,
} from "@/lib/profile";

/**
 * Setup. Once, about fifteen seconds. Three questions, inline, no wizard.
 */
export function Setup({
  initial,
  onDone,
}: {
  initial?: Profile | null;
  onDone: (profile: Profile) => void;
}) {
  const [week, setWeek] = useState<string>(initial ? String(initial.week) : "");
  const [diet, setDiet] = useState<DietPattern>(initial?.diet ?? "omnivore");
  const [conditions, setConditions] = useState<string[]>(initial?.conditions ?? []);

  const weekNum = Number(week);
  const weekValid = Number.isInteger(weekNum) && weekNum >= 1 && weekNum <= 42;

  function toggleCondition(slug: string) {
    setConditions((c) => (c.includes(slug) ? c.filter((s) => s !== slug) : [...c, slug]));
  }

  return (
    <form
      className="mx-auto w-full max-w-[420px] space-y-8"
      onSubmit={(e) => {
        e.preventDefault();
        if (weekValid) onDone({ week: weekNum, diet, conditions });
      }}
    >
      <div>
        <h1 className="font-display text-xl font-bold tracking-tight">
          Three questions, then you can scan.
        </h1>
        <p className="mt-2 text-sm text-graphite">
          Stored on this device only. No account, nothing sent anywhere.
        </p>
      </div>

      <fieldset>
        <label
          htmlFor="week"
          className="font-mono text-xs tracking-[0.16em] text-graphite"
        >
          HOW MANY WEEKS?
        </label>
        <div className="mt-2 flex items-baseline gap-3">
          <input
            id="week"
            type="number"
            inputMode="numeric"
            min={1}
            max={42}
            value={week}
            onChange={(e) => setWeek(e.target.value)}
            placeholder="22"
            className="w-24 rounded-xs border border-rule bg-white px-3 py-2 font-mono text-lg tabular-nums"
          />
          <span className="font-mono text-xs text-graphite">
            {weekValid ? `trimester ${trimesterForWeek(weekNum)}` : "1–42"}
          </span>
        </div>
      </fieldset>

      <fieldset>
        <legend className="font-mono text-xs tracking-[0.16em] text-graphite">
          WHAT DO YOU EAT?
        </legend>
        <div className="mt-2 grid grid-cols-2 gap-2">
          {(Object.keys(DIET_LABELS) as DietPattern[]).map((d) => (
            <button
              key={d}
              type="button"
              aria-pressed={diet === d}
              onClick={() => setDiet(d)}
              className={`rounded-xs border px-3 py-2 text-left text-sm transition-colors ${
                diet === d
                  ? "border-ink bg-ink text-paper"
                  : "border-rule bg-white hover:border-graphite"
              }`}
            >
              {DIET_LABELS[d]}
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend className="font-mono text-xs tracking-[0.16em] text-graphite">
          ANYTHING TO ACCOUNT FOR? <span className="normal-case">(optional)</span>
        </legend>
        <div className="mt-2 space-y-2">
          {CONDITION_OPTIONS.map((c) => {
            const on = conditions.includes(c.slug);
            return (
              <button
                key={c.slug}
                type="button"
                aria-pressed={on}
                onClick={() => toggleCondition(c.slug)}
                className={`flex w-full items-center gap-3 rounded-xs border px-3 py-2 text-left text-sm transition-colors ${
                  on ? "border-ink bg-ink text-paper" : "border-rule bg-white hover:border-graphite"
                }`}
              >
                <span
                  aria-hidden
                  className={`inline-block h-3 w-3 shrink-0 border ${
                    on ? "border-paper bg-paper" : "border-graphite"
                  }`}
                />
                {c.label}
              </button>
            );
          })}
        </div>
      </fieldset>

      <button
        type="submit"
        disabled={!weekValid}
        className="w-full rounded-xs bg-ink px-4 py-3 font-mono text-sm tracking-[0.14em] text-paper disabled:cursor-not-allowed disabled:bg-rule disabled:text-graphite"
      >
        START SCANNING
      </button>
    </form>
  );
}
