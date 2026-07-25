"use client";

import { useEffect, useRef, useState } from "react";
import { CameraOff, Flashlight, ScanBarcode, X } from "lucide-react";

type ScannerControls = {
  stop: () => void;
  switchTorch?: (enabled: boolean) => Promise<void>;
};

export function BarcodeCamera({
  onDetected,
  onClose,
}: {
  onDetected: (code: string) => void;
  onClose: () => void;
}) {
  const video = useRef<HTMLVideoElement>(null);
  const controlsRef = useRef<ScannerControls | undefined>(undefined);
  const [error, setError] = useState("");
  const [ready, setReady] = useState(false);
  const [waitingForFrames, setWaitingForFrames] = useState(false);
  const [torchAvailable, setTorchAvailable] = useState(false);
  const [torchOn, setTorchOn] = useState(false);

  useEffect(() => {
    let live = true;

    import("@zxing/browser").then(async ({ BrowserMultiFormatReader }) => {
      const { BarcodeFormat, DecodeHintType } = await import("@zxing/library");
      try {
        const preview = video.current;
        if (!preview) throw new Error("VIDEO_NOT_READY");

        const markPlaying = () => {
          if (!live || preview.videoWidth === 0) return;
          setReady(true);
          setWaitingForFrames(false);
        };
        preview.addEventListener("playing", markPlaying);
        preview.addEventListener("loadeddata", markPlaying);

        // Restricting the decoder to retail formats avoids spending time trying
        // QR and document formats on every camera frame.
        const hints = new Map();
        hints.set(DecodeHintType.POSSIBLE_FORMATS, [
          BarcodeFormat.EAN_13,
          BarcodeFormat.EAN_8,
          BarcodeFormat.UPC_A,
          BarcodeFormat.UPC_E,
          BarcodeFormat.CODE_128,
        ]);
        hints.set(DecodeHintType.TRY_HARDER, true);

        const reader = new BrowserMultiFormatReader(hints, {
          delayBetweenScanAttempts: 80,
          delayBetweenScanSuccess: 500,
        });
        const onResult = (result: { getText: () => string } | undefined) => {
            if (!result || !live) return;
            const code = result.getText().replace(/\D/g, "");
            if (code.length < 8 || code.length > 14) return;

            live = false;
            navigator.vibrate?.(80);
            controlsRef.current?.stop();
            onDetected(code);
        };

        // Desktop cameras do not expose an "environment" lens. Let the browser
        // choose its real default there; request the rear lens only on mobile.
        const mobileCamera = window.matchMedia("(pointer: coarse)").matches;
        const controls = mobileCamera
          ? await reader.decodeFromConstraints(
              {
                audio: false,
                video: {
                  facingMode: { ideal: "environment" },
                  width: { ideal: 1280 },
                  height: { ideal: 720 },
                },
              },
              preview,
              onResult,
            )
          : await reader.decodeFromVideoDevice(undefined, preview, onResult);

        if (!live) {
          controls.stop();
          return;
        }
        controlsRef.current = controls;
        setTorchAvailable(Boolean(controls.switchTorch));

        // A permission can succeed while another tab/app holds the camera and
        // no frame arrives. Do not misleadingly label that state "Ready".
        window.setTimeout(() => {
          if (live && preview.videoWidth === 0) setWaitingForFrames(true);
        }, 3500);

        return () => {
          preview.removeEventListener("playing", markPlaying);
          preview.removeEventListener("loadeddata", markPlaying);
        };
      } catch {
        if (live) {
          setError("Camera access is unavailable. You can enter the barcode below instead.");
        }
      }
    });

    return () => {
      live = false;
      controlsRef.current?.stop();
    };
  }, [onDetected]);

  const toggleTorch = async () => {
    const next = !torchOn;
    try {
      await controlsRef.current?.switchTorch?.(next);
      setTorchOn(next);
    } catch {
      setTorchAvailable(false);
    }
  };

  return (
    <div className="barcode-scanner">
      <button type="button" onClick={onClose} aria-label="Close camera" className="scanner-close">
        <X size={19} />
      </button>

      {error ? (
        <div className="scanner-error">
          <CameraOff size={32} />
          <p>{error}</p>
        </div>
      ) : (
        <div className="scanner-viewport">
          <video ref={video} playsInline muted />
          <div className="scanner-shade" aria-hidden>
            <span className="scanner-corner corner-tl" />
            <span className="scanner-corner corner-tr" />
            <span className="scanner-corner corner-bl" />
            <span className="scanner-corner corner-br" />
            <span className="scanner-beam" />
          </div>
          <div className="scanner-status">
            <ScanBarcode size={17} />
            {ready
              ? "Ready — align one barcode"
              : waitingForFrames
                ? "Waiting for camera…"
                : "Starting camera…"}
          </div>
          {torchAvailable && (
            <button type="button" className="scanner-torch" onClick={toggleTorch} aria-pressed={torchOn}>
              <Flashlight size={17} />
              {torchOn ? "Light on" : "Light"}
            </button>
          )}
        </div>
      )}
      {!error && (
        <p className="scanner-help">
          {waitingForFrames
            ? "No video frame arrived. Close other camera tabs or apps, then close and reopen the scanner."
            : "Fill the frame with the bars. Detection happens automatically."}
        </p>
      )}
    </div>
  );
}
