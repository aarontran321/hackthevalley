"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { Barcode, Camera, ImageIcon, Keyboard, LoaderCircle, PlayCircle, ScanLine, Sparkles } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { FileUpload } from "@/components/file-upload";
import { BarcodeCamera } from "@/components/barcode-camera";
import { StatusBadge } from "@/components/icons";
import { apiPost, imageToDataUrl } from "@/lib/client-api";
import { storage } from "@/lib/storage";
import { demoAnalyses, demoScreenshotItems } from "@/data/demo";
import type { FoodAnalysis, ScreenshotItem } from "@/types";

type Mode = "barcode" | "photo" | "screenshot" | "text";
const tabs = [
  { id: "barcode", label: "Barcode", icon: Barcode },
  { id: "photo", label: "Food photo", icon: Camera },
  { id: "screenshot", label: "Screenshot", icon: ImageIcon },
  { id: "text", label: "Text search", icon: Keyboard }
] as const;

export default function ScanPage() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("barcode");
  const [barcode, setBarcode] = useState("");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState("");
  const [error, setError] = useState("");
  const [camera, setCamera] = useState(false);
  const [preview, setPreview] = useState("");
  const [screenshotItems, setScreenshotItems] = useState<ScreenshotItem[]>([]);

  const openAnalysis = useCallback((analysis: FoodAnalysis) => {
    storage.saveAnalysis(analysis);
    router.push(`/analysis/${analysis.id}`);
  }, [router]);

  const handleError = (value: unknown) => {
    setError(value instanceof Error ? value.message : "Something went wrong. Try a demo example.");
    setLoading("");
  };

  const analyseBarcode = async (code = barcode) => {
    setError(""); setLoading("Looking up product…"); setCamera(false);
    try {
      const productResponse = await fetch(`/api/product/${encodeURIComponent(code)}`);
      const productData = await productResponse.json();
      if (!productResponse.ok) throw new Error(productData?.error?.message || "Product lookup failed.");
      setLoading("Applying your pregnancy context…");
      const data = await apiPost<{ analysis: FoodAnalysis }>("/api/analyse/barcode", { product: productData.product, profile: storage.profile() });
      openAnalysis(data.analysis);
    } catch (e) { handleError(e); }
  };

  const analyseImage = async (file: File, screenshot: boolean) => {
    setError(""); setScreenshotItems([]); setLoading(screenshot ? "Finding every visible product…" : "Identifying your food…");
    try {
      const image = await imageToDataUrl(file);
      setPreview(image);
      if (screenshot) {
        const data = await apiPost<{ items: ScreenshotItem[] }>("/api/analyse/screenshot", { image, profile: storage.profile() });
        setScreenshotItems(data.items);
        setLoading("");
      } else {
        const data = await apiPost<{ analysis: FoodAnalysis }>("/api/analyse/image", { image, profile: storage.profile() });
        openAnalysis({ ...data.analysis, imageUrl: image });
      }
    } catch (e) { handleError(e); }
  };

  const analyseText = async () => {
    setError(""); setLoading("Reasoning with trusted guidance…");
    try {
      const data = await apiPost<{ analysis: FoodAnalysis }>("/api/analyse/text", { query, profile: storage.profile() });
      openAnalysis(data.analysis);
    } catch (e) { handleError(e); }
  };

  const loadScreenshotDemo = () => {
    setError(""); setPreview("/demo-shopping.svg"); setScreenshotItems(demoScreenshotItems); setLoading("");
  };

  return (
    <AppShell>
      <main className="page container">
        <div style={{ textAlign: "center", maxWidth: 720, margin: "0 auto 30px" }}>
          <div className="eyebrow"><Sparkles size={14} style={{ display: "inline", marginRight: 6 }} />Your food, in context</div>
          <h1 className="title" style={{ margin: "9px 0 12px" }}>What would you like to check?</h1>
          <p className="subtitle" style={{ margin: 0 }}>We’ll combine what’s visible with your pregnancy profile and curated public-health guidance.</p>
        </div>
        <div className="card" style={{ maxWidth: 900, margin: "0 auto", overflow: "hidden" }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", borderBottom: "1px solid var(--line)", overflowX: "auto" }}>
            {tabs.map(({ id, label, icon: Icon }) => <button type="button" key={id} onClick={() => { setMode(id); setError(""); setPreview(""); setScreenshotItems([]); }} style={{ minWidth: 130, padding: "18px 10px", border: 0, borderBottom: mode === id ? "3px solid var(--ink)" : "3px solid transparent", background: mode === id ? "#f5f1e9" : "transparent", cursor: "pointer", fontWeight: 750 }}><Icon size={18} style={{ verticalAlign: "middle", marginRight: 7 }} />{label}</button>)}
          </div>
          <div className="card-pad" style={{ minHeight: 340 }}>
            {mode === "barcode" && <div>
              <h2 style={{ marginTop: 0 }}>Scan a packaged product</h2>
              <p className="muted">Use your camera or enter the digits printed beneath the barcode.</p>
              {camera && <div style={{ margin: "20px 0" }}><BarcodeCamera onDetected={(code) => { setBarcode(code); analyseBarcode(code); }} onClose={() => setCamera(false)} /></div>}
              {!camera && <button className="btn btn-soft" type="button" onClick={() => setCamera(true)}><ScanLine size={18} /> Open camera scanner</button>}
              <div style={{ display: "flex", gap: 10, alignItems: "end", marginTop: 24, maxWidth: 570 }}>
                <label style={{ flex: 1 }}><span className="label">Barcode number</span><input className="input" inputMode="numeric" placeholder="e.g. 3017620422003" value={barcode} onChange={(e) => setBarcode(e.target.value.replace(/\D/g, ""))} /></label>
                <button className="btn btn-primary" disabled={barcode.length < 8 || !!loading} onClick={() => analyseBarcode()}>{loading ? <LoaderCircle className="spin" size={18} /> : "Look up"}</button>
              </div>
            </div>}
            {mode === "photo" && <div>
              <h2 style={{ marginTop: 0 }}>Photograph a food or meal</h2>
              <p className="muted">Useful for restaurant meals, deli items, produce, and products without readable packaging.</p>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 22 }}><FileUpload capture onFile={(file) => analyseImage(file, false)} label="Take a photo" /><FileUpload onFile={(file) => analyseImage(file, false)} label="Upload image" /></div>
            </div>}
            {mode === "screenshot" && <div>
              <h2 style={{ marginTop: 0 }}>Analyse an online shopping screen</h2>
              <p className="muted">Gemini will extract each visible food or menu item, then show a separate pregnancy-aware result.</p>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 22 }}><FileUpload onFile={(file) => analyseImage(file, true)} label="Upload screenshot" /><button type="button" className="btn btn-soft" onClick={loadScreenshotDemo}><PlayCircle size={18} /> Try demo screenshot</button></div>
              <p style={{ fontSize: 12, color: "var(--muted)" }}>Proof of concept for a future browser extension. The demo is seeded data, not live Gemini output.</p>
            </div>}
            {mode === "text" && <div>
              <h2 style={{ marginTop: 0 }}>Search by food, ingredient, or meal</h2>
              <p className="muted">Include preparation details or a brand when you know them—the more context, the better.</p>
              <label style={{ display: "block", maxWidth: 650, marginTop: 22 }}><span className="label">What would you like to check?</span><textarea className="input" rows={4} placeholder="e.g. eggs Benedict with runny poached eggs at a restaurant" value={query} onChange={(e) => setQuery(e.target.value)} /></label>
              <button className="btn btn-primary" style={{ marginTop: 12 }} disabled={query.trim().length < 2 || !!loading} onClick={analyseText}>{loading ? <LoaderCircle className="spin" size={18} /> : "Analyse food"}</button>
            </div>}
            {loading && <div className="notice" style={{ marginTop: 22, display: "flex", gap: 10 }}><LoaderCircle className="spin" size={18} />{loading} This can take a few moments.</div>}
            {error && <div className="notice" role="alert" style={{ marginTop: 22, background: "#f5e4df", color: "#724b48" }}><b>We couldn’t complete that.</b><br />{error}</div>}
            {/* User-selected data URLs cannot be routed through the Next image optimizer. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {preview && mode === "screenshot" && <img src={preview} alt="Uploaded shopping screenshot preview" style={{ display: "block", maxWidth: "100%", maxHeight: 300, objectFit: "contain", margin: "24px auto", borderRadius: 14, border: "1px solid var(--line)" }} />}
            {!!screenshotItems.length && <div><div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", margin: "25px 0 12px" }}><h3 style={{ margin: 0 }}>{screenshotItems.length} products detected</h3><span className="status status-insufficient">{screenshotItems[0].analysis?.isDemo ? "Demo data" : "Gemini analysis"}</span></div><div className="grid-2">{screenshotItems.map((item, i) => <div className="card card-pad" key={`${item.name}-${i}`}><small className="muted">{item.brand || "Brand not visible"} · {Math.round(item.confidence * 100)}% identified</small><h3 style={{ margin: "7px 0 10px" }}>{item.name}</h3>{item.analysis && <><StatusBadge status={item.analysis.status} /><p className="muted" style={{ lineHeight: 1.5, fontSize: 14 }}>{item.analysis.summary}</p><button type="button" className="btn btn-outline" onClick={() => openAnalysis(item.analysis!)}>Full analysis</button></>}</div>)}</div></div>}
          </div>
        </div>
        <section style={{ maxWidth: 900, margin: "22px auto 0" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}><PlayCircle size={18} /><b>Try a reliable demo example</b><span className="muted" style={{ fontSize: 12 }}>Seeded data, clearly labeled</span></div>
          <div className="grid-3">{demoAnalyses.map((analysis) => <button type="button" key={analysis.id} onClick={() => openAnalysis(analysis)} className="card card-pad" style={{ textAlign: "left", cursor: "pointer", color: "inherit" }}><StatusBadge status={analysis.status} /><b style={{ display: "block", marginTop: 12 }}>{analysis.itemName}</b></button>)}</div>
        </section>
      </main>
    </AppShell>
  );
}
