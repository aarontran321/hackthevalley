"use client";

import { FormEvent, useState } from "react";
import { LoaderCircle, MessageCircle, Send } from "lucide-react";
import { apiPost } from "@/lib/client-api";
import { storage } from "@/lib/storage";
import type { ConsumptionEntry, WeeklySummary } from "@/types";

type ChatMessage = { role: "user" | "assistant"; content: string };

const starters = [
  "What should I eat more of this week?",
  "Am I logging enough iron-rich foods?",
  "What could I swap for the flagged items?",
  "Any easy snacks that fit my preferences?"
];

export function WeekChat({
  entries,
  summary
}: {
  entries: ConsumptionEntry[];
  summary: WeeklySummary | null;
}) {
  const [chat, setChat] = useState<ChatMessage[]>([]);
  const [question, setQuestion] = useState("");
  const [asking, setAsking] = useState(false);
  const [error, setError] = useState("");

  const ask = async (event: FormEvent) => {
    event.preventDefault();
    const trimmed = question.trim();
    if (!trimmed || !entries.length) return;

    const next = [...chat, { role: "user" as const, content: trimmed }];
    setChat(next);
    setQuestion("");
    setAsking(true);
    setError("");
    try {
      const data = await apiPost<{ message: string }>("/api/week-chat", {
        profile: storage.profile(),
        entries,
        summary,
        messages: next
      });
      setChat([...next, { role: "assistant", content: data.message }]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Chat is unavailable right now.");
    } finally {
      setAsking(false);
    }
  };

  return (
    <section className="card card-pad" style={{ marginTop: 20 }}>
      <div className="eyebrow"><MessageCircle size={14} style={{ display: "inline", marginRight: 6 }} />Ask about your week</div>
      <h2 style={{ margin: "9px 0 6px" }}>Talk it through</h2>
      <p className="muted" style={{ marginTop: 0, lineHeight: 1.6 }}>
        Gemini can see the foods you logged, your trimester, and your preferences. Ask about gaps, swaps, portions, or anything that felt off this week.
      </p>

      {!entries.length ? (
        <div className="notice" style={{ marginTop: 16 }}>Log a food first so there is something to talk about.</div>
      ) : (
        <>
          {!chat.length && (
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", margin: "16px 0" }}>
              {starters.map((text) => (
                <button type="button" className="btn btn-outline" style={{ minHeight: 38, fontSize: 13, paddingInline: 14 }} key={text} onClick={() => setQuestion(text)}>
                  {text}
                </button>
              ))}
            </div>
          )}

          {chat.map((message, index) => (
            <div
              key={index}
              style={{
                maxWidth: "82%",
                margin: message.role === "user" ? "10px 0 10px auto" : "10px auto 10px 0",
                padding: "13px 16px",
                borderRadius: 16,
                background: message.role === "user" ? "var(--ink)" : "var(--sage)",
                color: message.role === "user" ? "white" : "inherit",
                lineHeight: 1.6,
                fontSize: 14,
                whiteSpace: "pre-wrap"
              }}
            >
              {message.content}
            </div>
          ))}

          {asking && <div className="muted" style={{ fontSize: 13 }}><LoaderCircle className="spin" size={15} style={{ display: "inline", marginRight: 7 }} />Reading your week…</div>}
          {error && <div className="notice">{error}</div>}

          <form onSubmit={ask} style={{ display: "flex", gap: 9, marginTop: 16 }}>
            <input className="input" aria-label="Question about your week" placeholder="Ask about this week of food…" value={question} onChange={(e) => setQuestion(e.target.value)} />
            <button className="btn btn-primary" aria-label="Send question" disabled={asking || !question.trim()}><Send size={18} /></button>
          </form>
          <small className="muted" style={{ display: "block", marginTop: 10 }}>Educational information only, grounded in the approved guidance sources. Not medical advice.</small>
        </>
      )}
    </section>
  );
}
