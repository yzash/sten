import { getAllPOLines, getPart, getSupplier, listSourcingCalls, listSuppliers, listWorkOrders } from "./api";
import { diffDays } from "./dates";
import type { POLine, Supplier } from "./schema";
import { rag, supplierFactors, type Rag } from "./scoring";

export const SPLIT_THRESHOLD_DAYS = 10;
const TODAY = "2026-10-07";

export interface BoardRow {
  supplier: Pick<Supplier, "id" | "name" | "tier" | "country_code" | "otd_pct" | "status" | "ncr_12m">;
  band: Rag;
  open_count: number;
  po_count: number;
  open_value: number;
  backlog_days: number;
  split_candidate: boolean;
}

export interface LineView extends POLine {
  part_desc: string;
  sole: boolean;
  remaining_days: number;
  sources: { supplier_id: string; name: string; price: number; lead: number; kind: string; otd: number; ncr: number; status: string }[];
  work_orders: string[];
}

export function purchasingData() {
  const lines = getAllPOLines().filter((l) => l.status !== "delivered");
  const wos = listWorkOrders();
  const rows: BoardRow[] = listSuppliers()
    .map((s) => {
      const mine = lines.filter((l) => l.supplier_id === s.id);
      const value = mine.reduce((a, l) => a + l.qty * l.unit_price, 0);
      const backlog = value ? Math.round(mine.reduce((a, l) => a + l.backlog_days * l.qty * l.unit_price, 0) / value) : 0;
      return {
        supplier: { id: s.id, name: s.name, tier: s.tier, country_code: s.country_code, otd_pct: s.otd_pct, status: s.status, ncr_12m: s.ncr_12m },
        band: rag(supplierFactors(s)),
        open_count: mine.length,
        po_count: new Set(mine.map((l) => l.ebeln)).size,
        open_value: value,
        backlog_days: backlog,
        split_candidate: backlog > SPLIT_THRESHOLD_DAYS || s.status !== "active",
      };
    })
    .filter((r) => r.open_count > 0)
    .sort((a, b) => Number(b.split_candidate) - Number(a.split_candidate) || b.backlog_days - a.backlog_days || b.open_value - a.open_value);

  const lineViews: LineView[] = lines.map((l) => {
    const p = getPart(l.part_id)!;
    return {
      ...l,
      part_desc: p.description,
      sole: p.sole_source,
      remaining_days: Math.max(0, diffDays(TODAY, l.confirmed_date)),
      sources: p.approved_sources.map((src) => {
        const s = getSupplier(src.supplier_id)!;
        return { supplier_id: s.id, name: s.name, price: src.price_usd, lead: src.lead_time_days, kind: src.kind, otd: s.otd_pct, ncr: s.ncr_12m, status: s.status };
      }),
      work_orders: wos.filter((w) => w.bom_lines.some((b) => b.po_line_id === l.id)).map((w) => w.id),
    };
  });

  const calls = listSourcingCalls().map((c) => {
    const l = lineViews.find((x) => x.id === c.po_line_id);
    return { ...c, supplier_name: l ? getSupplier(l.supplier_id)?.name ?? "" : "", part_id: l?.part_id ?? "", part_desc: l?.part_desc ?? "", value: l ? l.qty * l.unit_price : 0 };
  });
  return { rows, lines: lineViews, calls };
}
