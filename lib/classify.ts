import type { DisruptionType, PartCategory, Signal } from "./schema";

export interface SupplierRef {
  id: string;
  name: string;
  region: string;
  city: string;
  country: string;
}

const TYPE_RULES: [DisruptionType, RegExp][] = [
  ["supplier_distress", /(receivership|bankrupt|insolven|administration|liquidat|credit (rating|score)|covenant|chapter 11|judicial management|distress)/i],
  ["tariff", /(tariff|duty|duties|customs reclass)/i],
  ["export_control", /(export (control|licen[cs]e|ban)|dual-use|sanction|localisation|localization|local content)/i],
  ["pandemic_health", /(outbreak|pandemic|epidemic|virus|infection|health (order|advisory)|quarantine)/i],
  ["natural_calamity", /(typhoon|cyclone|hurricane|earthquake|flood|wildfire|bushfire|tsunami|volcan|storm)/i],
  ["conflict_unrest", /(strike|protest|unrest|riot|clash|war|conflict|coup|blockade)/i],
  ["route_disruption", /(route|routing|port|freighter|rotation|sailing|congestion|canal|airspace|vessel|shipment|carrier)/i],
  ["supply_shortage", /(shortage|allocation|capacity|fire|outage|furnace|quality escape|reject|scarcity)/i],
];

const CORRIDOR_RULES: [string, RegExp][] = [
  ["FRA-SIN", /frankfurt|\bFRA\b/i],
  ["PKG", /port klang|klang/i],
  ["RTM", /rotterdam/i],
  ["RED-SEA", /red sea|suez/i],
  ["HAM", /hamburg/i],
  ["PANAMA", /panama/i],
  ["TPE-SIN", /taipei|taoyuan airport/i],
];

const REGION_RULES: [string, RegExp][] = [
  ["TW-north", /hsinchu|taoyuan|north(ern)? taiwan/i],
  ["MY-penang", /penang|batu kawan|bayan lepas/i],
  ["MY-johor", /johor/i],
  ["MY-selangor", /selangor|shah alam|klang/i],
  ["JP-kansai", /kansai|osaka|sakai|kobe/i],
  ["JP-tohoku", /tohoku|sendai/i],
  ["JP-kanto", /kanto|tokyo|sagamihara/i],
  ["JP-chubu", /chubu|nagoya|gifu|chita/i],
  ["VN-north", /haiphong|hanoi|north(ern)? vietnam/i],
  ["PH-visayas", /cebu|mactan|visayas/i],
  ["KR-central", /daejeon/i],
  ["FR-occitanie", /toulouse|blagnac|occitanie/i],
  ["FR-auvergne", /lyon|macon/i],
  ["GB-midlands", /midlands|coventry|telford|derby/i],
  ["DE-bavaria", /bavaria|augsburg|munich/i],
  ["US-ohio", /ohio|cincinnati|akron/i],
  ["IT-piedmont", /piedmont|turin/i],
  ["TH-eastern", /chonburi|laem chabang|rayong/i],
  ["IN-karnataka", /bengaluru|bangalore|karnataka/i],
];

const CATEGORY_RULES: [PartCategory, RegExp][] = [
  ["fastener", /fastener|bolt|rivet|pin|collar|nut/i],
  ["seal", /seal|o-ring|gasket|elastomer/i],
  ["nacelle", /nacelle|acoustic panel|thrust reverser|cowl/i],
  ["raw_alloy", /titanium|nickel|alloy|bar stock|forging stock|magnet/i],
  ["consumable", /consumable|chemical|solvent|harness|sealant/i],
  ["engine_lru", /engine|turbine|compressor|hpc|lpt|sensor/i],
];

/** Rules-based best guess for a free-text headline. Reports 0.60 confidence and a draft badge (PRD 7.1). */
export function classifyFreeText(headline: string, suppliers: SupplierRef[], at: string, seq: number): Signal {
  const type = TYPE_RULES.find(([, re]) => re.test(headline))?.[0] ?? "supply_shortage";
  const supplierHits = suppliers.filter((s) => {
    const first = s.name.split(" ")[0];
    return first.length > 3 && new RegExp(`\\b${first}\\b`, "i").test(headline);
  });
  const corridors = CORRIDOR_RULES.filter(([, re]) => re.test(headline)).map(([c]) => c);
  const regions = REGION_RULES.filter(([, re]) => re.test(headline)).map(([r]) => r);
  const categories = CATEGORY_RULES.filter(([, re]) => re.test(headline)).map(([c]) => c);
  const strategic = /(from \d|next (month|quarter)|will|plans?|proposed|announce|warning|expected)/i.test(headline);
  const days = Number(headline.match(/(\d+)\s*(day|d\b)/i)?.[1] ?? (headline.match(/(\d+)\s*week/i) ? Number(headline.match(/(\d+)\s*week/i)![1]) * 7 : 7));
  const id = `DRAFT-${String(seq).padStart(2, "0")}`;
  return {
    id,
    received_at: at,
    channel: "email",
    headline,
    raw_text: headline,
    type,
    state: strategic ? "strategic" : "operational",
    confidence: 0.6,
    disposition: "material",
    material: false,
    parent_id: null,
    affected_supplier_ids: supplierHits.map((s) => s.id),
    affected_part_ids: [],
    affected_po_line_ids: [],
    affected_regions: supplierHits.length ? [] : regions,
    affected_categories: supplierHits.length ? [] : categories.slice(0, 1),
    affected_corridors: corridors,
    est_delay_days: Math.min(60, Math.max(1, days)),
    discard_reason: null,
    evidence: [{ channel: "email", received_at: at, snippet: headline }],
    checkpoint: corridors.length ? "shipment" : "purchasing",
    library: false,
  };
}
