import type { QaPromptId } from "./schema";

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
