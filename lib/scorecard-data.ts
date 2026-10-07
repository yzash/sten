import { assess, getOpenPOLines, getSupplier, listDiversificationRecs, listParts, listPrecedents, listSignals, listSuppliers, listWorkOrders } from "./api";
import { diffDays } from "./dates";
import type { DiversificationRec, Part, PartCategory, Precedent, POLine, Supplier } from "./schema";

export interface CriticalPart {
  part: Pick<Part, "id" | "description" | "category" | "lead_time_days" | "sole_source" | "criticality">;
  supplier_id: string;
  supplier_name: string;
  flags: ("sole source" | "long lead" | "distressed supplier")[];
  open_value_usd: number;
  next_need: string | null;
}

export interface ScorecardData {
  suppliers: Supplier[];
  critical: CriticalPart[];
  recs: (DiversificationRec & { part_desc: string; current_name: string; candidate_names: string[] })[];
}

const DISTRESS = (s: Supplier) => s.financial_health < 40 || s.status !== "active";

export function scorecardData(): ScorecardData {
  const suppliers = listSuppliers();
  const open = getOpenPOLines();
  const wos = listWorkOrders();
  const critical: CriticalPart[] = [];
  for (const p of listParts()) {
    const primary = getSupplier(p.approved_sources[0].supplier_id)!;
    const flags: CriticalPart["flags"] = [];
    if (p.sole_source) flags.push("sole source");
    if (p.lead_time_days >= 100) flags.push("long lead");
    if (p.approved_sources.some((s) => DISTRESS(getSupplier(s.supplier_id)!))) flags.push("distressed supplier");
    if (!flags.length || p.criticality === "C") continue;
    const lines = open.filter((l) => l.part_id === p.id);
    const needs = [
      ...lines.map((l) => l.needed_date),
      ...wos.filter((w) => w.bom_lines.some((b) => b.part_id === p.id)).map((w) => w.induction_date),
    ].sort();
    critical.push({
      part: { id: p.id, description: p.description, category: p.category, lead_time_days: p.lead_time_days, sole_source: p.sole_source, criticality: p.criticality },
      supplier_id: primary.id,
      supplier_name: primary.name,
      flags,
      open_value_usd: lines.reduce((s, l) => s + l.qty * l.unit_price, 0),
      next_need: needs.find((d) => d >= "2026-10-07") ?? needs[needs.length - 1] ?? null,
    });
  }
  critical.sort((a, b) => b.flags.length - a.flags.length || b.open_value_usd - a.open_value_usd);
  const recs = listDiversificationRecs().map((r) => ({
    ...r,
    part_desc: listParts().find((p) => p.id === r.part_id)?.description ?? r.part_id,
    current_name: getSupplier(r.current_supplier_id)?.name ?? r.current_supplier_id,
    candidate_names: r.candidate_supplier_ids.map((id) => getSupplier(id)?.name ?? id),
  }));
  return { suppliers, critical, recs };
}

export interface SupplierPageData {
  supplier: Supplier;
  openLines: (POLine & { part_desc: string })[];
  signals: { id: string; headline: string; received_at: string; severity: number | null; disposition: string }[];
  precedents: Precedent[];
  parts: { id: string; description: string; sole: boolean; category: PartCategory }[];
}

export function supplierPageData(id: string): SupplierPageData | null {
  const supplier = getSupplier(id);
  if (!supplier) return null;
  const parts = listParts();
  const openLines = getOpenPOLines({ supplierId: id }).map((l) => ({ ...l, part_desc: parts.find((p) => p.id === l.part_id)?.description ?? l.part_id }));
  const signals = listSignals()
    .filter((s) => s.disposition === "material" && diffDays(s.received_at, "2026-10-07") <= 90)
    .filter((s) => s.affected_supplier_ids.includes(id) || assess(s).exposure.supplierIds.includes(id))
    .map((s) => ({ id: s.id, headline: s.headline, received_at: s.received_at, severity: assess(s).scores.overall.severity, disposition: s.disposition }));
  return {
    supplier,
    openLines,
    signals,
    precedents: listPrecedents().filter((p) => p.supplier_ids.includes(id)),
    parts: parts.filter((p) => p.approved_sources.some((s) => s.supplier_id === id)).map((p) => ({ id: p.id, description: p.description, sole: p.sole_source && p.approved_sources[0].supplier_id === id, category: p.category })),
  };
}
