import type { ImpactChain } from "./impact-chain";
import type { Customer, Supplier } from "./schema";
import { indexBy, type World } from "./world";

/* ------------------------------------------------------------------ */
/* Band mapping                                                        */
/* ------------------------------------------------------------------ */

interface Band {
  lo: number; // metric value at band start
  hi: number; // metric value at band end (the top band caps here)
  sLo: number;
  sHi: number;
}

/** Linear within a band (PRD 7.1). Bands must be ascending and contiguous. */
export function bandScore(value: number, bands: Band[]): number {
  if (value <= 0) return 0;
  for (let i = 0; i < bands.length; i++) {
    const b = bands[i];
    const last = i === bands.length - 1;
    if (value < b.hi || last) {
      const t = Math.min(1, Math.max(0, (value - b.lo) / (b.hi - b.lo)));
      return Math.round(b.sLo + t * (b.sHi - b.sLo));
    }
  }
  return 100;
}

export const COST_BANDS: Band[] = [
  { lo: 0, hi: 100_000, sLo: 0, sHi: 25 },
  { lo: 100_000, hi: 500_000, sLo: 26, sHi: 50 },
  { lo: 500_000, hi: 2_000_000, sLo: 51, sHi: 75 },
  { lo: 2_000_000, hi: 5_000_000, sLo: 76, sHi: 100 },
];

export const REPUTATION_BANDS: Band[] = [
  { lo: 0, hi: 50_000, sLo: 0, sHi: 25 },
  { lo: 50_000, hi: 150_000, sLo: 26, sHi: 50 },
  { lo: 150_000, hi: 500_000, sLo: 51, sHi: 75 },
  { lo: 500_000, hi: 2_000_000, sLo: 76, sHi: 100 },
];

export function costSeverity(usd: number) {
  return bandScore(usd, COST_BANDS);
}

export function delaySeverity(d: number) {
  if (d <= 0) return 0;
  // delay is an integer count; 1..7 maps across 26..50, 8..21 across 51..75
  if (d <= 7) return Math.round(26 + ((d - 1) / 6) * 24);
  if (d <= 21) return Math.round(51 + ((d - 8) / 13) * 24);
  return Math.min(100, Math.round(76 + ((d - 22) / 38) * 24));
}

/**
 * Ops bands: none 0; 1 line 26-50; 2 to 3 lines or 1 slot 51-75; over 3 lines or over 1 slot 76-100.
 * Within a band, each extra line or slot adds 4 points.
 */
export function opsSeverity(lines: number, slots: number) {
  if (lines === 0 && slots === 0) return 0;
  if (slots > 1 || lines > 3) return Math.min(100, Math.max(76, 76 + 4 * (lines + slots - 4)));
  if (slots === 1 || lines >= 2) return Math.min(75, Math.max(51, 51 + 4 * (lines + slots - 2)));
  return 38;
}

export function reputationSeverity(weightedUsd: number) {
  return bandScore(weightedUsd, REPUTATION_BANDS);
}

export const TIER_WEIGHT: Record<Customer["tier"], number> = { strategic: 1.0, key: 0.6, standard: 0.3 };

/* ------------------------------------------------------------------ */
/* Impact scoring                                                      */
/* ------------------------------------------------------------------ */

export const EXPEDITE_FACTOR_SOLE_SOURCE = 0.3;
export const EXPEDITE_FACTOR_DEFAULT = 0.15;

export type Dimension = "cost" | "delay" | "ops" | "reputation";
export const DIMENSION_LABELS: Record<Dimension, string> = {
  cost: "Cost",
  delay: "Delay",
  ops: "Ops",
  reputation: "Reputation",
};

export interface ImpactScores {
  cost: {
    usd: number;
    po_value_usd: number;
    expedite_usd: number;
    ld_usd: number;
    po_count: number;
    severity: number;
    rationale: string;
  };
  delay: { days: number; severity: number; rationale: string; driver_wo: string | null };
  ops: { lines: number; slots: number; severity: number; rationale: string };
  reputation: { weighted_usd: number; severity: number; rationale: string; driver_customer: string | null };
  overall: { severity: number; driver: Dimension };
}

const k = (n: number) =>
  n >= 1_000_000 ? `USD ${(n / 1_000_000).toFixed(2)}M` : `USD ${Math.round(n / 1000).toLocaleString("en-US")}K`;

/**
 * cost = open PO value at risk + expedite estimate + LD exposure
 * delay = max slip beyond total float across affected work orders
 * ops = induction slots and work-order lines at risk
 * reputation = customer tier weight × LD exposure
 */
