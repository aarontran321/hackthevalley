"use client";

import { useEffect, useRef, useState } from "react";
import { CameraOff, X } from "lucide-react";

export function BarcodeCamera({ onDetected, onClose }: { onDetected: (code: string) => void; onClose: () => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState("");
  // Drives the sweep: on only while the decoder is genuinely running, so the
  // animation never implies scanning during setup, after a hit, or on failure.
  const [scanning, setScanning] = useState(false);
  useEffect(() => {
    let controls: { stop: () => void } | undefined;
    let live = true;
    import("@zxing/browser").then(async ({ BrowserMultiFormatReader }) => {
      try {
        const reader = new BrowserMultiFormatReader();
        controls = await reader.decodeFromVideoDevice(undefined, video.current!, (result) => {
          if (result && live) {
            live = false;
            setScanning(false);
            controls?.stop();
            onDetected(result.getText());
          }
        });
        if (live) setScanning(true);
        else controls.stop();
      } catch {
        setScanning(false);
        setError("Camera access is unavailable. You can enter the barcode below instead.");
      }
    });
    return () => { live = false; setScanning(false); controls?.stop(); };
  }, [onDetected]);
  return (
    <div style={{ padding: 16, background: "#17221e", borderRadius: 18, position: "relative", color: "white" }}>
      <button type="button" onClick={onClose} aria-label="Close camera" style={{ position: "absolute", right: 25, top: 25, zIndex: 2, border: 0, borderRadius: 99, padding: 8, background: "rgba(0,0,0,.5)", color: "white", cursor: "pointer" }}><X size={18} /></button>
      {error ? <div style={{ minHeight: 220, display: "grid", placeItems: "center", textAlign: "center", padding: 30 }}><div><CameraOff size={30} /><p>{error}</p></div></div> : (
        <div className="scan-stage">
          <video ref={video} style={{ display: "block", width: "100%", minHeight: 260, maxHeight: 390, objectFit: "cover" }} />
          {scanning && <><div className="scan-sweep" aria-hidden /><div className="scan-reticle" aria-hidden /></>}
        </div>
      )}
      <div role="status" hidden={!!error} style={{ textAlign: "center", fontSize: 12, opacity: .8, paddingTop: 10, display: error ? "none" : "flex", alignItems: "center", justifyContent: "center", gap: 7 }}>
        {scanning && <span aria-hidden style={{ width: 7, height: 7, borderRadius: 99, background: "#78d6a4", flex: "none" }} className="spin-pulse" />}
        {scanning ? "Scanning… hold the barcode steady inside the frame." : "Hold the barcode steady inside the camera view."}
      </div>
    </div>
  );
}
