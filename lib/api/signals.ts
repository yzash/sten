/** Reads that mimic the signal intake (mailbox, news, credit monitor, SAP events, EDI, Sphera). */
import { db, world } from "./data";
import { computeExposure, type Exposure } from "@/lib/materiality";
import { buildImpactChain, type ImpactChain } from "@/lib/impact-chain";
import { scoreImpact, type ImpactScores } from "@/lib/scoring";
import type { Precedent, Signal } from "@/lib/schema";

const sigIdx = new Map([...db.signals, ...db.library].map((s) => [s.id, s]));

export function listSignals(): Signal[] {
  return db.signals;
}
export function listLibrarySignals(): Signal[] {
  return db.library;
}
export function getSignal(id: string): Signal | undefined {
  return sigIdx.get(id);
}
export function getMergedSignals(parentId: string): Signal[] {
  return db.signals.filter((s) => s.parent_id === parentId);
}
export function listPrecedents(): Precedent[] {
  return db.precedents;
}
export function getPrecedent(id: string): Precedent | undefined {
  return db.precedents.find((p) => p.id === id);
}

export interface Assessment {
  exposure: Exposure;
  chain: ImpactChain;
  scores: ImpactScores;
}

const cache = new Map<string, Assessment>();

/** Deterministic layer: exposure, impact chain and impact scores for a signal. */
export function assess(signal: Pick<Signal, "id" | "headline" | "est_delay_days" | "affected_supplier_ids" | "affected_regions" | "affected_categories" | "affected_corridors">): Assessment {
  const hit = cache.get(signal.id);
  if (hit) return hit;
  const exposure = computeExposure(signal, world);
  const chain = buildImpactChain(signal, exposure, world);
  const scores = scoreImpact(chain, world);
  const a = { exposure, chain, scores };
  if (!signal.id.startsWith("DRAFT")) cache.set(signal.id, a);
  return a;
}
