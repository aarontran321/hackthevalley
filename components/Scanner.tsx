"use client";

import { BrowserMultiFormatReader } from "@zxing/browser";
import type { IScannerControls } from "@zxing/browser";
import { useEffect, useRef, useState } from "react";

type CameraState = "starting" | "slow" | "scanning" | "denied" | "unavailable";

/**
 * getUserMedia neither resolves nor rejects while a permission prompt sits
 * unanswered, so without this the screen reads "STARTING CAMERA…" forever.
 */
const CAMERA_PROMPT_GRACE_MS = 6000;

/**
 * Webcam barcode scanner. Decoding happens locally — no frame ever leaves the
 * device; only the resulting number is looked up.
 *
 * Manual entry is not a debug affordance. Webcams struggle with barcodes in
 * poor light, and the alternative to a text field is a dead end while someone
 * is standing in an aisle.
 */
export function Scanner({
  onDecode,
  disabled = false,
}: {
  onDecode: (barcode: string) => void;
  disabled?: boolean;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const controlsRef = useRef<IScannerControls | null>(null);
  const [state, setState] = useState<CameraState>("starting");
  const [manual, setManual] = useState("");

  useEffect(() => {
    if (disabled) return;

    let cancelled = false;
    const reader = new BrowserMultiFormatReader();

    async function start() {
      if (!navigator.mediaDevices?.getUserMedia) {
        setState("unavailable");
        return;
      }

      try {
        const controls = await reader.decodeFromConstraints(
          // Rear camera on a phone; falls back to whatever exists on a laptop.
          { video: { facingMode: { ideal: "environment" } } },
          videoRef.current ?? undefined,
          (result) => {
            if (!result || cancelled) return;
            const text = result.getText().replace(/\D/g, "");
            if (!text) return;
            controlsRef.current?.stop();
            onDecode(text);
          },
        );

        if (cancelled) {
          controls.stop();
          return;
        }
        controlsRef.current = controls;
        setState("scanning");
      } catch (err) {
        if (cancelled) return;
        const name = err instanceof Error ? err.name : "";
        setState(name === "NotAllowedError" || name === "SecurityError" ? "denied" : "unavailable");
      }
    }

    void start();

    return () => {
      cancelled = true;
      controlsRef.current?.stop();
      controlsRef.current = null;
    };
  }, [onDecode, disabled]);

  useEffect(() => {
    if (state !== "starting") return;
    const t = setTimeout(
      () => setState((s) => (s === "starting" ? "slow" : s)),
      CAMERA_PROMPT_GRACE_MS,
    );
    return () => clearTimeout(t);
  }, [state]);

  return (
    <div className="mx-auto w-full max-w-[420px] space-y-4">
      <div className="relative aspect-[4/3] overflow-hidden border border-rule bg-ink">
        <video
          ref={videoRef}
          className="h-full w-full object-cover"
          muted
          playsInline
          aria-label="Camera preview"
        />

        {state === "scanning" && (
          <>
            {/* A single hairline sweep — the only motion on this screen. */}
            <div aria-hidden className="pointer-events-none absolute inset-0">
              <div className="sweep absolute inset-x-0 h-px bg-paper/80" />
            </div>
            <div
              aria-hidden
              className="pointer-events-none absolute inset-6 border border-paper/30"
            />
          </>
        )}

        {state !== "scanning" && (
          <div className="absolute inset-0 grid place-items-center p-6 text-center">
            <p className="font-mono text-xs leading-relaxed text-paper/80">
              {state === "starting" && "STARTING CAMERA…"}
              {state === "slow" &&
                "Waiting on camera permission. Allow it to scan, or just type the barcode below."}
              {state === "denied" &&
                "Camera access is off. Allow it in your browser settings, or type the barcode below."}
              {state === "unavailable" &&
                "No camera available here. Type the barcode below instead."}
            </p>
          </div>
        )}
      </div>

      <p className="font-mono text-xs text-graphite">
        {state === "scanning"
          ? "POINT AT THE BARCODE"
          : "BARCODE DECODES ON THIS DEVICE — NO IMAGE IS UPLOADED"}
      </p>

      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          const clean = manual.replace(/\D/g, "");
          if (clean.length >= 8) onDecode(clean);
        }}
      >
        <input
          value={manual}
          onChange={(e) => setManual(e.target.value)}
          inputMode="numeric"
          placeholder="or type the barcode"
          aria-label="Enter barcode manually"
          className="min-w-0 flex-1 rounded-xs border border-rule bg-white px-3 py-2 font-mono text-sm tabular-nums"
        />
        <button
          type="submit"
          disabled={manual.replace(/\D/g, "").length < 8}
          className="rounded-xs border border-ink px-4 py-2 font-mono text-xs tracking-[0.14em] disabled:border-rule disabled:text-graphite"
        >
          LOOK UP
        </button>
      </form>
    </div>
  );
}