export function scoreImpact(chain: ImpactChain, world: World): ImpactScores {
  const parts = indexBy(world.parts, "id");

  const poValue = chain.lines.reduce((s, l) => s + l.value_usd, 0);
  const expedite = chain.lines
    .filter((l) => l.slip_days > 0)
    .reduce((s, l) => {
      const sole = parts.get(l.line.part_id)?.sole_source ?? false;
      return s + l.value_usd * (sole ? EXPEDITE_FACTOR_SOLE_SOURCE : EXPEDITE_FACTOR_DEFAULT);
    }, 0);
  const ld = chain.workOrders.reduce((s, w) => s + w.ld_exposure_usd, 0);
  const costUsd = Math.round(poValue + expedite + ld);
  const poCount = new Set(chain.lines.map((l) => l.line.ebeln)).size;

  const delayDriver = [...chain.workOrders].sort((a, b) => b.beyond_float_days - a.beyond_float_days)[0];
  const delayDays = delayDriver?.beyond_float_days ?? 0;

  const lines = chain.workOrders.reduce((s, w) => s + w.line_ids.length, 0);
  const slots = chain.workOrders.filter((w) => w.beyond_float_days > 0).length;

  const repByWo = chain.workOrders.map((w) => ({
    w,
    v: TIER_WEIGHT[w.customer.tier] * w.ld_exposure_usd,
  }));
  const weighted = Math.round(repByWo.reduce((s, x) => s + x.v, 0));
  const repDriver = [...repByWo].sort((a, b) => b.v - a.v)[0];

  const cost = {
    usd: costUsd,
    po_value_usd: Math.round(poValue),
    expedite_usd: Math.round(expedite),
    ld_usd: Math.round(ld),
    po_count: poCount,
    severity: costSeverity(costUsd),
    rationale:
      `${k(poValue)} open PO value across ${poCount} PO${poCount === 1 ? "" : "s"}` +
      (expedite > 0 ? `, ${k(expedite)} expedite estimate` : "") +
      (ld > 0 ? `, ${k(ld)} LD exposure` : ""),
  };

  const delay = {
    days: delayDays,
    severity: delaySeverity(delayDays),
    driver_wo: delayDriver && delayDays > 0 ? delayDriver.wo.id : null,
    rationale:
      delayDriver && delayDays > 0
        ? `${delayDriver.wo.id} slips ${delayDriver.slip_days}d against ${delayDriver.wo.float_days}d float, redelivery moves ${delayDays}d`
        : chain.workOrders.length
          ? `Slip absorbed by work-order float on ${chain.workOrders.length} work order${chain.workOrders.length === 1 ? "" : "s"}`
          : "No work orders depend on the exposed lines",
  };

  const ops = {
    lines,
    slots,
    severity: opsSeverity(lines, slots),
    rationale:
      lines === 0 && slots === 0
        ? "No work-order lines or induction slots at risk"
        : `${lines} work-order line${lines === 1 ? "" : "s"} at risk` +
          (slots > 0
            ? `, ${slots} induction slot${slots === 1 ? "" : "s"} (${chain.workOrders
                .filter((w) => w.beyond_float_days > 0)
                .map((w) => w.wo.slot)
                .join(", ")})`
            : ", no slot lost"),
  };

  const reputation = {
    weighted_usd: weighted,
    severity: reputationSeverity(weighted),
    driver_customer: repDriver && repDriver.v > 0 ? repDriver.w.customer.id : null,
    rationale:
      repDriver && repDriver.v > 0
        ? `${repDriver.w.customer.name} (${repDriver.w.customer.tier}) carries ${k(repDriver.w.ld_exposure_usd)} LD exposure at USD ${Math.round(
            repDriver.w.wo.ld_per_day_usd / 1000,
          )}K per day`
        : "No customer LD exposure",
  };

  const dims: [Dimension, number][] = [
    ["cost", cost.severity],
    ["delay", delay.severity],
    ["ops", ops.severity],
    ["reputation", reputation.severity],
  ];
  const top = dims.reduce((a, b) => (b[1] > a[1] ? b : a));

  return { cost, delay, ops, reputation, overall: { severity: top[1], driver: top[0] } };
}

export type SeverityLevel = "low" | "medium" | "high" | "critical";
export function severityLevel(s: number): SeverityLevel {
  if (s >= 76) return "critical";
  if (s >= 51) return "high";
  if (s >= 26) return "medium";
  return "low";
}

/* ------------------------------------------------------------------ */
/* Risk scorecard                                                      */
/* ------------------------------------------------------------------ */

export type Factor = "financial" | "capacity" | "geo_esg" | "sourcing" | "network";
export const FACTORS: Factor[] = ["financial", "capacity", "geo_esg", "sourcing", "network"];
export const FACTOR_LABELS: Record<Factor, string> = {
  financial: "Financial health",
  capacity: "Capacity and capability",
  geo_esg: "Geo and ESG",
  sourcing: "Sourcing depth",
  network: "Network depth",
};
export type Weights = Record<Factor, number>;
export const DEFAULT_WEIGHTS: Weights = { financial: 30, capacity: 20, geo_esg: 15, sourcing: 25, network: 10 };

export function supplierFactors(s: Pick<Supplier, "financial_health" | "capacity" | "esg" | "geo_risk" | "sourcing_depth" | "network_depth">): Record<Factor, number> {
  return {
    financial: s.financial_health,
    capacity: s.capacity,
    geo_esg: Math.round((100 - s.geo_risk + s.esg) / 2),
    sourcing: s.sourcing_depth,
    network: s.network_depth,
  };
}

export function composite(f: Record<Factor, number>, w: Weights = DEFAULT_WEIGHTS): number {
  const total = FACTORS.reduce((s, x) => s + w[x], 0) || 1;
  return Math.round(FACTORS.reduce((s, x) => s + f[x] * w[x], 0) / total);
}

export type Rag = "green" | "amber" | "red";

/** 70+ green, 45 to 69 amber, under 45 red. A factor under 30 forces at least amber. */
export function rag(f: Record<Factor, number>, w: Weights = DEFAULT_WEIGHTS): Rag {
  const c = composite(f, w);
  const band: Rag = c >= 70 ? "green" : c >= 45 ? "amber" : "red";
  if (band === "green" && FACTORS.some((x) => f[x] < 30)) return "amber";
  return band;
}
