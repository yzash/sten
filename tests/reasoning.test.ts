import { describe, expect, it } from "vitest";
import { assess, getSignal, listLibrarySignals, listPrecedents, listSignals } from "@/lib/api";
import { checkReasoning } from "@/lib/reasoning-contract";
import { REASONING } from "@/lib/reasoning-index";
import { FALLBACK, routePrompt } from "@/lib/ask";

const precedentIds = new Set(listPrecedents().map((p) => p.id));
const material = [...listSignals(), ...listLibrarySignals()].filter((s) => s.material);

describe("prebuilt reasoning", () => {
  it("exists for every material signal (16 feed + 3 library)", () => {
    expect(material).toHaveLength(19);
    for (const s of material) expect(REASONING[s.id], s.id).toBeDefined();
  });

  for (const s of material) {
    it(`${s.id} validates against the schema and reconciles to scoring within 5%`, () => {
      expect(checkReasoning(REASONING[s.id], assess(getSignal(s.id)!), precedentIds)).toEqual([]);
    });
  }

  it("Aerotech has five options with OPT-1 recommended", () => {
    const r = REASONING["SIG-0007"];
    expect(r.options).toHaveLength(5);
    expect(r.recommended_id).toBe("OPT-1");
  });

  it("flags drift above 5% and em dashes", () => {
    const r = structuredClone(REASONING["SIG-0007"]);
    r.impact.cost.usd = Math.round(r.impact.cost.usd * 1.06);
    r.summary = "Bad — dash";
    const issues = checkReasoning(r, assess(getSignal("SIG-0007")!), precedentIds).map((i) => i.path);
    expect(issues).toContain("impact.cost.usd");
    expect(issues).toContain("summary");
  });

  it("rejects an option with no agent action", () => {
    const r = structuredClone(REASONING["SIG-0007"]);
    r.options[1].actions = [];
    expect(checkReasoning(r, assess(getSignal("SIG-0007")!), precedentIds).length).toBeGreaterThan(0);
  });
});

describe("ask panel router", () => {
  it("routes free text to the nearest prompt id", () => {
    expect(routePrompt("what did we do last time?")).toBe("last_time");
    expect(routePrompt("how much is the cheapest")).toBe("cheapest");
    expect(routePrompt("why is the induction late")).toBe("why_move");
    expect(routePrompt("any alternatives")).toBe("options");
    expect(routePrompt("tell me a joke")).toBeNull();
    expect(FALLBACK).toContain("In production this is a live query");
  });
});
