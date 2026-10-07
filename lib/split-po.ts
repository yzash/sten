export interface SplitSource {
  supplier_id: string;
  unit_price: number;
  lead_time_days: number;
}

export interface SplitResult {
  qtyPrimary: number;
  qtyAlternate: number;
  costUsd: number;
  baselineCostUsd: number;
  costDeltaUsd: number;
  blendedUnitPrice: number;
  /** Days until the full quantity is covered (slowest leg). */
  fullCoverDays: number;
  /** Days until first parts land (fastest leg carrying quantity). */
  firstArrivalDays: number;
  baselineDays: number;
  daysSaved: number;
}

/**
 * Split a PO line quantity across a primary and an alternate approved source.
 * ratio is the primary share, 0 to 1 (0.7 = 70/30).
 */
export function splitPo(qty: number, primary: SplitSource, alternate: SplitSource, ratio: number): SplitResult {
  const r = Math.min(1, Math.max(0, ratio));
  const qtyPrimary = Math.round(qty * r);
  const qtyAlternate = qty - qtyPrimary;
  const costUsd = qtyPrimary * primary.unit_price + qtyAlternate * alternate.unit_price;
  const baselineCostUsd = qty * primary.unit_price;
  const legs = [
    ...(qtyPrimary > 0 ? [primary.lead_time_days] : []),
    ...(qtyAlternate > 0 ? [alternate.lead_time_days] : []),
  ];
  const fullCoverDays = Math.max(...legs);
  const firstArrivalDays = Math.min(...legs);
  return {
    qtyPrimary,
    qtyAlternate,
    costUsd,
    baselineCostUsd,
    costDeltaUsd: costUsd - baselineCostUsd,
    blendedUnitPrice: qty > 0 ? costUsd / qty : 0,
    fullCoverDays,
    firstArrivalDays,
    baselineDays: primary.lead_time_days,
    daysSaved: primary.lead_time_days - firstArrivalDays,
  };
}
