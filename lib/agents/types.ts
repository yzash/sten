import type { AgentActionSpec, System } from "@/lib/schema";

/** Production contract: one adapter per system of record. Swap the mock for a REST or Joule A2A client. */
export interface ExecutionResult {
  doc_number: string;
  latency_ms: number;
  status: "written" | "failed";
  message: string;
}

export interface AdapterContext {
  /** Monotonic sequence for document numbers in the mock; production systems assign their own. */
  nextSeq: () => number;
}

export interface Adapter {
  system: System;
  execute(action: AgentActionSpec, ctx: AdapterContext): Promise<ExecutionResult>;
}

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Deterministic pseudo-latency so replays look the same. */
export function latencyFor(action: AgentActionSpec, base: number, spread: number) {
  let h = 0;
  for (const c of action.action + action.label) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return base + (h % spread);
}
