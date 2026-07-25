"use client";

import { useEffect, useRef, useState } from "react";

import { loadHistory, type Profile, trimesterForWeek } from "@/lib/profile";

interface Turn {
  role: "user" | "model";
  text: string;
  /** Tool calls the server made answering this turn, rendered inline. */
  trace?: Array<{ tool: string; label: string }>;
}

/**
 * Replies render as raw text, so stray markup would show literally. The system
 * instruction asks for plain prose; this catches the times it doesn't comply.
 */
function stripMarkdown(s: string): string {
  return s
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/(^|\s)\*(\S.*?\S)\*(?=\s|$)/g, "$1$2")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/^[-*]\s+/gm, "· ")
    .trim();
}

const SUGGESTIONS = [
  "I'm craving something salty, what's safe?",
  "What have I scanned this week?",
  "Can I eat brie if it's baked?",
];

export function Chat({ profile }: { profile: Profile }) {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [turns, busy]);

  async function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed || busy) return;

    const next: Turn[] = [...turns, { role: "user", text: trimmed }];
    setTurns(next);
    setInput("");
    setBusy(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          messages: next.map((t) => ({ role: t.role, text: t.text })),
          context: {
            week: profile.week,
            trimester: trimesterForWeek(profile.week),
            conditions: profile.conditions,
            // History lives in localStorage, so the server only ever sees what
            // this request carries.
            history: loadHistory().slice(0, 20),
          },
        }),
      });

      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        setTurns([
          ...next,
          {
            role: "model",
            text:
              body.error === "rate-limit"
                ? "Out of API quota for today. The scanner still works from saved data."
                : "Couldn't reach the assistant. Try again in a moment.",
          },
        ]);
        return;
      }

      const data = (await res.json()) as { reply: string; trace?: Turn["trace"] };
      setTurns([...next, { role: "model", text: data.reply, trace: data.trace }]);
    } catch {
      setTurns([...next, { role: "model", text: "Couldn't reach the assistant." }]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-[420px] flex-col gap-4">
      {turns.length === 0 && (
        <div className="space-y-3">
          <p className="text-sm text-graphite">
            Ask about anything a verdict can&rsquo;t cover. It knows you&rsquo;re
            at week {profile.week}.
          </p>
          <div className="space-y-2">
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                onClick={() => void send(s)}
                className="w-full rounded-xs border border-rule bg-white px-3 py-2 text-left text-sm hover:border-graphite"
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      )}

      {turns.map((t, i) => (
        <div key={i} className={t.role === "user" ? "text-right" : ""}>
          {t.role === "model" && t.trace && t.trace.length > 0 && (
            <ul className="mb-1 space-y-0.5">
              {t.trace.map((tr, j) => (
                <li key={j} className="font-mono text-xs text-graphite">
                  &rarr; {tr.label}
                </li>
              ))}
            </ul>
          )}
          <p
            className={
              t.role === "user"
                ? "inline-block rounded-xs bg-ink px-3 py-2 text-left text-sm text-paper"
                : "whitespace-pre-wrap text-sm leading-relaxed"
            }
          >
            {t.role === "model" ? stripMarkdown(t.text) : t.text}
          </p>
        </div>
      ))}

      {busy && (
        <p className="font-mono text-xs text-graphite" aria-live="polite">
          thinking…
        </p>
      )}

      <div ref={endRef} />

      <form
        className="sticky bottom-0 flex gap-2 bg-paper py-2"
        onSubmit={(e) => {
          e.preventDefault();
          void send(input);
        }}
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask about a food…"
          aria-label="Ask a question"
          disabled={busy}
          className="min-w-0 flex-1 rounded-xs border border-rule bg-white px-3 py-2 text-sm"
        />
        <button
          type="submit"
          disabled={busy || !input.trim()}
          className="rounded-xs bg-ink px-4 py-2 font-mono text-xs tracking-[0.14em] text-paper disabled:bg-rule disabled:text-graphite"
        >
          ASK
        </button>
      </form>
    </div>
  );
}
