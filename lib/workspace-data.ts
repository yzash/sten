/** Server-side assembly of everything the response workspace renders for one signal. */
import { assess, getCustomer, getMergedSignals, getPart, getPrecedent, getSignal, getSupplier, listPrecedents } from "./api";
import type { ImpactChain } from "./impact-chain";
import type { Exposure } from "./materiality";
import { getReasoning } from "./reasoning";
import type { Precedent, Reasoning, Signal } from "./schema";
import type { ImpactScores } from "./scoring";

export interface WorkspaceData {
  signal: Signal;
  merged: Signal[];
  exposure: Exposure;
  chain: ImpactChain;
  scores: ImpactScores;
  reasoning: Reasoning | null;
  precedents: Precedent[];
  names: { suppliers: Record<string, string>; parts: Record<string, string>; customers: Record<string, string> };
}

export function workspaceFor(id: string): WorkspaceData | null {
  const signal = getSignal(id);
  if (!signal || signal.disposition === "merged") return null;
  return assembleWorkspace(signal);
}

export function assembleWorkspace(signal: Signal): WorkspaceData {
  const a = assess(signal);
  const reasoning = getReasoning(signal.id) ?? null;
  const precIds = new Set<string>(reasoning?.options.map((o) => o.precedent_id).filter((x): x is string => !!x) ?? []);
  const sameType = listPrecedents().filter((p) => p.signal_type === signal.type);
  const precedents = [...[...precIds].map((p) => getPrecedent(p)!).filter(Boolean), ...sameType.filter((p) => !precIds.has(p.id))];
  const supplierIds = new Set([...a.exposure.supplierIds, ...signal.affected_supplier_ids, ...precedents.flatMap((p) => p.supplier_ids)]);
  const partIds = new Set(a.chain.lines.map((l) => l.line.part_id));
  const customers = new Set(a.chain.workOrders.map((w) => w.customer.id));
  return {
    signal,
    merged: getMergedSignals(signal.id),
    exposure: a.exposure,
    chain: a.chain,
    scores: a.scores,
    reasoning,
    precedents,
    names: {
      suppliers: Object.fromEntries([...supplierIds].map((id) => [id, getSupplier(id)?.name ?? id])),
      parts: Object.fromEntries([...partIds].map((id) => [id, getPart(id)?.description ?? id])),
      customers: Object.fromEntries([...customers].map((id) => [id, getCustomer(id)?.name ?? id])),
    },
  };
}
