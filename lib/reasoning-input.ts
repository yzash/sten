import { assess, getInventory, getPart, getSupplier, listPrecedents } from "./api";
import type { Signal } from "./schema";

/** The exact input the reasoning service receives for one signal (PRD 7.2). */
export function buildReasoningInput(signal: Signal) {
  const a = assess(signal);
  const partIds = [...new Set(a.chain.lines.map((l) => l.line.part_id))];
  return {
    signal: {
      id: signal.id,
      received_at: signal.received_at,
      channel: signal.channel,
      headline: signal.headline,
      raw_text: signal.raw_text,
      type: signal.type,
      state: signal.state,
      est_delay_days: signal.est_delay_days,
      evidence: signal.evidence,
    },
    exposure: {
      po_lines: a.chain.lines.map((l) => ({
        id: l.line.id,
        supplier: getSupplier(l.line.supplier_id)?.name,
        lifnr: l.line.supplier_id,
        part: l.line.part_id,
        description: getPart(l.line.part_id)?.description,
        qty: l.line.qty,
        unit_price: l.line.unit_price,
        value_usd: l.value_usd,
        confirmed: l.line.confirmed_date,
        needed: l.line.needed_date,
        new_eta: l.new_eta,
        slip_days: l.slip_days,
        work_orders: l.work_order_ids,
      })),
      shipments: a.exposure.shipmentIds,
      work_orders: a.chain.workOrders.map((w) => ({
        id: w.wo.id,
        asset: w.wo.asset_ref,
        customer: w.customer.name,
        customer_tier: w.customer.tier,
        induction: w.wo.induction_date,
        redelivery: w.wo.target_redelivery,
        new_redelivery: w.new_redelivery,
        slot: w.wo.slot,
        float_days: w.wo.float_days,
        slip_days: w.slip_days,
        beyond_float_days: w.beyond_float_days,
        ld_per_day_usd: w.wo.ld_per_day_usd,
        ld_exposure_usd: w.ld_exposure_usd,
      })),
    },
    scores: a.scores,
    candidate_sources: partIds.map((pid) => {
      const p = getPart(pid)!;
      return {
        part: pid,
        description: p.description,
        sole_source: p.sole_source,
        airworthiness: p.airworthiness_doc,
        sources: p.approved_sources.map((s) => ({ ...s, name: getSupplier(s.supplier_id)?.name })),
      };
    }),
    inventory: partIds.flatMap((pid) => getInventory({ partId: pid })),
    precedents: listPrecedents(),
  };
}
