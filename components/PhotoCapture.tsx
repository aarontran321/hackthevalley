"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import type { IdentifiedFood } from "@/lib/types";

type CamState = "starting" | "slow" | "live" | "denied" | "unavailable";

/** Downscale before upload: a 12MP phone photo adds seconds on shop wifi and
 *  buys nothing — the model reads a 1024px image just as well. */
const MAX_EDGE = 1024;
const JPEG_QUALITY = 0.82;
const CAMERA_PROMPT_GRACE_MS = 6000;

export function PhotoCapture({
  onIdentified,
  onError,
}: {
  onIdentified: (food: IdentifiedFood, previewUrl: string) => void;
  onError: (message: string) => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [state, setState] = useState<CamState>("starting");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function start() {
      if (!navigator.mediaDevices?.getUserMedia) {
        setState("unavailable");
        return;
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" } },
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => {});
        }
        setState("live");
      } catch (err) {
        if (cancelled) return;
        const name = err instanceof Error ? err.name : "";
        setState(name === "NotAllowedError" || name === "SecurityError" ? "denied" : "unavailable");
      }
    }

    void start();
    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (state !== "starting") return;
    const t = setTimeout(
      () => setState((s) => (s === "starting" ? "slow" : s)),
      CAMERA_PROMPT_GRACE_MS,
    );
    return () => clearTimeout(t);
  }, [state]);

  const identify = useCallback(
    async (dataUrl: string) => {
      setBusy(true);
      try {
        const res = await fetch("/api/identify", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ imageBase64: dataUrl, mimeType: "image/jpeg" }),
        });
        if (!res.ok) {
          const body = (await res.json().catch(() => ({}))) as { error?: string };
          onError(
            body.error === "rate-limit"
              ? "Out of API quota for today. Try ?demo=1, or a barcode."
              : "Couldn't read that photo. Try again with more light.",
          );
          return;
        }
        const { identified } = (await res.json()) as { identified: IdentifiedFood };
        onIdentified(identified, dataUrl);
      } catch {
        onError("Couldn't reach the identify service. Check your connection.");
      } finally {
        setBusy(false);
      }
    },
    [onIdentified, onError],
  );

  function shoot() {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;

    const scale = Math.min(1, MAX_EDGE / Math.max(video.videoWidth, video.videoHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(video.videoWidth * scale);
    canvas.height = Math.round(video.videoHeight * scale);
    canvas.getContext("2d")?.drawImage(video, 0, 0, canvas.width, canvas.height);
    void identify(canvas.toDataURL("image/jpeg", JPEG_QUALITY));
  }

  function pickFile(file: File) {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, MAX_EDGE / Math.max(img.width, img.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        canvas.getContext("2d")?.drawImage(img, 0, 0, canvas.width, canvas.height);
        void identify(canvas.toDataURL("image/jpeg", JPEG_QUALITY));
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  }

  return (
    <div className="mx-auto w-full max-w-[420px] space-y-4">
      <div className="relative aspect-[4/3] overflow-hidden border border-rule bg-ink">
        <video ref={videoRef} className="h-full w-full object-cover" muted playsInline />
        {state !== "live" && (
          <div className="absolute inset-0 grid place-items-center p-6 text-center">
            <p className="font-mono text-xs leading-relaxed text-paper/80">
              {state === "starting" && "STARTING CAMERA…"}
              {state === "slow" && "Waiting on camera permission. Or choose a photo below."}
              {state === "denied" && "Camera access is off. Choose a photo from your library instead."}
              {state === "unavailable" && "No camera here. Choose a photo from your library instead."}
            </p>
          </div>
        )}
        {busy && (
          <div className="absolute inset-0 grid place-items-center bg-ink/70">
            <p className="font-mono text-xs tracking-[0.16em] text-paper">IDENTIFYING…</p>
          </div>
        )}
      </div>

      <p className="font-mono text-xs text-graphite">
        THE PHOTO IS SENT TO GOOGLE FOR IDENTIFICATION, THEN DISCARDED
      </p>

      <div className="flex gap-2">
        <button
          onClick={shoot}
          disabled={state !== "live" || busy}
          className="flex-1 rounded-xs bg-ink px-4 py-3 font-mono text-xs tracking-[0.14em] text-paper disabled:bg-rule disabled:text-graphite"
        >
          TAKE PHOTO
        </button>
        <label className="flex-1 cursor-pointer rounded-xs border border-ink px-4 py-3 text-center font-mono text-xs tracking-[0.14em]">
          CHOOSE FILE
          <input
            type="file"
            accept="image/*"
            capture="environment"
            className="sr-only"
            disabled={busy}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) pickFile(f);
              e.target.value = "";
            }}
          />
        </label>
      </div>
    </div>
  );
}
