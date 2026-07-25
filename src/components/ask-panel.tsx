"use client";

import { MessageCircle, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import { storage } from "@/lib/storage";

/**
 * Global assistant, opened from a button and slid in from the right rather
 * than living inline on a page. It is reachable from anywhere and works on a
 * first visit with nothing scanned.
 */

interface Turn {
  role: "user" | "model";
  text: string;
  /** Tool calls the server made answering this turn, rendered inline so the
   *  answer never appears from nowhere. */
  trace?: { tool: string; label: string }[];
  degraded?: string;
}

const SUGGESTIONS = [
  "I'm craving something salty, what's safe?",
  "Can I eat brie if it's baked?",
  "What have I scanned so far?",
];

/** Replies render as raw text, so strip any markup the model slips in. */
function stripMarkdown(s: string): string {
  return s
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/^[-*]\s+/gm, "· ")
    .trim();
}

export function AskPanel() {
  const [open, setOpen] = useState(false);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [turns, busy]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  // Escape closes, and the page behind shouldn't scroll while it's open.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [open]);

  const send = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || busy) return;

      const next: Turn[] = [...turns, { role: "user", text: trimmed }];
      setTurns(next);
      setInput("");
      setBusy(true);

      try {
        const res = await fetch("/api/ask", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            messages: next.map((t) => ({ role: t.role, text: t.text })),
            profile: storage.profile(),
            // Scans live in localStorage, so the server only sees what this
            // request carries. Empty is fine — the panel still works.
            history: storage.analyses().slice(0, 20).map((a) => ({
              itemName: a.itemName,
              status: a.status,
              summary: a.summary,
              createdAt: a.createdAt,
            })),
          }),
        });

        if (!res.ok || !res.body) {
          setTurns([...next, { role: "model", text: "Couldn't reach the assistant. Try again in a moment." }]);
          return;
        }

        // NDJSON: one JSON object per line. Trace events land as the tools run,
        // text deltas as they're generated.
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffered = "";
        let out = "";
        const trace: NonNullable<Turn["trace"]> = [];
        let degraded: string | undefined;

        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          buffered += decoder.decode(value, { stream: true });
          const lines = buffered.split("\n");
          buffered = lines.pop() ?? "";

          for (const line of lines) {
            if (!line.trim()) continue;
            let evt: { type: string; delta?: string; tool?: string; label?: string; reason?: string };
            try {
              evt = JSON.parse(line);
            } catch {
              continue;
            }
            if (evt.type === "text" && evt.delta) out += evt.delta;
            else if (evt.type === "trace" && evt.label) trace.push({ tool: evt.tool ?? "", label: evt.label });
            else if (evt.type === "degraded") degraded = evt.reason;
          }
          setTurns([...next, { role: "model", text: out, trace: [...trace], degraded }]);
        }

        if (!out.trim()) {
          setTurns([...next, { role: "model", text: "No answer came back. Try rephrasing." }]);
        }
      } catch {
        setTurns([...next, { role: "model", text: "Couldn't reach the assistant." }]);
      } finally {
        setBusy(false);
      }
    },
    [turns, busy],
  );

  return (
    <>
      <button
        className="ask-fab"
        onClick={() => setOpen(true)}
        aria-expanded={open}
        aria-controls="ask-panel"
      >
        <MessageCircle size={18} aria-hidden />
        Ask
      </button>

      <div
        className={`ask-scrim${open ? " is-open" : ""}`}
        onClick={() => setOpen(false)}
        aria-hidden
      />

      <aside
        id="ask-panel"
        ref={panelRef}
        className={`ask-panel${open ? " is-open" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-label="Ask nutri.ai"
        inert={!open}
      >
        <header className="ask-head">
          <div>
            <strong>Ask nutri.ai</strong>
            <p className="muted" style={{ margin: 0, fontSize: 13 }}>
              Checks the rules before it answers.
            </p>
          </div>
          <button className="ask-close" onClick={() => setOpen(false)} aria-label="Close">
            <X size={18} />
          </button>
        </header>

        <div className="ask-body">
          {turns.length === 0 && (
            <div className="ask-suggestions">
              {SUGGESTIONS.map((s) => (
                <button key={s} onClick={() => void send(s)}>
                  {s}
                </button>
              ))}
            </div>
          )}

          {turns.map((t, i) => (
            <div key={i} className={t.role === "user" ? "ask-turn is-user" : "ask-turn"}>
              {t.role === "model" && t.trace && t.trace.length > 0 && (
                <ul className="ask-trace">
                  {t.trace.map((tr, j) => (
                    <li key={j}>&rarr; {tr.label}</li>
                  ))}
                </ul>
              )}
              {t.degraded && (
                <p className="ask-degraded">
                  {t.degraded === "rate-limit"
                    ? "Gemini account out of credit — answered from the rules directly."
                    : "Assistant unavailable — answered from the rules directly."}
                </p>
              )}
              <p className="ask-bubble">
                {t.role === "model" ? stripMarkdown(t.text) : t.text}
              </p>
            </div>
          ))}

          {busy && (
            <p className="muted" style={{ fontSize: 13 }} aria-live="polite">
              thinking…
            </p>
          )}
          <div ref={endRef} />
        </div>

        <form
          className="ask-form"
          onSubmit={(e) => {
            e.preventDefault();
            void send(input);
          }}
        >
          <input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about a food…"
            aria-label="Ask about a food"
            disabled={busy}
          />
          <button type="submit" disabled={busy || !input.trim()}>
            Send
          </button>
        </form>
      </aside>
    </>
  );
}
