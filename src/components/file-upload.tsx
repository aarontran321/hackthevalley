"use client";

import { useRef } from "react";
import { Camera, Upload } from "lucide-react";

export function FileUpload({ onFile, label = "Choose an image", capture }: { onFile: (file: File) => void; label?: string; capture?: boolean }) {
  const ref = useRef<HTMLInputElement>(null);
  return <>
    <input ref={ref} type="file" accept="image/jpeg,image/png,image/webp" capture={capture ? "environment" : undefined} hidden onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} />
    <button type="button" className="btn btn-outline" onClick={() => ref.current?.click()}>{capture ? <Camera size={18} /> : <Upload size={18} />}{label}</button>
  </>;
}
