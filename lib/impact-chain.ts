import { addDays, diffDays, fmtDate } from "./dates";
import type { Exposure } from "./materiality";
import type { Customer, POLine, Signal, WorkOrder } from "./schema";
import { indexBy, type World } from "./world";

export interface LineImpact {
  line: POLine;
  base_date: string; // confirmed date, or shipment ETA when exposed by route
  new_eta: string;
  slip_days: number; // new ETA minus needed date, floored at 0
  value_usd: number;
  work_order_ids: string[];
}

export interface WorkOrderImpact {
  wo: WorkOrder;
  customer: Customer;
  line_ids: string[]; // BOM lines at risk (slip > 0)
  slip_days: number;
  beyond_float_days: number;
  new_redelivery: string;
  ld_exposure_usd: number;
}

export type ChainNodeKind = "signal" | "supplier" | "po_line" | "requirement" | "work_order" | "milestone" | "aggregate";

export interface ChainNode {
  id: string;
  kind: ChainNodeKind;
  layer: number;
  title: string;
  sub: string;
  meta?: string;
  highlight?: boolean;
  href?: string;
}

export interface ChainEdge {
  from: string;
  to: string;
  slip_days: number | null;
  highlight?: boolean;
}

export interface ImpactChain {
  lines: LineImpact[];
  workOrders: WorkOrderImpact[];
  nodes: ChainNode[];
  edges: ChainEdge[];
}

export const LAYERS = ["Signal", "Supplier", "PO line", "Requirement", "Work order", "Milestone"] as const;

/** Max PO lines without a work-order link drawn individually before aggregating. */
const MAX_UNLINKED = 3;

/**
 * Walks signal → supplier → PO line → material requirement → work order → milestone,
 * computing slip from confirmed versus needed dates and total float (PRD 7.1).
 */
