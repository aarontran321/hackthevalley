"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, CheckCircle2, LoaderCircle, PlusCircle, Printer, Sparkles } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { apiPost } from "@/lib/client-api";
import { demoWeeklySummary } from "@/data/demo";
import { storage } from "@/lib/storage";
import type { WeeklySummary } from "@/types";

export default function WeeklySummaryPage() {
  const [summary, setSummary] = useState<WeeklySummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => setSummary(storage.summary()), []);
  const generate = async () => {
    const entries = storage.entries();
    if (!entries.length) return;
    setLoading(true); setError("");
    try {
      const data = await apiPost<{ summary: WeeklySummary }>("/api/weekly-summary", { profile: storage.profile(), entries });
      storage.saveSummary(data.summary); setSummary(data.summary);
    } catch (e) { setError(e instanceof Error ? e.message : "Summary is unavailable."); }
    finally { setLoading(false); }
  };
  const demo = () => { storage.saveSummary(demoWeeklySummary); setSummary(demoWeeklySummary); setError(""); };
  return (
    <AppShell>
      <main className="page container cohesive-page weekly-page" style={{ maxWidth: 1000 }}>
        <div className="no-print" style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", flexWrap: "wrap" }}><Link href="/tracker" className="muted" style={{ display: "flex", gap: 7, alignItems: "center", fontWeight: 700 }}><ArrowLeft size={17} /> Back to tracker</Link><button className="btn btn-outline" onClick={() => window.print()}><Printer size={17} /> Print or save PDF</button></div>
        {!summary ? <section className="card card-pad" style={{ marginTop: 22, textAlign: "center", paddingBlock: 60 }}><Sparkles size={38} color="#765e88" /><h1 className="title" style={{ margin: "16px 0 8px" }}>Find the story in your week.</h1><p className="subtitle" style={{ maxWidth: 650, margin: "0 auto 25px" }}>Gemini can look across your logged foods for recurring ingredients, food-group representation, and practical alternatives. It cannot diagnose a deficiency.</p><div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}><button className="btn btn-primary" onClick={generate} disabled={loading || !storage.entries().length}>{loading ? <LoaderCircle className="spin" size={18} /> : <Sparkles size={18} />} Generate with Gemini</button><button className="btn btn-soft" onClick={demo}>View seeded demo summary</button></div>{error && <div className="notice" style={{ maxWidth: 580, margin: "20px auto 0" }}>{error}</div>}</section> :
          <article className="fade-up">
            {summary.isDemo && <div className="notice" style={{ marginTop: 20, background: "#e8e6f0" }}><b>Demo summary:</b> This is seeded sample content, not a live Gemini response.</div>}
            <section style={{ padding: "45px 0 30px" }}><div className="eyebrow">Your weekly nutri.ai reflection</div><h1 className="title" style={{ maxWidth: 750, margin: "12px 0 17px" }}>{summary.headline}</h1><p className="subtitle" style={{ maxWidth: 830 }}>{summary.overview}</p><small className="muted">Generated {new Date(summary.generatedAt).toLocaleString()}</small></section>
            <section className="card card-pad"><div className="eyebrow">Patterns observed</div><h2 style={{ margin: "9px 0 18px" }}>What appeared in your log</h2>{summary.patterns.map((item) => <div key={item} style={{ display: "flex", gap: 11, padding: "12px 0", borderTop: "1px solid var(--line)", lineHeight: 1.55 }}><CheckCircle2 size={18} color="#53755f" style={{ flex: "0 0 auto", marginTop: 2 }} />{item}</div>)}</section>
            <div className="grid-2" style={{ marginTop: 20 }}>
              <section className="card card-pad" style={{ background: "#e9f0e5" }}><div className="eyebrow"><PlusCircle size={14} style={{ display: "inline", marginRight: 6 }} />Consider adding</div>{summary.addMore.map((item) => <div key={item.name} style={{ marginTop: 18 }}><b>{item.name}</b><p className="muted" style={{ lineHeight: 1.5, margin: "5px 0" }}>{item.reason}</p></div>)}</section>
              <section className="card card-pad" style={{ background: "#f5e9d8" }}><div className="eyebrow">Consider moderating</div>{summary.moderate.map((item) => <div key={item.name} style={{ marginTop: 18 }}><b>{item.name}</b><p className="muted" style={{ lineHeight: 1.5, margin: "5px 0" }}>{item.reason}</p></div>)}</section>
            </div>
            <section className="card card-pad" style={{ marginTop: 20 }}><div className="eyebrow">Preference-friendly swaps</div><div className="grid-2" style={{ marginTop: 16 }}>{summary.alternatives.map((item) => <div key={item.name} style={{ padding: 17, background: "#f4f1eb", borderRadius: 15 }}><b>{item.name}</b><p className="muted" style={{ marginBottom: 0, lineHeight: 1.5 }}>{item.reason}</p></div>)}</div></section>
            <section className="card card-pad" style={{ marginTop: 20, background: "var(--lavender)" }}><div className="eyebrow">Questions for your care team</div>{summary.providerQuestions.map((item) => <p key={item}>“{item}”</p>)}</section>
            <div className="notice" style={{ marginTop: 20 }}><b>Important limitations:</b> {summary.limitations.join(" ")} nutri.ai never uses logged scans to diagnose a nutrient deficiency.</div>
            <div className="no-print" style={{ display: "flex", gap: 10, justifyContent: "center", marginTop: 25 }}><button className="btn btn-outline" onClick={generate} disabled={loading}>{loading ? "Refreshing…" : "Refresh with Gemini"}</button></div>
          </article>}
      </main>
    </AppShell>
  );
}
