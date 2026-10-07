/**
 * The contract between the deterministic layer and the language model (PRD 7.2).
 * Shared by the build-time generator, the validator and the tests. Model-agnostic on purpose:
 * the pilot runs the same prompt and schema on Gemini via Vertex AI.
 */
import { DISRUPTION_LABELS, type Reasoning, Reasoning as ReasoningSchema } from "./schema";
import type { Assessment } from "./api/signals";

export const PROMPT_VERSION = "v1";

export const OPTION_VOCABULARY = [
  "split PO",
  "air expedite",
  "substitute or PMA part",
  "broker buy",
  "re-sequence inductions",
  "pay receiver for WIP",
  "hold GR",
  "reroute",
  "early payment",
];

export const SYSTEM_PROMPT = `You are the reasoning service inside a supplier resilience tool used by procurement at an aerospace MRO group in Singapore (engine, airframe, component and nacelle maintenance).

Your reader is a category buyer or procurement manager. They are expert, busy and sceptical. Write in plain, specific language with numbers. Never use em dashes or en dashes. Do not invent suppliers, parts, prices or dates that are not in the input.

Domain rules:
- Parts are regulated. Every part carries an airworthiness release (FAA 8130-3 or EASA Form 1). Substitution is constrained by approved-source lists and customer acceptance, not price.
- Many critical parts are sole source by OEM design. Dual sourcing often means PMA or DER-repair alternatives, each with customer acceptance limits.
- The cost of delay is hangar time and customer liquidated damages (LDs), not just expedite freight. Float on a work order absorbs slip before the redelivery moves.

Disruption taxonomy: ${Object.values(DISRUPTION_LABELS).join("; ")}.
Impact dimensions: cost (USD), delay (days beyond float), ops (work-order lines and induction slots at risk), reputation (customer tier weight times LD exposure).
Option vocabulary: ${OPTION_VOCABULARY.join("; ")}.

You receive one disruption signal, its exposure set and the deterministic impact scores. The impact block in your output must copy the deterministic numbers and severities exactly; write only the rationale sentences.

Produce 3 to 6 options. Each option has: id (OPT-1..), name, one-line mechanism, cost_usd (net incremental cost versus doing nothing, including expected LDs; negative means a saving), residual_delay_days (days the latest redelivery still moves beyond float), risk (low, medium, high), speed_days (days until the option takes effect), precedent_id (from the precedent library or null), and actions. Every option names at least one agent action with system (one of SAP MM, SAP FI, Forwarder, Planning, Email), action (snake_case verb), label (one line a buyer reads) and payload (the fields the system needs). Agents never write to a system of record without human approval; actions describe what would be written after approval.

Mark exactly one option as recommended_id and give a 2 to 3 sentence rationale that names the trade-off against the next best option.

Answer four questions in qa: options ("What are my options?"), cheapest ("What does the cheapest option cost?"), last_time ("What did we do last time?"), why_move ("Why does the induction move?"). Each answer is 2 to 4 sentences.

Return JSON only, matching the schema.`;

export function buildUserPrompt(input: unknown): string {
  return `Input:\n${JSON.stringify(input, null, 2)}\n\nReturn the reasoning JSON for this signal.`;
}

const DASHES = /[–—]/;

export interface ReconcileIssue {
  path: string;
  message: string;
}

/** Schema, reconciliation (within 5%) and copy rules. Returns a list of issues; empty means valid. */
export function checkReasoning(raw: unknown, a: Assessment, precedentIds: Set<string>): ReconcileIssue[] {
  const issues: ReconcileIssue[] = [];
  const parsed = ReasoningSchema.safeParse(raw);
  if (!parsed.success) {
    for (const i of parsed.error.issues) issues.push({ path: i.path.join("."), message: i.message });
    return issues;
  }
  const r: Reasoning = parsed.data;
  const s = a.scores;
  const within = (got: number, want: number) => (want === 0 ? got === 0 : Math.abs(got - want) / Math.abs(want) <= 0.05);

  if (!within(r.impact.cost.usd, s.cost.usd)) issues.push({ path: "impact.cost.usd", message: `drift: ${r.impact.cost.usd} vs ${s.cost.usd}` });
  if (!within(r.impact.delay.days, s.delay.days)) issues.push({ path: "impact.delay.days", message: `drift: ${r.impact.delay.days} vs ${s.delay.days}` });
  if (r.impact.cost.severity !== s.cost.severity) issues.push({ path: "impact.cost.severity", message: `${r.impact.cost.severity} vs ${s.cost.severity}` });
  if (r.impact.delay.severity !== s.delay.severity) issues.push({ path: "impact.delay.severity", message: `${r.impact.delay.severity} vs ${s.delay.severity}` });
  if (r.impact.ops.severity !== s.ops.severity) issues.push({ path: "impact.ops.severity", message: `${r.impact.ops.severity} vs ${s.ops.severity}` });
  if (r.impact.reputation.severity !== s.reputation.severity) issues.push({ path: "impact.reputation.severity", message: `${r.impact.reputation.severity} vs ${s.reputation.severity}` });
  if (r.impact.ops.lines !== s.ops.lines || r.impact.ops.slots !== s.ops.slots) issues.push({ path: "impact.ops", message: "lines or slots differ from scoring" });

  const ids = new Set(r.options.map((o) => o.id));
  if (ids.size !== r.options.length) issues.push({ path: "options", message: "duplicate option ids" });
  if (!ids.has(r.recommended_id)) issues.push({ path: "recommended_id", message: `${r.recommended_id} is not an option` });
  r.options.forEach((o, i) => {
    if (o.precedent_id && !precedentIds.has(o.precedent_id)) issues.push({ path: `options.${i}.precedent_id`, message: `unknown precedent ${o.precedent_id}` });
    o.actions.forEach((act, j) => {
      if (Object.keys(act.payload).length === 0) issues.push({ path: `options.${i}.actions.${j}.payload`, message: "empty payload" });
    });
  });
  const sentences = r.rationale.split(/(?<=[.!?])\s+/).filter(Boolean).length;
  if (sentences < 2 || sentences > 3) issues.push({ path: "rationale", message: `rationale has ${sentences} sentences, want 2 to 3` });

  const walk = (v: unknown, p: string) => {
    if (typeof v === "string" && DASHES.test(v)) issues.push({ path: p, message: "contains an em or en dash" });
    else if (Array.isArray(v)) v.forEach((x, i) => walk(x, `${p}.${i}`));
    else if (v && typeof v === "object") for (const [k, x] of Object.entries(v)) walk(x, p ? `${p}.${k}` : k);
  };
  walk(r, "");
  return issues;
}
