import { describe, expect, it } from "vitest";
import { world, getSignal, listSignals } from "@/lib/api";
import { computeExposure } from "@/lib/materiality";
import { buildImpactChain } from "@/lib/impact-chain";
import {
  composite,
  costSeverity,
  delaySeverity,
  opsSeverity,
  rag,
  reputationSeverity,
  scoreImpact,
  supplierFactors,
} from "@/lib/scoring";
import { splitPo } from "@/lib/split-po";

const aerotech = getSignal("SIG-0007")!;

describe("materiality filter", () => {
  it("Aerotech exposure is exactly its 3 open PO lines via rule (a)", () => {
    const e = computeExposure(aerotech, world);
    expect(e.material).toBe(true);
    expect(e.poLineIds).toHaveLength(3);
    expect(e.viaSupplier).toHaveLength(3);
    expect(e.viaRegion).toHaveLength(0);
    expect(e.viaRoute).toHaveLength(0);
    expect(e.supplierIds).toEqual(["100118"]);
    expect(new Set(e.partIds)).toEqual(new Set(["ENG-4471-120", "ENG-4471-130", "ENG-4471-140"]));
  });

  it("discards the Red Sea routing notice with a reason naming the empty rule", () => {
    const redSea = getSignal("SIG-0021")!;
    const e = computeExposure(redSea, world);
    expect(e.material).toBe(false);
    expect(e.discardReason).toMatch(/no in-transit shipments through the affected corridor/);
  });

  it("route signals expose in-transit shipments via rule (c)", () => {
    const fra = getSignal("SIG-0015")!;
    const e = computeExposure(fra, world);
    expect(e.shipmentIds).toHaveLength(3);
    expect(e.viaRoute.length).toBeGreaterThan(0);
  });

  it("seeded feed has 40 signals, 16 material, 8 discarded with reasons", () => {
    const all = listSignals();
    expect(all).toHaveLength(40);
    const material = all.filter((s) => s.disposition === "material");
    const discarded = all.filter((s) => s.disposition === "discarded");
    expect(material).toHaveLength(16);
    expect(discarded).toHaveLength(8);
    for (const s of material) expect(computeExposure(s, world).material).toBe(true);
    for (const s of discarded) {
      expect(computeExposure(s, world).material).toBe(false);
      expect(s.discard_reason).toBeTruthy();
    }
  });

  it("an empty scope is never material", () => {
    const e = computeExposure({ affected_supplier_ids: [], affected_regions: [], affected_categories: [], affected_corridors: [] }, world);
    expect(e.material).toBe(false);
  });
});

describe("impact chain", () => {
  const chain = buildImpactChain(aerotech, computeExposure(aerotech, world), world);

  it("computes slip from confirmed vs needed dates plus the estimated delay", () => {
    const slips = Object.fromEntries(chain.lines.map((l) => [l.line.part_id, l.slip_days]));
    expect(slips).toEqual({ "ENG-4471-120": 21, "ENG-4471-130": 34, "ENG-4471-140": 15 });
  });

  it("two engine inductions slip 21 and 34 days; only one moves beyond float", () => {
    const wos = Object.fromEntries(chain.workOrders.map((w) => [w.wo.id, w]));
    expect(wos["WO-2601"].slip_days).toBe(34);
    expect(wos["WO-2601"].beyond_float_days).toBe(15);
    expect(wos["WO-2602"].slip_days).toBe(21);
    expect(wos["WO-2602"].beyond_float_days).toBe(0);
  });

  it("lays out left to right across six layers", () => {
    const layers = new Set(chain.nodes.map((n) => n.layer));
    expect([...layers].sort()).toEqual([0, 1, 2, 3, 4, 5]);
    for (const e of chain.edges) {
      const from = chain.nodes.find((n) => n.id === e.from)!;
      const to = chain.nodes.find((n) => n.id === e.to)!;
      expect(to.layer).toBeGreaterThan(from.layer);
    }
    expect(chain.nodes.filter((n) => n.highlight).map((n) => n.id)).toEqual(["w:WO-2601", "m:WO-2601"]);
  });
});

