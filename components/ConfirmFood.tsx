"use client";

import Image from "next/image";
import { useState } from "react";

import { IDENTIFY_CONFIDENCE_FLOOR } from "@/lib/config";
import type { FoodItem, IdentifiedFood } from "@/lib/types";

/**
 * Shown when the model isn't confident enough about what it saw. On a health
 * app, asking beats guessing — and letting the user correct the reading is
 * cheaper than producing a verdict about the wrong food.
 */
export function ConfirmFood({
  food,
  previewUrl,
  onConfirm,
  onRetake,
}: {
  food: IdentifiedFood;
  previewUrl?: string;
  onConfirm: (item: FoodItem) => void;
  onRetake: () => void;
}) {
  const [name, setName] = useState(food.name);
  const [ingredients, setIngredients] = useState(food.likelyIngredients.join(", "));

  const parsed = ingredients
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const ready = name.trim().length > 1 && parsed.length > 0;

  return (
    <div className="mx-auto w-full max-w-[420px] space-y-5">
      <div>
        <p className="font-mono text-xs tracking-[0.16em] text-caution">
          NOT SURE — {(food.confidence * 100).toFixed(0)}% CONFIDENT
        </p>
        <h1 className="mt-2 font-display text-xl font-bold tracking-tight">
          Is this right?
        </h1>
        <p className="mt-1 text-sm text-graphite">
          The verdict is only as good as what went into it, so check this before
          Tare rules on it.
        </p>
      </div>

      {previewUrl && (
        <Image
          src={previewUrl}
          alt="The photo you took"
          width={420}
          height={315}
          unoptimized
          className="w-full border border-rule object-cover"
        />
      )}

      {food.ambiguities.length > 0 && (
        <div className="border-l-2 border-caution pl-3">
          <p className="font-mono text-xs tracking-[0.16em] text-graphite">
            COULDN&rsquo;T TELL
          </p>
          <ul className="mt-1 space-y-1">
            {food.ambiguities.map((a, i) => (
              <li key={i} className="text-sm text-graphite">
                {a}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="space-y-3">
        <div>
          <label htmlFor="food-name" className="font-mono text-xs tracking-[0.16em] text-graphite">
            WHAT IS IT?
          </label>
          <input
            id="food-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="mt-1 w-full rounded-xs border border-rule bg-white px-3 py-2 text-sm"
          />
        </div>

        <div>
          <label
            htmlFor="food-ingredients"
            className="font-mono text-xs tracking-[0.16em] text-graphite"
          >
            WHAT&rsquo;S IN IT? <span className="normal-case">(comma separated)</span>
          </label>
          <textarea
            id="food-ingredients"
            value={ingredients}
            onChange={(e) => setIngredients(e.target.value)}
            rows={3}
            placeholder="e.g. turkey, bread, mayonnaise"
            className="mt-1 w-full rounded-xs border border-rule bg-white px-3 py-2 text-sm"
          />
          <p className="mt-1 font-mono text-xs text-graphite">
            {food.preparationMethod !== "unknown"
              ? `looks ${food.preparationMethod}`
              : "preparation unclear — say if it's raw or cooked"}
          </p>
        </div>
      </div>

      <div className="flex gap-2">
        <button
          onClick={onRetake}
          className="flex-1 rounded-xs border border-ink px-4 py-3 font-mono text-xs tracking-[0.14em]"
        >
          RETAKE
        </button>
        <button
          disabled={!ready}
          onClick={() =>
            onConfirm({ name: name.trim(), ingredients: parsed, nutrition: {} })
          }
          className="flex-1 rounded-xs bg-ink px-4 py-3 font-mono text-xs tracking-[0.14em] text-paper disabled:bg-rule disabled:text-graphite"
        >
          CHECK IT
        </button>
      </div>
    </div>
  );
}

export function needsConfirmation(food: IdentifiedFood): boolean {
  return food.confidence < IDENTIFY_CONFIDENCE_FLOOR || food.likelyIngredients.length === 0;
}
