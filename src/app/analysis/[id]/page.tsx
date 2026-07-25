"use client";

import { FormEvent, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, BookOpen, Check, ExternalLink, LoaderCircle, MessageCircle, Plus, Send, Sparkles } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Receipt } from "@/components/receipt";
import { storage, DEFAULT_PROFILE } from "@/lib/storage";
import { demoAnalyses } from "@/data/demo";
import guidance from "@/data/guidance.json";
import { apiPost } from "@/lib/client-api";
import type { ConsumptionEntry, FoodAnalysis, UserProfile } from "@/types";

type ChatMessage = { role: "user" | "assistant"; content: string };

/**
 * Result view. The receipt holds the decision; everything that explains,
 * extends or acts on it sits beside and beneath, so neither surface is
 * overloaded.
 */
export default function AnalysisPage() {
  const params = useParams<{ id: string }>();
  const [analysis, setAnalysis] = useState<FoodAnalysis | null>(null);
  const [profile, setProfile] = useState<UserProfile>(DEFAULT_PROFILE);
  const [mealType, setMealType] = useState<ConsumptionEntry["mealType"]>("snack");
  const [quantity, setQuantity] = useState("1 serving");
  const [logged, setLogged] = useState(false);
  const [chat, setChat] = useState<ChatMessage[]>([]);
  const [question, setQuestion] = useState("");
  const [asking, setAsking] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setAnalysis(storage.analysis(params.id) || demoAnalyses.find((item) => item.id === params.id) || null);
    setProfile(storage.profile());
  }, [params.id]);

  if (!analysis) {
    return (
      <AppShell>
        <main className="page container">
          <div className="card card-pad">
            <h1>Analysis not found</h1>
            <p className="muted">This result may have been cleared from local browser storage.</p>
            <Link className="btn btn-primary" href="/scan">Start a new scan</Link>
          </div>
        </main>
      </AppShell>
    );
  }

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
    try {
      const data = await apiPost<{ message: string }>("/api/chat", { profile: storage.profile(), analysis, messages: next });
      setChat([...next, { role: "assistant", content: data.message }]);
    } catch (e) {
      setChat(chat);
      setQuestion(next.at(-1)?.content || "");
      setError(e instanceof Error ? e.message : "Chat is unavailable right now.");
    }
    finally { setAsking(false); }
  };

  return (
    <AppShell>
      <main className="page container">
        <Link href="/scan" className="muted" style={{ display: "inline-flex", alignItems: "center", gap: 7, fontWeight: 600, fontSize: 14 }}>
          <ArrowLeft size={17} /> Back to scan
        </Link>

        {/* Kept deliberately. 59023df removed this label so seeded fallback
            would "read as a normal live result"; the README's own rule is that
            seeded content is always labelled and never presented as live
            Gemini output, and this is a health tool whose value is that a
            verdict can be checked. */}
        {analysis.isDemo && (
          <div className="notice" style={{ marginTop: 18 }}>
            <b>Demo result:</b> seeded sample data for a reliable presentation, not a live Gemini response.
          </div>
        )}

        {/* Receipt on the rail, the reasoning beside it. */}
        <div className="result-layout" style={{ marginTop: 22 }}>
          <div className="receipt-rail">
            <Receipt analysis={analysis} pregnancyWeek={profile.pregnancyWeek} />
          </div>

          <div style={{ display: "grid", gap: 24 }}>
            <section>
              <div className="eyebrow">Why this result</div>
              <div className="panel-rule" />
              <p style={{ margin: 0, lineHeight: 1.72, fontSize: 16 }}>{analysis.explanation}</p>

              {!!analysis.flaggedIngredients.length && (
                <div style={{ display: "grid", gap: 10, marginTop: 20 }}>
                  {analysis.flaggedIngredients.map((item) => (
                    <div key={item.ingredient} className="card card-pad" style={{ boxShadow: "none", padding: 16 }}>
                      <b>{item.ingredient}</b>
                      <p className="muted" style={{ margin: "5px 0 0", lineHeight: 1.55, fontSize: 14 }}>{item.reason}</p>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section>
              <div className="eyebrow">In your context</div>
              <div className="panel-rule" />
              <dl style={{ margin: 0, display: "grid", gap: 14 }}>
                <div>
                  <dt className="mono" style={{ fontSize: 11.5, letterSpacing: ".1em", textTransform: "uppercase", color: "var(--muted)" }}>Trimester</dt>
                  <dd style={{ margin: "4px 0 0", lineHeight: 1.6, fontSize: 14.5 }}>{analysis.trimesterContext}</dd>
                </div>
                {analysis.conditionContext && (
                  <div>
                    <dt className="mono" style={{ fontSize: 11.5, letterSpacing: ".1em", textTransform: "uppercase", color: "var(--muted)" }}>Health context</dt>
                    <dd style={{ margin: "4px 0 0", lineHeight: 1.6, fontSize: 14.5 }}>{analysis.conditionContext}</dd>
                  </div>
                )}
                {analysis.moderationGuidance && (
                  <div>
                    <dt className="mono" style={{ fontSize: 11.5, letterSpacing: ".1em", textTransform: "uppercase", color: "var(--muted)" }}>Portion &amp; preparation</dt>
                    <dd style={{ margin: "4px 0 0", lineHeight: 1.6, fontSize: 14.5 }}>{analysis.moderationGuidance}</dd>
                  </div>
                )}
              </dl>
            </section>

            {!!analysis.alternatives.length && (
              <section>
                <div className="eyebrow">Same craving, another option</div>
                <div className="panel-rule" />
                <div className="grid-2" style={{ gap: 12 }}>
                  {analysis.alternatives.map((item) => (
                    <div key={item.name} className="card card-pad" style={{ boxShadow: "none", background: "var(--sage)", border: 0, padding: 16 }}>
                      <b>{item.name}</b>
                      <p style={{ margin: "5px 0 0", lineHeight: 1.55, fontSize: 14, color: "#33513f" }}>{item.reason}</p>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>
        </div>

        <section className="grid-2" style={{ marginTop: 34, gridTemplateColumns: "1.1fr .9fr" }}>
          <div className="card card-pad">
            <div className="eyebrow"><BookOpen size={13} style={{ display: "inline", marginRight: 6 }} />Grounded in trusted guidance</div>
            <h2 style={{ margin: "10px 0 4px", fontSize: 19 }}>Sources used</h2>
            {sourceCards.length ? sourceCards.map((source) => (
              <a
                key={source.id}
                href={source.url}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`Open ${source.title} from ${source.organization}`}
                title={source.url}
                style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "13px 0", borderTop: "1px solid var(--line)" }}
              >
                <span>
                  <b>{source.title}</b><br />
                  <small className="muted mono" style={{ fontSize: 11.5 }}>{source.organization} · Open official guidance ↗</small>
                </span>
                <ExternalLink size={16} />
              </a>
            )) : <p className="notice" style={{ marginTop: 12 }}>No supplied source supported a firm conclusion, so this result is marked as not enough information.</p>}
            {!!analysis.limitations.length && (
              <div className="notice" style={{ marginTop: 14 }}><b>What we couldn&rsquo;t verify:</b> {analysis.limitations.join(" ")}</div>
            )}
          </div>

          <div className="card card-pad">
            <div className="eyebrow">Remember this meal</div>
            <h2 style={{ margin: "10px 0 16px", fontSize: 19 }}>Add to today&rsquo;s log</h2>
            <div className="grid-2" style={{ gap: 10 }}>
              <label><span className="label">Meal</span>
                <select className="input" value={mealType} onChange={(e) => setMealType(e.target.value as ConsumptionEntry["mealType"])}>
                  <option>breakfast</option><option>lunch</option><option>dinner</option><option>snack</option>
                </select>
              </label>
              <label><span className="label">Quantity</span>
                <input className="input" value={quantity} onChange={(e) => setQuantity(e.target.value)} />
              </label>
            </div>
            <button className={`btn ${logged ? "btn-soft" : "btn-primary"}`} style={{ marginTop: 16, width: "100%" }} disabled={logged} onClick={addToLog}>
              {logged ? <><Check size={18} /> Added to tracker</> : <><Plus size={18} /> Add to log</>}
            </button>
          </div>
        </section>

        {!!analysis.questionsForProvider.length && (
          <section className="card card-pad" style={{ marginTop: 20, background: "var(--lavender)" }}>
            <div className="eyebrow"><Sparkles size={13} style={{ display: "inline", marginRight: 6 }} />Worth asking your care team</div>
            <div className="panel-rule" />
            {analysis.questionsForProvider.map((q) => (
              <p key={q} style={{ margin: "0 0 6px", fontSize: 15.5 }}>&ldquo;{q}&rdquo;</p>
            ))}
          </section>
        )}

        <section className="card card-pad" style={{ marginTop: 20 }}>
          <div className="eyebrow"><MessageCircle size={13} style={{ display: "inline", marginRight: 6 }} />Ask a follow-up</div>
          <h2 style={{ margin: "10px 0 6px", fontSize: 19 }}>Still wondering?</h2>
          <p className="muted" style={{ marginTop: 0, fontSize: 14.5 }}>Ask about portions, alternatives, trimester relevance, or which detail affected the result.</p>
          {!chat.length && (
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", margin: "16px 0" }}>
              {["Would a small portion change this?", "What could I choose instead?", "Which ingredient caused the warning?"].map((text) => (
                <button type="button" className="btn btn-outline" style={{ minHeight: 38, fontSize: 13 }} key={text} onClick={() => setQuestion(text)}>{text}</button>
              ))}
            </div>
          )}
          {chat.map((message, index) => (
            <div key={index} style={{ maxWidth: "82%", margin: message.role === "user" ? "10px 0 10px auto" : "10px auto 10px 0", padding: "13px 16px", borderRadius: 14, background: message.role === "user" ? "var(--ink)" : "var(--sage)", color: message.role === "user" ? "white" : "inherit", lineHeight: 1.55, fontSize: 14 }}>
              {message.content}
            </div>
          ))}
          {asking && <div className="muted" style={{ fontSize: 13 }}><LoaderCircle className="spin" size={15} style={{ display: "inline", marginRight: 7 }} />Preparing a grounded answer…</div>}
          {error && <div className="notice">{error}</div>}
          <form onSubmit={ask} style={{ display: "flex", gap: 9, marginTop: 16 }}>
            <input className="input" aria-label="Follow-up question" placeholder="Ask a question about this result…" value={question} onChange={(e) => setQuestion(e.target.value)} />
            <button className="btn btn-primary" aria-label="Send question" disabled={asking || !question.trim()}><Send size={18} /></button>
          </form>
        </section>
      </main>
    </AppShell>
  );
}