export function buildImpactChain(
  signal: Pick<Signal, "id" | "headline" | "est_delay_days">,
  exposure: Exposure,
  world: World,
): ImpactChain {
  const parts = indexBy(world.parts, "id");
  const suppliers = indexBy(world.suppliers, "id");
  const customers = indexBy(world.customers, "id");
  const exposed = new Set(exposure.poLineIds);
  const routeShip = new Map<string, string>(); // po line -> shipment eta
  for (const sh of world.shipments) {
    if (!exposure.shipmentIds.includes(sh.id)) continue;
    for (const id of sh.po_line_ids) routeShip.set(id, sh.eta);
  }

  const woByLine = new Map<string, string[]>();
  for (const wo of world.workOrders) {
    for (const b of wo.bom_lines) {
      if (b.po_line_id && exposed.has(b.po_line_id)) {
        woByLine.set(b.po_line_id, [...(woByLine.get(b.po_line_id) ?? []), wo.id]);
      }
    }
  }

  const lines: LineImpact[] = world.poLines
    .filter((l) => exposed.has(l.id))
    .map((line) => {
      const shipEta = routeShip.get(line.id);
      const base = shipEta && diffDays(line.confirmed_date, shipEta) > 0 ? shipEta : line.confirmed_date;
      const new_eta = addDays(base, signal.est_delay_days);
      return {
        line,
        base_date: base,
        new_eta,
        slip_days: Math.max(0, diffDays(line.needed_date, new_eta)),
        value_usd: line.qty * line.unit_price,
        work_order_ids: woByLine.get(line.id) ?? [],
      };
    });
  const lineById = new Map(lines.map((l) => [l.line.id, l]));

  const workOrders: WorkOrderImpact[] = world.workOrders
    .filter((wo) => wo.bom_lines.some((b) => b.po_line_id && exposed.has(b.po_line_id)))
    .map((wo) => {
      const atRisk = wo.bom_lines.filter((b) => b.po_line_id && (lineById.get(b.po_line_id)?.slip_days ?? 0) > 0);
      const slip = Math.max(0, ...atRisk.map((b) => lineById.get(b.po_line_id!)!.slip_days));
      const beyond = Math.max(0, slip - wo.float_days);
      return {
        wo,
        customer: customers.get(wo.customer_id)!,
        line_ids: atRisk.map((b) => b.line),
        slip_days: slip,
        beyond_float_days: beyond,
        new_redelivery: addDays(wo.target_redelivery, beyond),
        // LD exposure is taken at the unmitigated slip: the contracted slot date is the trigger.
        ld_exposure_usd: wo.ld_per_day_usd * slip,
      };
    });

  /* ---------------- graph ---------------- */
  const nodes: ChainNode[] = [];
  const edges: ChainEdge[] = [];
  const sigNode = `n:${signal.id}`;
  nodes.push({ id: sigNode, kind: "signal", layer: 0, title: signal.id, sub: truncate(signal.headline, 54) });

  const linked = lines.filter((l) => l.work_order_ids.length > 0);
  const unlinked = lines
    .filter((l) => l.work_order_ids.length === 0)
    .sort((a, b) => b.value_usd - a.value_usd);
  const shownUnlinked = unlinked.slice(0, MAX_UNLINKED);
  const hidden = unlinked.slice(MAX_UNLINKED);
  const shown = [...linked, ...shownUnlinked];

  const supIds = [...new Set(shown.map((l) => l.line.supplier_id))];
  for (const sid of supIds) {
    const s = suppliers.get(sid);
    nodes.push({
      id: `s:${sid}`,
      kind: "supplier",
      layer: 1,
      title: s?.name ?? sid,
      sub: `LIFNR ${sid} · Tier ${s?.tier ?? "?"}`,
      href: `/suppliers/${sid}`,
    });
    edges.push({ from: sigNode, to: `s:${sid}`, slip_days: null });
  }

  const woHighlight = new Set(workOrders.filter((w) => w.beyond_float_days > 0).map((w) => w.wo.id));

  for (const li of shown) {
    const p = parts.get(li.line.part_id);
    const lid = `l:${li.line.id}`;
    const rid = `r:${li.line.id}`;
    const hot = li.work_order_ids.some((w) => woHighlight.has(w));
    nodes.push({
      id: lid,
      kind: "po_line",
      layer: 2,
      title: `${li.line.ebeln} / ${li.line.ebelp}`,
      sub: `${li.line.qty} × ${p?.id ?? li.line.part_id}`,
      meta: `ETA ${fmtDate(li.base_date)} → ${fmtDate(li.new_eta)}`,
    });
    edges.push({ from: `s:${li.line.supplier_id}`, to: lid, slip_days: signal.est_delay_days });
    nodes.push({
      id: rid,
      kind: "requirement",
      layer: 3,
      title: truncate(p?.description ?? li.line.part_id, 30),
      sub: `Need ${fmtDate(li.line.needed_date)}`,
      meta: li.work_order_ids.length ? `MRP dependent` : `Stock replenishment`,
    });
    edges.push({ from: lid, to: rid, slip_days: li.slip_days, highlight: hot });
    for (const woId of li.work_order_ids) {
      edges.push({ from: rid, to: `w:${woId}`, slip_days: li.slip_days, highlight: woHighlight.has(woId) });
    }
  }

  if (hidden.length > 0) {
    const value = hidden.reduce((s, l) => s + l.value_usd, 0);
    nodes.push({
      id: "agg",
      kind: "aggregate",
      layer: 2,
      title: `+${hidden.length} more lines`,
      sub: `USD ${Math.round(value / 1000).toLocaleString("en-US")}K · no work-order link`,
    });
    edges.push({ from: sigNode, to: "agg", slip_days: null });
  }

  for (const w of workOrders) {
    const wid = `w:${w.wo.id}`;
    const hot = w.beyond_float_days > 0;
    nodes.push({
      id: wid,
      kind: "work_order",
      layer: 4,
      title: `${w.wo.id} · ${w.wo.asset_ref}`,
      sub: `${w.customer.name} · induct ${fmtDate(w.wo.induction_date)}`,
      meta: `Float ${w.wo.float_days}d · slip ${w.slip_days}d`,
      highlight: hot,
    });
    const mid = `m:${w.wo.id}`;
    nodes.push({
      id: mid,
      kind: "milestone",
      layer: 5,
      title: hot ? `Redelivery +${w.beyond_float_days}d` : "Redelivery holds",
      sub: hot
        ? `${fmtDate(w.wo.target_redelivery)} → ${fmtDate(w.new_redelivery)}`
        : `${fmtDate(w.wo.target_redelivery)} · absorbed by float`,
      meta: w.wo.slot,
      highlight: hot,
    });
    edges.push({ from: wid, to: mid, slip_days: w.beyond_float_days, highlight: hot });
  }

  return { lines, workOrders, nodes, edges };
}

function truncate(s: string, n: number) {
  return s.length > n ? `${s.slice(0, n - 1)}…` : s;
}
