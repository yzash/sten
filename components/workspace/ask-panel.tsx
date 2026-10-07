"use client";

import { ArrowUp } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { QaPromptId, Reasoning } from "@/lib/schema";

export const SUGGESTED: { id: QaPromptId; q: string }[] = [
  { id: "options", q: "What are my options?" },
  { id: "last_time", q: "What did we do last time?" },
  { id: "cheapest", q: "What does the cheapest option cost?" },
  { id: "why_move", q: "Why does the induction move?" },
];

export const FALLBACK = "In this prototype I can answer about options, cost, precedents and schedule impact. In production this is a live query.";

/** Small keyword router from free text to the nearest prebuilt prompt id (PRD 7.3). */
export function routePrompt(text: string): QaPromptId | null {
  const t = text.toLowerCase();
  if (/(last time|precedent|before|history|previous|did we do)/.test(t)) return "last_time";
  if (/(cheap|cost|price|spend|expensive|budget)/.test(t)) return "cheapest";
  if (/(why|move|delay|slip|induction|schedule|redelivery|late)/.test(t)) return "why_move";
  if (/(option|alternative|choice|what can|recommend)/.test(t)) return "options";
  return null;
}

interface Msg {
  q: string;
  a: string;
  shown: number;
}

export function AskPanel({ reasoning }: { reasoning: Reasoning | null }) {
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [text, setText] = useState("");
  const endRef = useRef<HTMLDivElement>(null);

  const ask = (q: string, id: QaPromptId | null) => {
    const a = (id && reasoning?.qa.find((x) => x.prompt_id === id)?.answer) || FALLBACK;
    setMsgs((m) => [...m, { q, a, shown: 0 }]);
  };

  // Stream the latest answer over about 1.5 seconds.
  const last = msgs[msgs.length - 1];
  useEffect(() => {
    if (!last || last.shown >= last.a.length) return;
    const step = Math.max(2, Math.ceil(last.a.length / 75));
    const t = setTimeout(() => setMsgs((m) => m.map((x, i) => (i === m.length - 1 ? { ...x, shown: Math.min(x.a.length, x.shown + step) } : x))), 20);
    return () => clearTimeout(t);
  }, [last]);
  useEffect(() => endRef.current?.scrollIntoView({ block: "nearest" }), [msgs.length]);

  return (
    <div data-testid="ask-panel">
      <div className="mb-2 flex flex-wrap gap-1.5">
        {SUGGESTED.map((s) => (
          <button
            key={s.id}
            onClick={() => ask(s.q, s.id)}
            className="border border-rule-2 px-2 py-1 text-[12px] text-ink-2 hover:border-ink hover:text-ink"
            data-testid={`ask-${s.id}`}
          >
            {s.q}
          </button>
        ))}
      </div>
      {msgs.length > 0 && (
        <div className="mb-2 max-h-[320px] space-y-3 overflow-y-auto border-y border-rule py-3">
          {msgs.map((m, i) => (
            <div key={i} className="text-[13px]">
              <div className="mb-1 text-ink-3">
                <span className="label mr-2">You</span>
                {m.q}
              </div>
              <div className="leading-relaxed" data-testid="ask-answer">
                {m.a.slice(0, m.shown)}
                {m.shown < m.a.length && <span className="ml-0.5 inline-block h-3 w-[2px] translate-y-0.5 bg-ink-3" />}
              </div>
            </div>
          ))}
          <div ref={endRef} />
        </div>
      )}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!text.trim()) return;
          ask(text.trim(), routePrompt(text));
          setText("");
        }}
        className="relative"
      >
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Ask about this signal"
          aria-label="Ask about this signal"
          className="h-9 w-full border border-rule-2 bg-paper pl-3 pr-10 text-[13px] placeholder:text-ink-3 focus:border-accent focus:outline-none"
        />
        <button type="submit" aria-label="Send" className="absolute right-1.5 top-1/2 grid h-6 w-6 -translate-y-1/2 place-items-center text-ink-2 hover:text-ink">
          <ArrowUp size={14} />
        </button>
      </form>
    </div>
  );
}
