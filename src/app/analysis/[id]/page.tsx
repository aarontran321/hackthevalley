"use client";

import { FormEvent, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, BookOpen, Check, ExternalLink, LoaderCircle, MessageCircle, Plus, Send, Sparkles } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { StatusBadge } from "@/components/icons";
import { storage } from "@/lib/storage";
import { demoAnalyses } from "@/data/demo";
import guidance from "@/data/guidance.json";
import { apiPost } from "@/lib/client-api";
import type { ConsumptionEntry, FoodAnalysis } from "@/types";

type ChatMessage = { role: "user" | "assistant"; content: string };

export default function AnalysisPage() {
  const params = useParams<{ id: string }>();
  const [analysis, setAnalysis] = useState<FoodAnalysis | null>(null);
  const [mealType, setMealType] = useState<ConsumptionEntry["mealType"]>("snack");
  const [quantity, setQuantity] = useState("1 serving");
  const [logged, setLogged] = useState(false);
  const [chat, setChat] = useState<ChatMessage[]>([]);
  const [question, setQuestion] = useState("");
  const [asking, setAsking] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => setAnalysis(storage.analysis(params.id) || demoAnalyses.find((item) => item.id === params.id) || null), [params.id]);

  if (!analysis) return <AppShell><main className="page container"><div className="card card-pad"><h1>Analysis not found</h1><p className="muted">This result may have been cleared from local browser storage.</p><Link className="btn btn-primary" href="/scan">Start a new scan</Link></div></main></AppShell>;
  const sourceCards = guidance.filter((source) => analysis.sourceIds.includes(source.id));

  const addToLog = () => {
    const entry: ConsumptionEntry = {
      id: crypto.randomUUID(),
      itemName: analysis.itemName,
      timestamp: new Date().toISOString(),
      mealType,
      quantity,
      safetyStatus: analysis.status,
      flaggedIngredients: analysis.flaggedIngredients.map((item) => item.ingredient),
      estimatedNutrients: analysis.nutrition,
      originalAnalysis: analysis
    };
    storage.saveEntries([entry, ...storage.entries()]);
    setLogged(true);
  };

  const ask = async (event: FormEvent) => {
    event.preventDefault();
    if (!question.trim()) return;
    const next = [...chat, { role: "user" as const, content: question.trim() }];
    setChat(next); setQuestion(""); setAsking(true); setError("");
    if (analysis.isDemo) {
      await new Promise((resolve) => setTimeout(resolve, 550));
      const ingredient = analysis.flaggedIngredients[0]?.ingredient;
      setChat([...next, { role: "assistant", content: ingredient ? `The main reason for this result is ${ingredient.toLowerCase()}. ${analysis.moderationGuidance || analysis.explanation} Because the exact product and your individual health context can matter, confirm an important decision with your obstetrician, midwife, dietitian, or another qualified professional.` : `${analysis.summary} ${analysis.moderationGuidance || ""} If you need advice for your individual pregnancy, a qualified healthcare professional can help.` }]);
      setAsking(false); return;
    }
    try {
      const data = await apiPost<{ message: string }>("/api/chat", { profile: storage.profile(), analysis, messages: next });
      setChat([...next, { role: "assistant", content: data.message }]);
    } catch (e) { setError(e instanceof Error ? e.message : "Chat is unavailable right now."); }
    finally { setAsking(false); }
  };

  return (
    <AppShell>
      <main className="page container" style={{ maxWidth: 1000 }}>
        <Link href="/scan" className="muted" style={{ display: "inline-flex", alignItems: "center", gap: 7, fontWeight: 700, fontSize: 14 }}><ArrowLeft size={17} /> Back to scan</Link>
        {analysis.isDemo && <div className="notice" style={{ marginTop: 20, background: "#e8e6f0" }}><b>Demo result:</b> This is seeded sample data for a reliable presentation, not a live Gemini response.</div>}
        <section className="card" style={{ overflow: "hidden", marginTop: 16 }}>
          <div style={{ background: analysis.status === "generally_suitable" ? "#e5eee2" : analysis.status === "use_caution" ? "#f6e7c7" : "#f1dddd", padding: "38px clamp(20px,5vw,55px)" }}>
            <StatusBadge status={analysis.status} />
            <h1 className="title" style={{ margin: "15px 0 12px" }}>{analysis.itemName}</h1>
            <p style={{ fontSize: 19, lineHeight: 1.55, maxWidth: 760, margin: 0 }}>{analysis.summary}</p>
            <div style={{ marginTop: 17, fontSize: 13, color: "var(--muted)" }}>Confidence: <b>{Math.round(analysis.confidence * 100)}%</b> · {analysis.confidence < .7 ? "Identification or product details remain uncertain" : "Based on available product details"}</div>
          </div>
          <div style={{ padding: "32px clamp(20px,5vw,55px)" }}>
            <div className="grid-2" style={{ gridTemplateColumns: "1.25fr .75fr" }}>
              <div>
                <div className="eyebrow">Why this result</div>
                <p style={{ lineHeight: 1.7 }}>{analysis.explanation}</p>
                {!!analysis.flaggedIngredients.length && <div style={{ marginTop: 24 }}>
                  {analysis.flaggedIngredients.map((item) => <div key={item.ingredient} style={{ padding: 18, background: "#f5eee7", borderRadius: 16, marginBottom: 10 }}><b>{item.ingredient}</b><p className="muted" style={{ margin: "6px 0 0", lineHeight: 1.5 }}>{item.reason}</p></div>)}
                </div>}
              </div>
              <aside style={{ background: "#f6f3ed", borderRadius: 18, padding: 20 }}>
                <b>At a glance</b>
                <div style={{ marginTop: 16 }}><small className="eyebrow">Trimester context</small><p style={{ lineHeight: 1.55, fontSize: 14 }}>{analysis.trimesterContext}</p></div>
                {analysis.conditionContext && <div><small className="eyebrow">Your health context</small><p style={{ lineHeight: 1.55, fontSize: 14 }}>{analysis.conditionContext}</p></div>}
                {analysis.moderationGuidance && <div><small className="eyebrow">Portion & preparation</small><p style={{ lineHeight: 1.55, fontSize: 14 }}>{analysis.moderationGuidance}</p></div>}
              </aside>
            </div>
            {!!analysis.alternatives.length && <div style={{ marginTop: 36 }}><div className="eyebrow">Same craving, another option</div><div className="grid-2" style={{ marginTop: 13 }}>{analysis.alternatives.map((item) => <div key={item.name} className="card card-pad" style={{ boxShadow: "none", background: "#edf2e9" }}><b>{item.name}</b><p className="muted" style={{ marginBottom: 0, lineHeight: 1.5 }}>{item.reason}</p></div>)}</div></div>}
          </div>
        </section>
        <section className="grid-2" style={{ marginTop: 20, gridTemplateColumns: "1.1fr .9fr" }}>
          <div className="card card-pad">
            <div className="eyebrow"><BookOpen size={14} style={{ display: "inline", marginRight: 6 }} />Grounded in trusted guidance</div>
            <h2 style={{ margin: "9px 0 15px" }}>Sources used</h2>
            {sourceCards.length ? sourceCards.map((source) => <a key={source.id} href={source.url} target="_blank" rel="noreferrer" style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "14px 0", borderTop: "1px solid var(--line)" }}><span><b>{source.title}</b><br /><small className="muted">{source.organization} · {source.id}</small></span><ExternalLink size={17} /></a>) : <p className="notice">No supplied source supported a firm conclusion, so this result is marked as not enough information.</p>}
            {!!analysis.limitations.length && <div className="notice" style={{ marginTop: 16 }}><b>What we couldn’t verify:</b> {analysis.limitations.join(" ")}</div>}
          </div>
          <div className="card card-pad">
            <div className="eyebrow">Remember this meal</div><h2 style={{ margin: "9px 0 16px" }}>Add to today’s log</h2>
            <div className="grid-2" style={{ gap: 10 }}>
              <label><span className="label">Meal</span><select className="input" value={mealType} onChange={(e) => setMealType(e.target.value as ConsumptionEntry["mealType"])}><option>breakfast</option><option>lunch</option><option>dinner</option><option>snack</option></select></label>
              <label><span className="label">Quantity</span><input className="input" value={quantity} onChange={(e) => setQuantity(e.target.value)} /></label>
            </div>
            <button className={`btn ${logged ? "btn-soft" : "btn-primary"}`} style={{ marginTop: 16, width: "100%" }} disabled={logged} onClick={addToLog}>{logged ? <><Check size={18} /> Added to tracker</> : <><Plus size={18} /> Add to log</>}</button>
          </div>
        </section>
        <section className="card card-pad" style={{ marginTop: 20 }}>
          <div className="eyebrow"><MessageCircle size={14} style={{ display: "inline", marginRight: 6 }} />Ask a follow-up</div><h2 style={{ margin: "9px 0 6px" }}>Still wondering?</h2><p className="muted" style={{ marginTop: 0 }}>Ask about portions, alternatives, trimester relevance, or which detail affected the result.</p>
          {!chat.length && <div style={{ display: "flex", gap: 8, flexWrap: "wrap", margin: "16px 0" }}>{["Would a small portion change this?", "What could I choose instead?", "Which ingredient caused the warning?"].map((text) => <button type="button" className="btn btn-outline" style={{ minHeight: 38, fontSize: 13 }} key={text} onClick={() => setQuestion(text)}>{text}</button>)}</div>}
          {chat.map((message, index) => <div key={index} style={{ maxWidth: "82%", margin: message.role === "user" ? "10px 0 10px auto" : "10px auto 10px 0", padding: "13px 16px", borderRadius: 16, background: message.role === "user" ? "var(--ink)" : "var(--sage)", color: message.role === "user" ? "white" : "inherit", lineHeight: 1.55, fontSize: 14 }}>{message.content}</div>)}
          {asking && <div className="muted" style={{ fontSize: 13 }}><LoaderCircle className="spin" size={15} style={{ display: "inline", marginRight: 7 }} />Preparing a grounded answer…</div>}
          {error && <div className="notice">{error}</div>}
          <form onSubmit={ask} style={{ display: "flex", gap: 9, marginTop: 16 }}><input className="input" aria-label="Follow-up question" placeholder="Ask a question about this result…" value={question} onChange={(e) => setQuestion(e.target.value)} /><button className="btn btn-primary" aria-label="Send question" disabled={asking || !question.trim()}><Send size={18} /></button></form>
        </section>
        {!!analysis.questionsForProvider.length && <section className="card card-pad" style={{ marginTop: 20, background: "var(--lavender)" }}><div className="eyebrow"><Sparkles size={14} style={{ display: "inline", marginRight: 6 }} />Worth asking your care team</div>{analysis.questionsForProvider.map((q) => <p key={q} style={{ marginBottom: 0 }}>“{q}”</p>)}</section>}
      </main>
    </AppShell>
  );
}