describe("impact scoring", () => {
  const scores = scoreImpact(buildImpactChain(aerotech, computeExposure(aerotech, world), world), world);

  it("Aerotech lands at cost 78, delay 64, ops 55, reputation 70", () => {
    expect(scores.cost.severity).toBe(78);
    expect(scores.delay.severity).toBe(64);
    expect(scores.ops.severity).toBe(55);
    expect(scores.reputation.severity).toBe(70);
  });

  it("cost is open PO value + expedite + LD; overall is the max with its driver", () => {
    expect(scores.cost.po_value_usd).toBe(1_400_000);
    expect(scores.cost.po_count).toBe(3);
    expect(scores.cost.usd).toBe(scores.cost.po_value_usd + scores.cost.expedite_usd + scores.cost.ld_usd);
    expect(scores.overall).toEqual({ severity: 78, driver: "cost" });
    expect(scores.delay.days).toBe(15);
  });

  it("bands match the PRD table", () => {
    expect(costSeverity(0)).toBe(0);
    expect(costSeverity(99_999)).toBe(25);
    expect(costSeverity(100_000)).toBe(26);
    expect(costSeverity(500_000)).toBe(51);
    expect(costSeverity(2_000_000)).toBe(76);
    expect(costSeverity(20_000_000)).toBe(100);
    expect(delaySeverity(0)).toBe(0);
    expect(delaySeverity(1)).toBe(26);
    expect(delaySeverity(7)).toBe(50);
    expect(delaySeverity(8)).toBe(51);
    expect(delaySeverity(21)).toBe(75);
    expect(delaySeverity(22)).toBe(76);
    expect(opsSeverity(0, 0)).toBe(0);
    expect(opsSeverity(1, 0)).toBeGreaterThanOrEqual(26);
    expect(opsSeverity(1, 0)).toBeLessThanOrEqual(50);
    expect(opsSeverity(2, 0)).toBe(51);
    expect(opsSeverity(0, 1)).toBe(51);
    expect(opsSeverity(4, 0)).toBe(76);
    expect(opsSeverity(0, 2)).toBe(76);
    expect(reputationSeverity(49_000)).toBeLessThanOrEqual(25);
    expect(reputationSeverity(150_000)).toBe(51);
    expect(reputationSeverity(600_000)).toBeGreaterThanOrEqual(76);
  });
});

describe("risk scorecard", () => {
  const engine = world.suppliers.filter((s) => s.categories.includes("engine_lru"));

  it("engine components: Aerotech red, two amber, rest green", () => {
    const bands = engine.map((s) => [s.id, rag(supplierFactors(s))]);
    expect(bands.filter(([, b]) => b === "red")).toEqual([["100118", "red"]]);
    expect(bands.filter(([, b]) => b === "amber")).toHaveLength(2);
  });

  it("a factor under 30 forces at least amber", () => {
    const f = { financial: 95, capacity: 95, geo_esg: 95, sourcing: 25, network: 95 };
    expect(composite(f)).toBeGreaterThanOrEqual(70);
    expect(rag(f)).toBe("amber");
  });

  it("weights change the composite (sensitivity)", () => {
    const s = engine.find((x) => x.id === "100118")!;
    const f = supplierFactors(s);
    expect(composite(f, { financial: 0, capacity: 100, geo_esg: 0, sourcing: 0, network: 0 })).toBe(f.capacity);
  });
});

describe("split PO maths", () => {
  it("70/30 split of 30 rings across two sources", () => {
    const r = splitPo(30, { supplier_id: "A", unit_price: 17_920, lead_time_days: 28 }, { supplier_id: "B", unit_price: 22_080, lead_time_days: 3 }, 0.7);
    expect(r.qtyPrimary).toBe(21);
    expect(r.qtyAlternate).toBe(9);
    expect(r.costUsd).toBe(21 * 17_920 + 9 * 22_080);
    expect(r.fullCoverDays).toBe(28);
    expect(r.firstArrivalDays).toBe(3);
  });

  it("100/0 is the baseline", () => {
    const r = splitPo(10, { supplier_id: "A", unit_price: 100, lead_time_days: 40 }, { supplier_id: "B", unit_price: 120, lead_time_days: 10 }, 1);
    expect(r.costDeltaUsd).toBe(0);
    expect(r.fullCoverDays).toBe(40);
    expect(r.qtyAlternate).toBe(0);
  });
});
