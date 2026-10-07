/** Server-side view models: computed once at build, shipped as compact props. */
import { assess, getPart, getSupplier, listLibrarySignals, listSignals, listSuppliers } from "./api";
import type { SupplierRef } from "./classify";
import type { PartCategory, Signal } from "./schema";

export interface FeedSignal {
  id: string;
  received_at: string;
  channel: Signal["channel"];
  headline: string;
  type: Signal["type"];
  state: Signal["state"];
  confidence: number;
  disposition: Signal["disposition"];
  parent_id: string | null;
  discard_reason: string | null;
  checkpoint: Signal["checkpoint"];
  library: boolean;
  severity: number | null;
  driver: string | null;
  lines: number;
  value_usd: number;
  supplier_ids: string[];
  supplier_names: string[];
  categories: PartCategory[];
}

export function toFeedSignal(s: Signal): FeedSignal {
  const parentLike = s.disposition !== "merged";
  const a = parentLike && s.disposition === "material" ? assess(s) : null;
  const supplierIds = a ? a.exposure.supplierIds : s.affected_supplier_ids;
  const categories = a
    ? [...new Set(a.exposure.partIds.map((p) => getPart(p)?.category).filter(Boolean) as PartCategory[])]
    : s.affected_categories;
  return {
    id: s.id,
    received_at: s.received_at,
    channel: s.channel,
    headline: s.headline,
    type: s.type,
    state: s.state,
    confidence: s.confidence,
    disposition: s.disposition,
    parent_id: s.parent_id,
    discard_reason: s.discard_reason,
    checkpoint: s.checkpoint,
    library: s.library,
    severity: a ? a.scores.overall.severity : null,
    driver: a ? a.scores.overall.driver : null,
    lines: a ? a.exposure.poLineIds.length : 0,
    value_usd: a ? a.scores.cost.po_value_usd : 0,
    supplier_ids: supplierIds,
    supplier_names: supplierIds.map((id) => getSupplier(id)?.name ?? id),
    categories,
  };
}

export function feedData() {
  return {
    signals: listSignals().map(toFeedSignal),
    library: listLibrarySignals().map(toFeedSignal),
    suppliers: listSuppliers().map((s): SupplierRef => ({ id: s.id, name: s.name, region: s.region, city: s.city, country: s.country })),
  };
}
