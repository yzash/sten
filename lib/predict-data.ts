import { getAllPOLines, getPart, getSupplier } from "./api";

const EU = new Set(["FR", "DE", "NL", "CZ", "SE"]);

/** One static strategic scenario (PRD 5.7). Exposure is computed from open POs so the number is real. */
export function predictScenario() {
  const lines = getAllPOLines().filter((l) => {
    if (l.status === "delivered") return false;
    const p = getPart(l.part_id);
    const s = getSupplier(l.supplier_id);
    return p?.category === "nacelle" && s && EU.has(s.country_code);
  });
  const value = lines.reduce((a, l) => a + l.qty * l.unit_price, 0);
  const suppliers = [...new Set(lines.map((l) => getSupplier(l.supplier_id)!.name))];
  return {
    probability: 0.35,
    duty_rate: 0.25,
    open_value: value,
    exposure: Math.round(value * 0.25),
    lines: lines.length,
    suppliers,
  };
}
