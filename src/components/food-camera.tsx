"use client";

import { useEffect, useRef, useState } from "react";
import { Camera, CameraOff, RefreshCw, X } from "lucide-react";

export function FoodCamera({
  onCapture,
  onClose,
}: {
  onCapture: (file: File) => void;
  onClose: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [error, setError] = useState("");
  const [facingMode, setFacingMode] = useState<"environment" | "user">("environment");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let active = true;

    async function startCamera() {
      setReady(false);
      setError("");
      streamRef.current?.getTracks().forEach((track) => track.stop());

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: facingMode },
            width: { ideal: 1920 },
            height: { ideal: 1080 },
          },
          audio: false,
        });
        if (!active) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
          setReady(true);
        }
      } catch {
        setError("Camera access is unavailable. Allow camera permission in your browser, or use Upload image instead.");
      }
    }

    startCamera();
    return () => {
      active = false;
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    };
  }, [facingMode]);

  const capture = () => {
    const video = videoRef.current;
    if (!video || !video.videoWidth || !video.videoHeight) return;

    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const context = canvas.getContext("2d");
    if (!context) return;
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        streamRef.current?.getTracks().forEach((track) => track.stop());
        onCapture(new File([blob], `bumpsafe-food-${Date.now()}.jpg`, { type: "image/jpeg" }));
      },
      "image/jpeg",
      0.9,
    );
  };

  return (
    <div style={{ padding: 16, background: "#17221e", borderRadius: 18, position: "relative", color: "white" }}>
      <button
        type="button"
        onClick={onClose}
        aria-label="Close camera"
        style={{ position: "absolute", right: 25, top: 25, zIndex: 2, border: 0, borderRadius: 99, padding: 8, background: "rgba(0,0,0,.55)", color: "white", cursor: "pointer" }}
      >
        <X size={18} />
      </button>

      {error ? (
        <div style={{ minHeight: 280, display: "grid", placeItems: "center", textAlign: "center", padding: 30 }}>
          <div><CameraOff size={32} /><p style={{ maxWidth: 430, lineHeight: 1.55 }}>{error}</p></div>
        </div>
      ) : (
        <div style={{ position: "relative" }}>
          <video
            ref={videoRef}
            autoPlay
            muted
            playsInline
            aria-label="Live food camera preview"
            style={{ width: "100%", minHeight: 300, maxHeight: 520, objectFit: "cover", borderRadius: 12, background: "#0b100e" }}
          />
          <div aria-hidden style={{ position: "absolute", inset: "12% 10%", border: "2px solid rgba(255,255,255,.7)", borderRadius: 20, pointerEvents: "none" }} />
        </div>
      )}

      {!error && (
        <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 18, paddingTop: 15 }}>
          <button
            type="button"
            onClick={() => setFacingMode((mode) => mode === "environment" ? "user" : "environment")}
            aria-label="Switch camera"
            style={{ width: 44, height: 44, display: "grid", placeItems: "center", border: "1px solid rgba(255,255,255,.4)", borderRadius: 99, background: "transparent", color: "white", cursor: "pointer" }}
          >
            <RefreshCw size={18} />
          </button>
          <button
            type="button"
            onClick={capture}
            disabled={!ready}
            aria-label="Take food photo"
            style={{ width: 68, height: 68, display: "grid", placeItems: "center", border: "5px solid white", borderRadius: 99, background: ready ? "#dfeadf" : "#758078", color: "#17221e", cursor: ready ? "pointer" : "wait" }}
          >
            <Camera size={25} />
          </button>
          <span style={{ width: 44 }} aria-hidden />
        </div>
      )}
      <div style={{ textAlign: "center", fontSize: 12, opacity: .78, paddingTop: 9 }}>
        Center the food in the frame, then tap the shutter.
      </div>
    </div>
  );
}
