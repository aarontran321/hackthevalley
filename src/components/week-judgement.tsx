"use client";

import { useState } from "react";
import Link from "next/link";
import {
  CheckCircle2,
  ExternalLink,
  Heart,
  LoaderCircle,
  MinusCircle,
  PlusCircle,
  Sparkles
} from "lucide-react";
import { apiPost } from "@/lib/client-api";
import { demoWeeklySummary } from "@/data/demo";
import { storage } from "@/lib/storage";
import type { ConsumptionEntry, WeeklySummary } from "@/types";

/**
 * The three verdict buckets Gemini returns, framed as the questions people
 * actually ask at the end of a week.
 */
const buckets = [
  {
    key: "addMore" as const,
    eyebrow: "Worth adding",
    title: "Eat a little more of",
    background: "#e9f0e5",
    icon: PlusCircle
  },
  {
    key: "moderate" as const,
    eyebrow: "Worth moderating",
    title: "Ease off slightly",
    background: "#f5e9d8",
    icon: MinusCircle
  },
  {
    key: "alternatives" as const,
    eyebrow: "Worth trying",
    title: "You might like",
    background: "#efe9f4",
    icon: Heart
  }
];

export function WeekJudgement({
  entries,
  summary,
  onSummary
}: {
  entries: ConsumptionEntry[];
  summary: WeeklySummary | null;
  onSummary: (summary: WeeklySummary) => void;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const generate = async () => {
    if (!entries.length) return;
    setLoading(true);
    setError("");
    try {
      const data = await apiPost<{ summary: WeeklySummary }>("/api/weekly-summary", {
        profile: storage.profile(),
        entries
      });
      storage.saveSummary(data.summary);
      onSummary(data.summary);
    } catch (e) {
      setError(e instanceof Error ? e.message : "The weekly judgement is unavailable right now.");
    } finally {
      setLoading(false);
    }
  };

  const useDemo = () => {
    storage.saveSummary(demoWeeklySummary);
    onSummary(demoWeeklySummary);
    setError("");
  };

  return (
    <section className="card card-pad" style={{ marginTop: 20 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
        <div>
          <div className="eyebrow"><Sparkles size={14} style={{ display: "inline", marginRight: 6 }} />Week judgement</div>
          <h2 style={{ margin: "8px 0 0" }}>How your week is shaping up</h2>
        </div>
        <div style={{ display: "flex", gap: 9, flexWrap: "wrap" }}>
          <button className="btn btn-primary" onClick={generate} disabled={loading || !entries.length} style={{ minHeight: 42, paddingInline: 16 }}>
            {loading ? <LoaderCircle className="spin" size={17} /> : <Sparkles size={17} />}
            {summary ? "Refresh judgement" : "Generate with Gemini"}
          </button>
          {summary && (
            <Link href="/weekly-summary" className="btn btn-outline" style={{ minHeight: 42, paddingInline: 16 }}>
              Full report <ExternalLink size={15} />
            </Link>
          )}
        </div>
      </div>

      {error && <div className="notice" style={{ marginTop: 16 }}>{error} <button onClick={useDemo} style={{ border: 0, background: "transparent", padding: 0, cursor: "pointer", fontWeight: 800, textDecoration: "underline" }}>Use the demo judgement instead</button></div>}

      {!summary ? (
        <div className="notice" style={{ marginTop: 16, lineHeight: 1.6 }}>
          {entries.length
            ? "Gemini can read across your logged foods and tell you what to add, what to ease off, and what you might enjoy instead — grounded in the approved guidance sources, never a diagnosis."
            : "Log a few foods first, then Gemini can look for patterns across your week."}
          {!!entries.length && <> <button onClick={useDemo} style={{ border: 0, background: "transparent", padding: 0, cursor: "pointer", fontWeight: 800, textDecoration: "underline" }}>Preview the demo judgement</button></>}
        </div>
      ) : (
        <div className="fade-up">
          {summary.isDemo && <div className="notice" style={{ marginTop: 16, background: "#e8e6f0" }}><b>Demo judgement:</b> seeded sample content, not a live Gemini response.</div>}

          <div style={{ marginTop: 20, padding: 20, background: "#f4f1eb", borderRadius: 18 }}>
            <b style={{ fontFamily: "Georgia,serif", fontSize: 21, lineHeight: 1.3 }}>{summary.headline}</b>
            <p className="muted" style={{ lineHeight: 1.65, margin: "10px 0 0" }}>{summary.overview}</p>
            <small className="muted" style={{ display: "block", marginTop: 12 }}>Generated {new Date(summary.generatedAt).toLocaleString()}</small>
          </div>

          {!!summary.patterns.length && (
            <div style={{ marginTop: 22 }}>
              <div className="eyebrow">Patterns in what you logged</div>
              {summary.patterns.map((item) => (
                <div key={item} style={{ display: "flex", gap: 11, padding: "11px 0", borderTop: "1px solid var(--line)", lineHeight: 1.55, fontSize: 14 }}>
                  <CheckCircle2 size={17} color="#53755f" style={{ flex: "0 0 auto", marginTop: 2 }} />
                  {item}
                </div>
              ))}
            </div>
          )}

          <div className="grid-3" style={{ marginTop: 22 }}>
            {buckets.map(({ key, eyebrow, title, background, icon: Icon }) => (
              <div key={key} className="card card-pad" style={{ background, boxShadow: "none" }}>
                <div className="eyebrow"><Icon size={14} style={{ display: "inline", marginRight: 6 }} />{eyebrow}</div>
                <h3 style={{ margin: "8px 0 4px", fontSize: 17 }}>{title}</h3>
                {summary[key].length ? (
                  summary[key].map((item) => (
                    <div key={item.name} style={{ marginTop: 14 }}>
                      <b style={{ fontSize: 14 }}>{item.name}</b>
                      <p className="muted" style={{ lineHeight: 1.5, margin: "4px 0 0", fontSize: 13 }}>{item.reason}</p>
                    </div>
                  ))
                ) : (
                  <p className="muted" style={{ fontSize: 13, marginTop: 12 }}>Nothing flagged from this week&rsquo;s log.</p>
                )}
              </div>
            ))}
          </div>

          {!!summary.limitations.length && (
            <div className="notice" style={{ marginTop: 20 }}>
              <b>Worth remembering:</b> {summary.limitations.join(" ")} This reviews only what you logged and cannot diagnose a nutrient deficiency.
            </div>
          )}
        </div>
      )}
    </section>
  );
}
