/**
 * Synthetic data generator. Fixed seed, so every run (and every deploy) is identical.
 *   pnpm seed
 * Writes /data/*.json. Scenario entities are hand-designed; the background supply base is generated.
 */
import fs from "node:fs";
import path from "node:path";
import { z } from "zod";
import { addDays, diffDays } from "../lib/dates";
import { computeExposure } from "../lib/materiality";
import { buildImpactChain } from "../lib/impact-chain";
import { composite, rag, scoreImpact, supplierFactors } from "../lib/scoring";
import { chance, mulberry32, pick, randInt, shuffle } from "../lib/rand";
import {
  Customer,
  DiversificationRec,
  InventoryRow,
  Part,
  type PartCategory,
  POLine,
  Precedent,
  PurchaseOrder,
  Shipment,
  Signal,
  SourcingCall,
  Supplier,
  WorkOrder,
} from "../lib/schema";
import { BLOCKLIST } from "./blocklist";

const r = mulberry32(20261013);
const CLOCK = "2026-10-07T00:30:00Z"; // 08:30 SGT
const TODAY = "2026-10-07";
const OUT = path.join(__dirname, "..", "data");

/* ================================================================== */
/* Suppliers                                                           */
/* ================================================================== */

type SupSpec = [
  id: string,
  name: string,
  tier: 1 | 2,
  country: string,
  cc: string,
  city: string,
  region: string,
  cats: PartCategory[],
  fin: number,
  cap: number,
  esg: number,
  geo: number,
  src: number,
  net: number,
  strategic?: boolean,
];

const SUPPLIERS: SupSpec[] = [
  // Engine components
  ["100118", "Aerotech Precision Pte Ltd", 2, "Malaysia", "MY", "Penang (Batu Kawan)", "MY-penang", ["engine_lru"], 18, 62, 64, 30, 22, 40],
  ["100124", "Kemuning Machining Sdn Bhd", 2, "Malaysia", "MY", "Johor Bahru", "MY-johor", ["engine_lru"], 34, 70, 60, 25, 58, 55],
  ["100131", "Hokushin Sensor Works KK", 1, "Japan", "JP", "Sagamihara", "JP-kanto", ["engine_lru"], 82, 74, 78, 28, 26, 62],
  ["100102", "Meridian Turbine Components Inc", 1, "United States", "US", "Cincinnati", "US-ohio", ["engine_lru"], 84, 78, 72, 15, 64, 70, true],
  ["100107", "Valcourt Aeroparts SAS", 1, "France", "FR", "Toulouse", "FR-occitanie", ["engine_lru"], 76, 70, 80, 15, 60, 66],
  ["100110", "Lindqvist Rotating Parts AB", 1, "Sweden", "SE", "Boras", "SE-west", ["engine_lru"], 80, 72, 86, 10, 66, 64, true],
  ["100113", "Kaiserwerk Schmiede GmbH", 2, "Germany", "DE", "Augsburg", "DE-bavaria", ["engine_lru"], 78, 66, 82, 12, 62, 60],
  ["100116", "Takamori Precision Castings KK", 2, "Japan", "JP", "Gifu", "JP-chubu", ["engine_lru"], 81, 75, 76, 24, 60, 62],
  ["100120", "Ostrava Turbine Machining s.r.o.", 2, "Czechia", "CZ", "Ostrava", "CZ-moravia", ["engine_lru"], 74, 72, 74, 18, 64, 60],
  ["100127", "Seletar Engine Parts Pte Ltd", 1, "Singapore", "SG", "Seletar", "SG", ["engine_lru"], 86, 80, 78, 10, 70, 72, true],
  ["100134", "Bengaluru Aero Machining Pvt Ltd", 2, "India", "IN", "Bengaluru", "IN-karnataka", ["engine_lru"], 72, 76, 68, 30, 66, 66],
  ["100138", "Cascadia Alloy Forge Inc", 2, "United States", "US", "Spokane", "US-pnw", ["engine_lru"], 79, 68, 74, 14, 62, 64],
  ["100141", "Pacific Aero Spares Pte Ltd", 1, "Singapore", "SG", "Changi", "SG", ["engine_lru"], 83, 70, 72, 10, 74, 68],
  ["100145", "Laem Chabang Precision Co Ltd", 2, "Thailand", "TH", "Chonburi", "TH-eastern", ["engine_lru"], 80, 78, 66, 32, 62, 60],
  ["100241", "Brightwater Castings Ltd", 1, "United Kingdom", "GB", "Telford", "GB-midlands", ["engine_lru", "raw_alloy"], 77, 70, 76, 14, 60, 62, true],
  // Nacelle
  ["100151", "Rhone Acoustique SA", 1, "France", "FR", "Lyon", "FR-auvergne", ["nacelle"], 78, 72, 80, 14, 48, 60],
  ["100154", "Weser Nacelle Systems GmbH", 1, "Germany", "DE", "Bremen", "DE-north", ["nacelle"], 80, 74, 82, 12, 52, 64, true],
  ["100158", "Halvorsen Composites AS", 2, "Norway", "NO", "Stavanger", "NO-west", ["nacelle"], 74, 66, 88, 8, 56, 52],
  ["100162", "Garonne Aerostructures SARL", 1, "France", "FR", "Blagnac", "FR-occitanie", ["nacelle"], 72, 68, 74, 22, 50, 58],
  ["100165", "Cebu Composite Works Inc", 2, "Philippines", "PH", "Mactan", "PH-visayas", ["nacelle"], 66, 64, 60, 44, 54, 48],
  ["100168", "Arden Nacelle Services Ltd", 1, "United Kingdom", "GB", "Coventry", "GB-midlands", ["nacelle"], 38, 76, 72, 14, 40, 58, true],
  ["100171", "Prairie Composites LLC", 1, "United States", "US", "Wichita", "US-kansas", ["nacelle"], 81, 70, 70, 12, 58, 62],
  // Fasteners
  ["100181", "Hsinchu Fastener Industrial Co", 1, "Taiwan", "TW", "Hsinchu", "TW-north", ["fastener"], 80, 76, 70, 46, 44, 60],
  ["100184", "Taoyuan Aero Fasteners Co", 2, "Taiwan", "TW", "Taoyuan", "TW-north", ["fastener"], 74, 70, 66, 46, 50, 56],
  ["100187", "Kingsbury Fastening Systems Inc", 1, "United States", "US", "Torrance", "US-california", ["fastener"], 84, 80, 70, 12, 66, 70],
  ["100190", "Saone Rivets SAS", 2, "France", "FR", "Macon", "FR-auvergne", ["fastener"], 70, 64, 76, 14, 58, 54],
  ["100193", "Shah Alam Fasteners Sdn Bhd", 2, "Malaysia", "MY", "Shah Alam", "MY-selangor", ["fastener"], 68, 66, 62, 26, 56, 50],
  ["100196", "Chita Bolt Works KK", 2, "Japan", "JP", "Chita", "JP-chubu", ["fastener"], 82, 72, 74, 24, 60, 58],
  // Seals
  ["100201", "Daejeon Seal Technologies Co", 1, "South Korea", "KR", "Daejeon", "KR-central", ["seal"], 79, 74, 72, 22, 46, 58],
  ["100204", "Maas Elastomers BV", 2, "Netherlands", "NL", "Rotterdam", "NL-south", ["seal"], 76, 68, 82, 10, 60, 56],
  ["100207", "Ohio Valley Seal Co", 1, "United States", "US", "Akron", "US-ohio", ["seal"], 82, 76, 70, 12, 64, 66],
  ["100210", "Penang Polymer Seals Sdn Bhd", 2, "Malaysia", "MY", "Bayan Lepas", "MY-penang", ["seal"], 70, 66, 64, 28, 54, 50],
  ["100213", "Coromandel Gasket and Seal Pvt Ltd", 2, "India", "IN", "Chennai", "IN-tamilnadu", ["seal"], 69, 70, 62, 30, 56, 50],
  // Consumables
  ["100221", "Jurong Aero Consumables Pte Ltd", 1, "Singapore", "SG", "Jurong", "SG", ["consumable"], 85, 82, 76, 10, 78, 74],
  ["100224", "Klang Chemical Supplies Sdn Bhd", 2, "Malaysia", "MY", "Klang", "MY-selangor", ["consumable"], 72, 70, 58, 26, 70, 60],
  ["100227", "Haiphong Wire and Harness JSC", 2, "Vietnam", "VN", "Haiphong", "VN-north", ["consumable"], 64, 68, 56, 38, 52, 46],
  ["100230", "Rheinland Aero Chemie GmbH", 2, "Germany", "DE", "Neuss", "DE-west", ["consumable"], 80, 72, 84, 10, 66, 62],
  ["100233", "Kansai Industrial Supply KK", 2, "Japan", "JP", "Sakai", "JP-kansai", ["consumable"], 78, 74, 72, 26, 64, 58],
  // Raw alloy
  ["100244", "Monongahela Specialty Metals Inc", 2, "United States", "US", "Pittsburgh", "US-pennsylvania", ["raw_alloy"], 76, 58, 64, 14, 50, 56],
  ["100247", "Sendai Titanium Bar Co", 2, "Japan", "JP", "Sendai", "JP-tohoku", ["raw_alloy"], 72, 54, 70, 26, 38, 50],
  ["100250", "Plzen Alloy Distribution s.r.o.", 2, "Czechia", "CZ", "Plzen", "CZ-bohemia", ["raw_alloy"], 70, 66, 72, 16, 62, 54],
  ["100253", "Suzhou Rare Magnetics Co Ltd", 2, "China", "CN", "Suzhou", "CN-jiangsu", ["raw_alloy"], 74, 72, 48, 58, 30, 52],
];

const ID = {
  aerotech: "100118",
  kemuning: "100124",
  hokushin: "100131",
  meridian: "100102",
  valcourt: "100107",
  lindqvist: "100110",
  kaiserwerk: "100113",
  takamori: "100116",
  ostrava: "100120",
  seletar: "100127",
  bengaluru: "100134",
  cascadia: "100138",
  pacific: "100141",
  laem: "100145",
  brightwater: "100241",
  rhone: "100151",
  weser: "100154",
  halvorsen: "100158",
  garonne: "100162",
  cebu: "100165",
  arden: "100168",
  prairie: "100171",
  hsinchu: "100181",
  taoyuan: "100184",
  kingsbury: "100187",
  saone: "100190",
  shahalam: "100193",
  chita: "100196",
  daejeon: "100201",
  maas: "100204",
  ohio: "100207",
  penangseal: "100210",
  coromandel: "100213",
  jurong: "100221",
  klang: "100224",
  haiphong: "100227",
  rheinland: "100230",
  kansai: "100233",
  monongahela: "100244",
  sendai: "100247",
  plzen: "100250",
  suzhou: "100253",
} as const;

const MONTHS12 = Array.from({ length: 12 }, (_, i) => {
  const d = new Date(Date.UTC(2025, 10 + i, 1)); // Nov 2025 .. Oct 2026
  return d.toISOString().slice(0, 7);
});

/** Hand-shaped trajectories for the suppliers whose story is in the data. */
const TRAJECTORY: Record<string, Partial<Record<"financial" | "capacity" | "sourcing", number[]>>> = {
  [ID.aerotech]: { financial: [61, 60, 60, 58, 57, 55, 52, 49, 44, 37, 29, 18], capacity: [74, 74, 73, 73, 72, 72, 71, 70, 69, 67, 65, 62] },
  [ID.kemuning]: { financial: [58, 57, 57, 56, 55, 53, 50, 48, 45, 42, 39, 34] },
  [ID.hokushin]: { sourcing: [44, 44, 44, 42, 42, 40, 38, 36, 34, 32, 30, 26] },
  [ID.arden]: { financial: [62, 61, 60, 58, 57, 55, 52, 50, 47, 44, 41, 38] },
};

function buildHistory(spec: SupSpec) {
  const [id, , , , , , , , fin, cap, esg, geo, src, net] = spec;
  const now = { financial: fin, capacity: cap, geo_esg: Math.round((100 - geo + esg) / 2), sourcing: src, network: net };
  const traj = TRAJECTORY[id] ?? {};
  return MONTHS12.map((month, i) => {
    const back = 11 - i;
    const jitter = (base: number, amp: number) =>
      back === 0 ? base : Math.max(5, Math.min(98, Math.round(base + (r() - 0.5) * amp + back * 0.2)));
    return {
      month,
      financial: traj.financial?.[i] ?? jitter(now.financial, 6),
      capacity: traj.capacity?.[i] ?? jitter(now.capacity, 6),
      geo_esg: jitter(now.geo_esg, 4),
      sourcing: traj.sourcing?.[i] ?? jitter(now.sourcing, 4),
      network: jitter(now.network, 4),
    };
  });
}

const CERT_POOL = ["AS9100D", "EASA Part 21G POA", "EASA Part 145", "FAA Part 145", "Nadcap Heat Treating", "Nadcap NDT", "ISO 14001"];

const suppliers: Supplier[] = SUPPLIERS.map((spec) => {
  const [id, name, tier, country, cc, city, region, cats, fin, cap, esg, geo, src, net, strategic] = spec;
  const health = (fin + cap) / 2;
  const certs = shuffle(r, CERT_POOL)
    .slice(0, randInt(r, 2, 4))
    .map((c) => ({
      name: c,
      number: `${c.split(" ")[0].toUpperCase().slice(0, 4)}-${randInt(r, 10000, 99999)}`,
      expiry: addDays(TODAY, randInt(r, 40, 720)),
    }));
  if (id === ID.aerotech) certs[0] = { name: "AS9100D", number: "AS91-40218", expiry: "2026-11-30" };
  return {
    id,
    name,
    tier,
    country,
    country_code: cc,
    city,
    region,
    categories: cats,
    sole_source_parts: [],
    financial_health: fin,
    capacity: cap,
    esg,
    geo_risk: geo,
    sourcing_depth: src,
    network_depth: net,
    otd_pct: Math.round(Math.min(99, 70 + health * 0.28 + (r() - 0.5) * 6) * 10) / 10,
    ncr_12m: Math.max(0, Math.round((100 - health) / 9 + (r() - 0.5) * 4)),
    certs,
    payment_terms: pick(r, ["Net 30", "Net 45", "Net 60", "2/10 Net 45", "Net 60"]),
    strategic: !!strategic,
    history: buildHistory(spec),
    status: id === ID.aerotech ? "receivership" : "active",
  };
});
const supById = new Map(suppliers.map((s) => [s.id, s]));
supById.get(ID.aerotech)!.otd_pct = 71.4;
supById.get(ID.aerotech)!.ncr_12m = 9;
supById.get(ID.arden)!.payment_terms = "Net 45";
supById.get(ID.daejeon)!.ncr_12m = 7;

/* ================================================================== */
/* Parts                                                               */
/* ================================================================== */

const parts: Part[] = [];
const partById = new Map<string, Part>();

function addPart(p: Omit<Part, "approved_sources"> & { approved_sources: Part["approved_sources"] }) {
  parts.push(p);
  partById.set(p.id, p);
  return p;
}

function src(supplier_id: string, price: number, lead: number, kind: Part["approved_sources"][number]["kind"] = "oem") {
  return { supplier_id, price_usd: Math.round(price), lead_time_days: lead, kind };
}

// --- Scenario parts ------------------------------------------------
const RINGS: [string, string, number][] = [
  ["ENG-4471-120", "HPC stage 3 blade retention ring", 14_500],
  ["ENG-4471-130", "HPC stage 4 blade retention ring", 16_000],
  ["ENG-4471-140", "HPC stage 5 blade retention ring", 13_600],
];
for (const [id, d, cost] of RINGS) {
  addPart({
    id,
    description: d,
    category: "engine_lru",
    lead_time_days: 120,
    unit_cost_usd: cost,
    approved_sources: [
      src(ID.aerotech, cost, 120),
      src(ID.meridian, cost * 1.12, 28),
      src(ID.valcourt, cost * 0.82, 24, "pma"),
      src(ID.pacific, cost * 1.38, 3, "distributor"),
    ],
    airworthiness_doc: "Dual release",
    criticality: "A",
    sole_source: true,
    origin_region: "MY-penang",
  });
}

const S = (
  id: string,
  description: string,
  category: PartCategory,
  cost: number,
  lead: number,
  sources: Part["approved_sources"],
  opts: Partial<Pick<Part, "criticality" | "sole_source" | "airworthiness_doc">> = {},
) =>
  addPart({
    id,
    description,
    category,
    lead_time_days: lead,
    unit_cost_usd: cost,
    approved_sources: sources,
    airworthiness_doc: opts.airworthiness_doc ?? (category === "consumable" || category === "raw_alloy" ? "CoC" : "FAA 8130-3"),
    criticality: opts.criticality ?? "A",
    sole_source: opts.sole_source ?? sources.length === 1,
    origin_region: supById.get(sources[0].supplier_id)!.region,
  });

S("ENG-5210-110", "HPT nozzle guide vane casting, stage 1", "engine_lru", 8_800, 90, [src(ID.brightwater, 8_800, 90), src(ID.takamori, 9_500, 70)]);
S("ENG-5210-120", "HPT nozzle guide vane casting, stage 2", "engine_lru", 7_400, 90, [src(ID.brightwater, 7_400, 90), src(ID.takamori, 8_100, 70)]);
S("ENG-6120-210", "N2 speed sensor, dual-use controlled", "engine_lru", 6_900, 75, [src(ID.hokushin, 6_900, 75), src(ID.seletar, 9_400, 14, "distributor")], { sole_source: true });
S("ENG-4810-310", "LPT seal ring segment", "engine_lru", 6_200, 100, [src(ID.lindqvist, 6_200, 100), src(ID.takamori, 6_700, 84), src(ID.cascadia, 6_550, 90)]);
S("ENG-4902-410", "Compressor case bracket, machined", "engine_lru", 3_800, 60, [src(ID.kemuning, 3_800, 60), src(ID.bengaluru, 3_950, 45), src(ID.ostrava, 4_100, 50)], { criticality: "B" });
S("ENG-4902-420", "Bearing housing cover, machined", "engine_lru", 2_650, 55, [src(ID.kemuning, 2_650, 55), src(ID.laem, 2_800, 40)], { criticality: "B" });
S("NAC-7100-110", "Inlet acoustic panel, inner barrel", "nacelle", 68_000, 110, [src(ID.rhone, 68_000, 110), src(ID.prairie, 74_500, 130)]);
S("NAC-7100-120", "Fan cowl acoustic liner", "nacelle", 41_000, 100, [src(ID.weser, 41_000, 100), src(ID.prairie, 45_200, 120)]);
S("NAC-7100-130", "Exhaust acoustic panel", "nacelle", 52_500, 105, [src(ID.rhone, 52_500, 105), src(ID.weser, 54_000, 105)]);
S("NAC-7200-210", "Fan cowl composite panel", "nacelle", 38_500, 80, [src(ID.halvorsen, 38_500, 80), src(ID.cebu, 35_900, 95)]);
S("NAC-7300-210", "Thrust reverser bracket", "nacelle", 4_200, 50, [src(ID.garonne, 4_200, 50), src(ID.prairie, 4_650, 60)], { criticality: "B" });
S("NAC-7300-220", "Nacelle hinge fitting", "nacelle", 2_900, 45, [src(ID.garonne, 2_900, 45)], { criticality: "B" });
S("NAC-7500-310", "Translating sleeve repair kit", "nacelle", 96_000, 60, [src(ID.arden, 96_000, 60)], { sole_source: true });
S("NAC-7500-320", "Thrust reverser cascade overhaul", "nacelle", 54_000, 45, [src(ID.arden, 54_000, 45), src(ID.prairie, 61_000, 70)]);
S("NAC-7600-410", "Composite access panel", "nacelle", 6_400, 40, [src(ID.cebu, 6_400, 40), src(ID.halvorsen, 7_100, 45)], { criticality: "B" });
S("FST-2110-010", "Hi-lock pin, titanium, 5/32", "fastener", 18, 30, [src(ID.hsinchu, 18, 30), src(ID.kingsbury, 24, 21)], { criticality: "B" });
S("FST-2110-020", "Lockbolt collar, A286", "fastener", 11, 30, [src(ID.taoyuan, 11, 30), src(ID.kingsbury, 15, 21)], { criticality: "B" });
S("FST-2120-030", "Blind rivet, monel", "fastener", 4, 25, [src(ID.shahalam, 4, 25), src(ID.saone, 5, 28)], { criticality: "C", airworthiness_doc: "CoC" });
S("SEA-3100-510", "Fuel nozzle O-ring seal kit", "seal", 85, 40, [src(ID.daejeon, 85, 40), src(ID.ohio, 112, 18)], { criticality: "A" });
S("SEA-3100-520", "Gearbox carbon face seal", "seal", 640, 55, [src(ID.maas, 640, 55), src(ID.ohio, 690, 35)]);
S("RAW-9100-050", "Ti-6Al-4V bar, 50 mm, AMS 4928", "raw_alloy", 2_600, 120, [src(ID.sendai, 2_600, 120), src(ID.plzen, 3_050, 45, "distributor")], { criticality: "A" });
S("RAW-9300-610", "SmCo magnet set, actuator motor", "raw_alloy", 1_150, 90, [src(ID.suzhou, 1_150, 90)], { criticality: "A", sole_source: true });
S("CON-8100-110", "Abrasive blast media, aluminium oxide", "consumable", 45, 14, [src(ID.kansai, 45, 14), src(ID.jurong, 52, 3)], { criticality: "C" });
S("CON-8200-210", "Aqueous cleaning concentrate", "consumable", 62, 21, [src(ID.klang, 62, 21), src(ID.jurong, 70, 4)], { criticality: "C" });
S("CON-8400-310", "Ignition lead harness kit", "consumable", 2_300, 45, [src(ID.haiphong, 2_300, 45), src(ID.seletar, 2_900, 21, "distributor")], { criticality: "B" });
S("CON-8300-410", "Corrosion inhibiting compound", "consumable", 38, 18, [src(ID.rheinland, 38, 18), src(ID.jurong, 44, 4)], { criticality: "C" });
S("ENG-5600-710", "Fan blade dovetail forging", "engine_lru", 9_700, 85, [src(ID.kaiserwerk, 9_700, 85), src(ID.cascadia, 10_300, 90)]);

// --- Background parts ---------------------------------------------
const CATEGORY_SPECS: Record<PartCategory, { target: number; price: [number, number]; lead: [number, number]; nouns: string[]; prefix: string }> = {
  engine_lru: {
    target: 50,
    price: [2_000, 48_000],
    lead: [60, 180],
    prefix: "ENG",
    nouns: [
      "HPC variable stator vane",
      "LPC blade, stage 2",
      "Combustor liner segment",
      "Fuel nozzle assembly",
      "HPT shroud segment",
      "Bearing support housing",
      "Oil pump assembly",
      "Accessory gearbox shaft",
      "Fan case abradable panel",
      "Turbine disk spacer",
      "Compressor seal land",
      "Fuel metering unit",
      "Bleed valve actuator",
      "Starter air valve",
      "LPT nozzle segment",
      "Igniter plug",
      "Oil scavenge pump",
      "Thrust bearing",
      "Inlet guide vane",
      "Exhaust mixer segment",
    ],
  },
  nacelle: {
    target: 30,
    price: [3_000, 90_000],
    lead: [40, 140],
    prefix: "NAC",
    nouns: [
      "Fan cowl latch assembly",
      "Thrust reverser actuator",
      "Inlet lip skin",
      "Pylon fairing",
      "Blocker door",
      "Hold-open rod",
      "Cascade segment",
      "Fire seal strip",
      "Access door assembly",
      "Drag link fitting",
    ],
  },
  fastener: {
    target: 35,
    price: [3, 180],
    lead: [14, 60],
    prefix: "FST",
    nouns: ["Hex bolt, Inconel", "Self-locking nut", "Washer, countersunk", "Taper-lok bolt", "Shear pin", "Clevis pin", "Rivnut", "Cotter pin, stainless", "Swage collar", "Threaded insert"],
  },
  seal: {
    target: 25,
    price: [12, 950],
    lead: [14, 70],
    prefix: "SEA",
    nouns: ["Packing ring, fluorocarbon", "Labyrinth seal strip", "Static seal, metallic C-ring", "Lip seal, PTFE", "Gasket, compressor case", "O-ring kit, hydraulic", "Brush seal segment"],
  },
  consumable: {
    target: 25,
    price: [8, 450],
    lead: [3, 30],
    prefix: "CON",
    nouns: ["Sealant, polysulfide", "Primer, epoxy", "Lockwire, 0.032", "Penetrant, NDT", "Lubricant, turbine oil", "Masking tape, high temp", "Abrasive disc", "Solvent wipe"],
  },
  raw_alloy: {
    target: 15,
    price: [700, 9_500],
    lead: [45, 200],
    prefix: "RAW",
    nouns: ["Inconel 718 bar", "Waspaloy forging stock", "Ti-6Al-4V plate", "A286 bar", "17-4PH bar", "Haynes-type 188 sheet", "Nickel 625 sheet"],
  },
};

const supByCat = (cat: PartCategory) => suppliers.filter((s) => s.categories.includes(cat) && s.id !== ID.aerotech);
const SCENARIO_ONLY_SUPPLIERS = new Set<string>([ID.aerotech]);

for (const cat of Object.keys(CATEGORY_SPECS) as PartCategory[]) {
  const spec = CATEGORY_SPECS[cat];
  let i = 0;
  while (parts.filter((p) => p.category === cat).length < spec.target) {
    const noun = spec.nouns[i % spec.nouns.length];
    const variant = Math.floor(i / spec.nouns.length);
    i++;
    const id = `${spec.prefix}-${randInt(r, 1000, 9899)}-${String(randInt(r, 1, 99) * 10).padStart(3, "0")}`;
    if (partById.has(id)) continue;
    const pool = supByCat(cat).filter((s) => !SCENARIO_ONLY_SUPPLIERS.has(s.id));
    const nSrc = cat === "engine_lru" || cat === "nacelle" ? randInt(r, 1, 3) : randInt(r, 2, 3);
    const chosen = shuffle(r, pool).slice(0, nSrc);
    const base = Math.round(spec.price[0] + r() ** 2 * (spec.price[1] - spec.price[0]));
    const lead = randInt(r, spec.lead[0], spec.lead[1]);
    const crit: Part["criticality"] = cat === "engine_lru" || cat === "nacelle" ? (chance(r, 0.65) ? "A" : "B") : chance(r, 0.15) ? "B" : "C";
    addPart({
      id,
      description: variant ? `${noun}, rev ${String.fromCharCode(65 + variant)}` : noun,
      category: cat,
      lead_time_days: lead,
      unit_cost_usd: base,
      approved_sources: chosen.map((s, k) =>
        src(s.id, base * (1 + k * (0.04 + r() * 0.08)), Math.max(3, lead - k * randInt(r, 0, 20)), k > 0 && chance(r, 0.25) ? "pma" : "oem"),
      ),
      airworthiness_doc: cat === "consumable" || cat === "raw_alloy" ? "CoC" : chance(r, 0.5) ? "FAA 8130-3" : "EASA Form 1",
      criticality: crit,
      sole_source: chosen.length === 1,
      origin_region: chosen[0].region,
    });
  }
}

// 20% of A-criticality parts are sole-source (PRD realism rule).
{
  const aParts = parts.filter((p) => p.criticality === "A");
  const target = Math.round(aParts.length * 0.2);
  let sole = aParts.filter((p) => p.sole_source);
  // trim sole-source flags on background parts with spare sources, or add flags, until on target
  for (const p of shuffle(r, aParts)) {
    if (sole.length === target) break;
    if (sole.length > target && p.sole_source && !p.id.startsWith("ENG-4471") && !["ENG-6120-210", "NAC-7500-310", "RAW-9300-610"].includes(p.id)) {
      if (p.approved_sources.length === 1) {
        const pool = supByCat(p.category).filter((s) => s.id !== p.approved_sources[0].supplier_id);
        const alt = pick(r, pool);
        p.approved_sources.push(src(alt.id, p.unit_cost_usd * 1.09, p.lead_time_days + 10));
      }
      p.sole_source = false;
    } else if (sole.length < target && !p.sole_source) {
      p.sole_source = true;
    }
    sole = aParts.filter((x) => x.sole_source);
  }
}

for (const p of parts) {
  if (p.sole_source) {
    const s = supById.get(p.approved_sources[0].supplier_id)!;
    s.sole_source_parts.push(p.id);
  }
}

/* ================================================================== */
/* Customers                                                           */
/* ================================================================== */

const customers: Customer[] = [
  { id: "CUS-01", name: "Halcyra Airways", tier: "strategic" },
  { id: "CUS-02", name: "Coralline Air", tier: "key" },
  { id: "CUS-03", name: "Tanjong Pacific Airlines", tier: "strategic" },
  { id: "CUS-04", name: "Kestrel Bay Cargo", tier: "key" },
  { id: "CUS-05", name: "Monsoonal Air", tier: "standard" },
  { id: "CUS-06", name: "Selatan Air Charter", tier: "standard" },
  { id: "CUS-07", name: "Orchid Regional Airways", tier: "key" },
  { id: "CUS-08", name: "Altamira Aircraft Leasing", tier: "standard" },
];

/* ================================================================== */
/* Purchase orders                                                     */
/* ================================================================== */

const pos: PurchaseOrder[] = [];
let ebelnSeq = 4500018200;
const BUYERS = ["MTAN", "RMENON", "JLIM", "SNAIR", "AWONG"];

function newPo(supplier_id: string, created: string, buyer = pick(r, BUYERS)): PurchaseOrder {
  ebelnSeq += randInt(r, 3, 41);
  const po: PurchaseOrder = { ebeln: String(ebelnSeq), supplier_id, created, buyer, currency: "USD", lines: [] };
  pos.push(po);
  return po;
}

function addLine(
  po: PurchaseOrder,
  l: { part_id: string; qty: number; unit_price?: number; confirmed: string; needed: string; status?: POLine["status"]; incoterm?: string },
): POLine {
  const part = partById.get(l.part_id)!;
  const srcRow = part.approved_sources.find((s) => s.supplier_id === po.supplier_id);
  const ebelp = String((po.lines.length + 1) * 10).padStart(5, "0");
  const line: POLine = {
    id: `${po.ebeln}-${ebelp}`,
    ebeln: po.ebeln,
    ebelp,
    supplier_id: po.supplier_id,
    part_id: l.part_id,
    qty: l.qty,
    unit_price: l.unit_price ?? srcRow?.price_usd ?? part.unit_cost_usd,
    confirmed_date: l.confirmed,
    needed_date: l.needed,
    status: l.status ?? "open",
    backlog_days: Math.max(0, diffDays(l.needed, l.confirmed)),
    incoterm: l.incoterm ?? pick(r, ["FCA", "EXW", "DAP", "FCA", "CIP"]),
    plant: pick(r, ["SG01 Changi", "SG02 Seletar", "SG01 Changi"]),
  };
  po.lines.push(line);
  return line;
}

/** Scenario lines, keyed for work-order and shipment wiring. */
const L: Record<string, POLine> = {};
function scen(key: string, supplier: string, part: string, qty: number, confirmed: string, needed: string, opts: { po?: PurchaseOrder; status?: POLine["status"]; unit_price?: number } = {}) {
  const po = opts.po ?? newPo(supplier, addDays(confirmed, -randInt(r, 70, 140)), "MTAN");
  L[key] = addLine(po, { part_id: part, qty, confirmed, needed, status: opts.status, unit_price: opts.unit_price, incoterm: "FCA" });
  return L[key];
}

// Aerotech: exactly 3 open POs, USD 1.40M (40 × 14,500 + 30 × 16,000 + 25 × 13,600)
scen("aero1", ID.aerotech, "ENG-4471-120", 40, "2026-10-14", "2026-11-04");
scen("aero2", ID.aerotech, "ENG-4471-130", 30, "2026-10-20", "2026-10-28");
scen("aero3", ID.aerotech, "ENG-4471-140", 25, "2026-11-18", "2026-12-15");

scen("nickel1", ID.brightwater, "ENG-5210-110", 24, "2026-11-01", "2026-11-10");
scen("nickel2", ID.brightwater, "ENG-5210-120", 18, "2026-11-20", "2026-12-05");
scen("tariff1", ID.rhone, "NAC-7100-110", 4, "2026-11-03", "2026-11-06");
scen("tariff2", ID.weser, "NAC-7100-120", 6, "2026-11-12", "2026-11-20");
scen("tariff3", ID.rhone, "NAC-7100-130", 3, "2026-12-01", "2026-12-10");
scen("typhoon1", ID.hsinchu, "FST-2110-010", 2400, "2026-10-14", "2026-10-20");
scen("typhoon2", ID.taoyuan, "FST-2110-020", 3600, "2026-10-12", "2026-10-18");
scen("fra1", ID.halvorsen, "NAC-7200-210", 3, "2026-10-08", "2026-10-12");
scen("seal1", ID.daejeon, "SEA-3100-510", 400, "2026-10-06", "2026-10-10", { status: "partially_delivered" });
scen("arden1", ID.arden, "NAC-7500-310", 2, "2026-10-22", "2026-10-29");
scen("arden2", ID.arden, "NAC-7500-320", 3, "2026-11-14", "2026-11-25");
scen("strike1", ID.garonne, "NAC-7300-210", 16, "2026-10-20", "2026-10-27");
scen("strike2", ID.garonne, "NAC-7300-220", 24, "2026-11-02", "2026-11-16");
scen("kemuning1", ID.kemuning, "ENG-4902-410", 30, "2026-10-30", "2026-11-12");
scen("kemuning2", ID.kemuning, "ENG-4902-420", 20, "2026-11-20", "2026-12-08");
scen("ti1", ID.sendai, "RAW-9100-050", 40, "2026-11-05", "2026-11-18");
scen("quake1", ID.kansai, "CON-8100-110", 300, "2026-10-15", "2026-10-19");
scen("klang1", ID.klang, "CON-8200-210", 180, "2026-10-12", "2026-10-16");
scen("magnet1", ID.suzhou, "RAW-9300-610", 60, "2026-11-02", "2026-11-16");
scen("harness1", ID.haiphong, "CON-8400-310", 45, "2026-10-16", "2026-10-26");
scen("lpt1", ID.lindqvist, "ENG-4810-310", 36, "2026-10-25", "2026-11-08");
scen("sensor1", ID.hokushin, "ENG-6120-210", 28, "2026-10-21", "2026-11-03");
scen("sensor2", ID.hokushin, "ENG-6120-210", 16, "2026-12-01", "2026-12-14");
scen("fra2", ID.rheinland, "CON-8300-410", 220, "2026-10-09", "2026-10-14");
scen("fra3", ID.kaiserwerk, "ENG-5600-710", 12, "2026-10-10", "2026-10-30");
scen("lib_shah", ID.shahalam, "FST-2120-030", 12000, "2026-10-13", "2026-10-19");
scen("lib_cebu", ID.cebu, "NAC-7600-410", 14, "2026-10-15", "2026-10-21");
scen("lib_rtm", ID.maas, "SEA-3100-520", 40, "2026-10-14", "2026-10-19");
// Alternate-source context for the purchasing board
scen("meridian1", ID.meridian, "ENG-4471-120", 6, "2026-12-20", "2027-01-15");

// Background POs: fill to 95 POs and 310 lines
const TARGET_POS = 95;
const TARGET_LINES = 310;
const bgSuppliers = suppliers.filter((s) => !SCENARIO_ONLY_SUPPLIERS.has(s.id));
const partsBySupplier = new Map<string, Part[]>();
for (const p of parts)
  for (const s of p.approved_sources) partsBySupplier.set(s.supplier_id, [...(partsBySupplier.get(s.supplier_id) ?? []), p]);

const QTY: Record<PartCategory, [number, number]> = {
  engine_lru: [2, 30],
  nacelle: [1, 6],
  fastener: [200, 4000],
  seal: [40, 600],
  consumable: [20, 400],
  raw_alloy: [5, 50],
};
/** Background line value ranges (USD); quantity follows from unit price. */
const LINE_VALUE: Record<PartCategory, [number, number]> = {
  engine_lru: [18_000, 320_000],
  nacelle: [15_000, 240_000],
  fastener: [1_500, 36_000],
  seal: [2_000, 45_000],
  consumable: [800, 22_000],
  raw_alloy: [8_000, 140_000],
};

// Suppliers with chronic backlog (purchasing board "split candidates")
const LATE = new Set<string>([ID.kemuning, ID.garonne, ID.haiphong, ID.cebu, ID.takamori, ID.coromandel]);

while (pos.length < TARGET_POS) {
  const remainingPos = TARGET_POS - pos.length;
  const currentLines = pos.reduce((s, p) => s + p.lines.length, 0);
  const remainingLines = TARGET_LINES - currentLines;
  const s = pick(r, bgSuppliers);
  const catalog = (partsBySupplier.get(s.id) ?? []).filter((p) => !p.id.startsWith("ENG-4471"));
  if (catalog.length === 0) continue;
  const n =
    remainingPos === 1 ? remainingLines : Math.max(1, Math.min(6, Math.round(remainingLines / remainingPos + (r() - 0.5) * 3)));
  const po = newPo(s.id, addDays(TODAY, -randInt(r, 20, 160)));
  for (let i = 0; i < n; i++) {
    const p = pick(r, catalog);
    const needed = addDays(TODAY, randInt(r, -10, 110));
    const late = LATE.has(s.id) ? randInt(r, 8, 30) : chance(r, 0.25) ? randInt(r, 1, 12) : -randInt(r, 0, 10);
    const statusRoll = r();
    const status: POLine["status"] = diffDays(TODAY, needed) < 0 && statusRoll < 0.6 ? "delivered" : statusRoll < 0.12 ? "partially_delivered" : statusRoll < 0.2 ? "delivered" : "open";
    const [v0, v1] = LINE_VALUE[p.category];
    const qty = Math.max(1, Math.round((v0 + r() * (v1 - v0)) / p.unit_cost_usd));
    addLine(po, { part_id: p.id, qty, confirmed: addDays(needed, late), needed, status });
  }
}
const poLines = pos.flatMap((p) => p.lines);

/* ================================================================== */
/* Work orders                                                         */
/* ================================================================== */

const workOrders: WorkOrder[] = [];
let esn = 7_204_100;
const asset = (kind: WorkOrder["kind"]) => {
  esn += randInt(r, 7, 97);
  switch (kind) {
    case "engine":
      return `NT-26 ESN ${String(esn).slice(1)}`;
    case "airframe":
      return `Tail TX-${String.fromCharCode(65 + randInt(r, 0, 25))}${String.fromCharCode(65 + randInt(r, 0, 25))}${String.fromCharCode(65 + randInt(r, 0, 25))}`;
    case "nacelle":
      return `Nacelle set NS-${randInt(r, 1000, 9999)}`;
    default:
      return `S/N HX-${randInt(r, 10000, 99999)}`;
  }
};
const SLOTS: Record<WorkOrder["kind"], string[]> = {
  engine: ["Engine shop line E-14", "Engine shop line E-17", "Engine shop line E-18", "Engine shop line E-21"],
  airframe: ["Hangar 3 bay 2", "Hangar 3 bay 4", "Hangar 5 bay 1"],
  nacelle: ["Nacelle cell N-02", "Nacelle cell N-04"],
  component: ["Component shop C-11", "Component shop C-07"],
};

function addWo(w: {
  id: string;
  kind: WorkOrder["kind"];
  customer: string;
  induction: string;
  tat: number;
  float: number;
  ld: number;
  slot?: string;
  bom: { part: string; qty: number; line?: POLine | null }[];
}) {
  const wo: WorkOrder = {
    id: w.id,
    kind: w.kind,
    asset_ref: asset(w.kind),
    customer_id: w.customer,
    induction_date: w.induction,
    target_redelivery: addDays(w.induction, w.tat),
    slot: w.slot ?? pick(r, SLOTS[w.kind]),
    float_days: w.float,
    ld_per_day_usd: w.ld,
    bom_lines: w.bom.map((b, i) => ({ line: `${w.id}-${String((i + 1) * 10).padStart(4, "0")}`, part_id: b.part, qty: b.qty, po_line_id: b.line?.id ?? null })),
  };
  workOrders.push(wo);
  return wo;
}

const filler = (cat: PartCategory, n: number) =>
  shuffle(
    r,
    parts.filter((p) => p.category === cat && !p.id.startsWith("ENG-4471")),
  )
    .slice(0, n)
    .map((p) => ({ part: p.id, qty: randInt(r, 1, 12) }));

// Scenario work orders (every material signal touches one inducting within 45 days)
addWo({ id: "WO-2601", kind: "engine", customer: "CUS-03", induction: "2026-10-28", tat: 70, float: 19, ld: 12_000, slot: "Engine shop line E-17", bom: [{ part: "ENG-4471-130", qty: 30, line: L.aero2 }, ...filler("engine_lru", 4), ...filler("seal", 2)] });
addWo({ id: "WO-2602", kind: "engine", customer: "CUS-02", induction: "2026-11-04", tat: 70, float: 25, ld: 1_500, slot: "Engine shop line E-18", bom: [{ part: "ENG-4471-120", qty: 40, line: L.aero1 }, ...filler("engine_lru", 3), ...filler("fastener", 2)] });
addWo({ id: "WO-2603", kind: "engine", customer: "CUS-01", induction: "2026-11-10", tat: 65, float: 14, ld: 9_000, bom: [{ part: "ENG-5210-110", qty: 24, line: L.nickel1 }, ...filler("engine_lru", 3)] });
addWo({ id: "WO-2604", kind: "nacelle", customer: "CUS-05", induction: "2026-11-06", tat: 35, float: 6, ld: 2_500, bom: [{ part: "NAC-7100-110", qty: 4, line: L.tariff1 }, ...filler("nacelle", 2), ...filler("fastener", 2)] });
addWo({ id: "WO-2605", kind: "airframe", customer: "CUS-05", induction: "2026-10-20", tat: 28, float: 6, ld: 3_000, bom: [{ part: "FST-2110-010", qty: 2400, line: L.typhoon1 }, ...filler("consumable", 3), ...filler("seal", 1)] });
addWo({ id: "WO-2606", kind: "airframe", customer: "CUS-07", induction: "2026-10-18", tat: 24, float: 2, ld: 4_000, bom: [{ part: "FST-2110-020", qty: 3600, line: L.typhoon2 }, ...filler("consumable", 2), ...filler("fastener", 2)] });
addWo({ id: "WO-2607", kind: "nacelle", customer: "CUS-04", induction: "2026-10-12", tat: 30, float: 1, ld: 6_000, bom: [{ part: "NAC-7200-210", qty: 3, line: L.fra1 }, ...filler("nacelle", 2)] });
addWo({ id: "WO-2608", kind: "engine", customer: "CUS-01", induction: "2026-10-10", tat: 62, float: 4, ld: 9_000, bom: [{ part: "SEA-3100-510", qty: 400, line: L.seal1 }, ...filler("engine_lru", 3)] });
addWo({ id: "WO-2609", kind: "nacelle", customer: "CUS-03", induction: "2026-10-29", tat: 40, float: 10, ld: 12_000, bom: [{ part: "NAC-7500-310", qty: 2, line: L.arden1 }, ...filler("nacelle", 2)] });
addWo({ id: "WO-2610", kind: "nacelle", customer: "CUS-06", induction: "2026-10-27", tat: 30, float: 3, ld: 2_000, bom: [{ part: "NAC-7300-210", qty: 16, line: L.strike1 }, ...filler("fastener", 2)] });
addWo({ id: "WO-2611", kind: "engine", customer: "CUS-02", induction: "2026-11-12", tat: 68, float: 12, ld: 5_000, bom: [{ part: "ENG-4902-410", qty: 30, line: L.kemuning1 }, ...filler("engine_lru", 3)] });
addWo({ id: "WO-2612", kind: "component", customer: "CUS-08", induction: "2026-11-18", tat: 30, float: 30, ld: 1_000, bom: [{ part: "RAW-9100-050", qty: 40, line: L.ti1 }, ...filler("raw_alloy", 1)] });
addWo({ id: "WO-2613", kind: "airframe", customer: "CUS-05", induction: "2026-10-19", tat: 21, float: 5, ld: 3_000, bom: [{ part: "CON-8100-110", qty: 300, line: L.quake1 }, ...filler("consumable", 2)] });
addWo({ id: "WO-2614", kind: "airframe", customer: "CUS-07", induction: "2026-10-16", tat: 26, float: 3, ld: 4_000, bom: [{ part: "CON-8200-210", qty: 180, line: L.klang1 }, ...filler("seal", 2)] });
addWo({ id: "WO-2615", kind: "engine", customer: "CUS-06", induction: "2026-11-30", tat: 60, float: 14, ld: 0, bom: [{ part: "SEA-3100-510", qty: 120 }, ...filler("engine_lru", 3)] });
addWo({ id: "WO-2616", kind: "component", customer: "CUS-04", induction: "2026-11-16", tat: 28, float: 20, ld: 2_000, bom: [{ part: "RAW-9300-610", qty: 60, line: L.magnet1 }] });
addWo({ id: "WO-2617", kind: "engine", customer: "CUS-03", induction: "2026-10-26", tat: 66, float: 6, ld: 12_000, bom: [{ part: "CON-8400-310", qty: 45, line: L.harness1 }, ...filler("engine_lru", 2)] });
addWo({ id: "WO-2618", kind: "engine", customer: "CUS-01", induction: "2026-11-08", tat: 72, float: 16, ld: 9_000, bom: [{ part: "ENG-4810-310", qty: 36, line: L.lpt1 }, ...filler("engine_lru", 3)] });
addWo({ id: "WO-2619", kind: "engine", customer: "CUS-02", induction: "2026-11-03", tat: 70, float: 8, ld: 5_000, bom: [{ part: "ENG-6120-210", qty: 28, line: L.sensor1 }, ...filler("engine_lru", 2)] });
addWo({ id: "WO-2620", kind: "airframe", customer: "CUS-07", induction: "2026-10-19", tat: 24, float: 4, ld: 4_000, bom: [{ part: "FST-2120-030", qty: 12000, line: L.lib_shah }] });
addWo({ id: "WO-2621", kind: "nacelle", customer: "CUS-05", induction: "2026-10-21", tat: 30, float: 5, ld: 2_500, bom: [{ part: "NAC-7600-410", qty: 14, line: L.lib_cebu }] });
addWo({ id: "WO-2622", kind: "engine", customer: "CUS-04", induction: "2026-10-19", tat: 60, float: 1, ld: 6_000, bom: [{ part: "SEA-3100-520", qty: 40, line: L.lib_rtm }, ...filler("engine_lru", 2)] });
addWo({ id: "WO-2623", kind: "engine", customer: "CUS-01", induction: "2026-10-30", tat: 64, float: 22, ld: 9_000, bom: [{ part: "ENG-5600-710", qty: 12, line: L.fra3 }, ...filler("engine_lru", 2)] });
addWo({ id: "WO-2624", kind: "airframe", customer: "CUS-06", induction: "2026-10-14", tat: 18, float: 4, ld: 1_500, bom: [{ part: "CON-8300-410", qty: 220, line: L.fra2 }, ...filler("consumable", 2)] });

/* ================================================================== */
/* Shipments                                                           */
/* ================================================================== */

const shipments: Shipment[] = [];
let shpSeq = 880_410;
function addShipment(s: Omit<Shipment, "id">) {
  shpSeq += randInt(r, 3, 29);
  const sh: Shipment = { id: `SHP-${shpSeq}`, ...s };
  shipments.push(sh);
  return sh;
}

// FRA-SIN freighter rotation (Shipment stub)
addShipment({ po_line_ids: [L.fra1.id], carrier: "Nordvik Air Cargo", mode: "air", origin: "Stavanger", route_legs: [{ from: "SVG", to: "FRA", corridor: "SVG-FRA", mode: "road" }, { from: "FRA", to: "SIN", corridor: "FRA-SIN", mode: "air" }], eta: "2026-10-09", status: "in_transit", risk_flags: ["Time critical", "Oversize ULD"] });
addShipment({ po_line_ids: [L.fra2.id], carrier: "Nordvik Air Cargo", mode: "air", origin: "Neuss", route_legs: [{ from: "NSS", to: "FRA", corridor: "DUS-FRA", mode: "road" }, { from: "FRA", to: "SIN", corridor: "FRA-SIN", mode: "air" }], eta: "2026-10-10", status: "in_transit", risk_flags: ["DG class 9"] });
addShipment({ po_line_ids: [L.fra3.id], carrier: "Nordvik Air Cargo", mode: "air", origin: "Augsburg", route_legs: [{ from: "AGB", to: "FRA", corridor: "MUC-FRA", mode: "road" }, { from: "FRA", to: "SIN", corridor: "FRA-SIN", mode: "air" }], eta: "2026-10-11", status: "booked", risk_flags: [] });
// Port Klang congestion
addShipment({ po_line_ids: [L.klang1.id], carrier: "Selat Feeder Lines", mode: "sea", origin: "Klang", route_legs: [{ from: "PKG", to: "SIN", corridor: "PKG", mode: "sea" }], eta: "2026-10-12", status: "in_transit", risk_flags: [] });
// Rotterdam (library signal)
addShipment({ po_line_ids: [L.lib_rtm.id], carrier: "Lowlands Ocean Freight", mode: "sea", origin: "Rotterdam", route_legs: [{ from: "RTM", to: "SIN", corridor: "RTM", mode: "sea" }], eta: "2026-10-14", status: "in_transit", risk_flags: [] });

const SAFE_CORRIDOR: Record<string, { corridor: string; from: string; mode: "air" | "sea" | "road"; carrier: string }> = {
  US: { corridor: "CVG-SIN", from: "CVG", mode: "air", carrier: "Transpac Air Logistics" },
  FR: { corridor: "CDG-SIN", from: "CDG", mode: "air", carrier: "Gallic Air Freight" },
  DE: { corridor: "MUC-SIN", from: "MUC", mode: "air", carrier: "Alpen Cargo" },
  GB: { corridor: "LHR-SIN", from: "LHR", mode: "air", carrier: "Thames Air Freight" },
  JP: { corridor: "NRT-SIN", from: "NRT", mode: "air", carrier: "Kanto Air Express" },
  KR: { corridor: "ICN-SIN", from: "ICN", mode: "air", carrier: "Hangang Logistics" },
  TW: { corridor: "TPE-SIN", from: "TPE", mode: "air", carrier: "Formosa Air Cargo" },
  MY: { corridor: "JHB-SIN", from: "JHB", mode: "road", carrier: "Causeway Trucking" },
  TH: { corridor: "BKK-SIN", from: "BKK", mode: "road", carrier: "Isthmus Road Freight" },
  IN: { corridor: "MAA-SIN", from: "MAA", mode: "air", carrier: "Coromandel Air Cargo" },
  VN: { corridor: "HAN-SIN", from: "HAN", mode: "air", carrier: "Red River Air Freight" },
  PH: { corridor: "CEB-SIN", from: "CEB", mode: "air", carrier: "Visayas Air Cargo" },
  CN: { corridor: "PVG-SIN", from: "PVG", mode: "air", carrier: "Huangpu Air Cargo" },
  CZ: { corridor: "PRG-SIN", from: "PRG", mode: "air", carrier: "Vltava Air Freight" },
  SE: { corridor: "GOT-SIN", from: "GOT", mode: "air", carrier: "Kattegat Air Cargo" },
  NO: { corridor: "OSL-SIN", from: "OSL", mode: "air", carrier: "Nordvik Air Cargo" },
  NL: { corridor: "AMS-SIN", from: "AMS", mode: "air", carrier: "Lowlands Air Freight" },
  SG: { corridor: "SIN-local", from: "SIN", mode: "road", carrier: "Island Logistics" },
};

const scenarioLineIds = new Set(Object.values(L).map((l) => l.id));
const openBg = poLines.filter((l) => l.status !== "delivered" && !scenarioLineIds.has(l.id));
for (const line of shuffle(r, openBg)) {
  if (shipments.length >= 58) break;
  if (diffDays(TODAY, line.confirmed_date) > 30) continue;
  const s = supById.get(line.supplier_id)!;
  const c = SAFE_CORRIDOR[s.country_code];
  const eta = addDays(line.confirmed_date, randInt(r, 0, 4));
  addShipment({
    po_line_ids: [line.id],
    carrier: c.carrier,
    mode: c.mode,
    origin: s.city,
    route_legs: c.corridor === "SIN-local" ? [{ from: "SIN", to: "SG01", corridor: c.corridor, mode: "road" }] : [{ from: c.from, to: "SIN", corridor: c.corridor, mode: c.mode }],
    eta,
    status: diffDays(TODAY, eta) < 0 ? "delivered" : diffDays(TODAY, eta) < 6 ? "in_transit" : "booked",
    risk_flags: chance(r, 0.12) ? [pick(r, ["Customs hold risk", "Temperature controlled", "DG class 9", "Time critical"])] : [],
  });
}
if (shipments.length !== 58) throw new Error(`expected 58 shipments, got ${shipments.length}`);

/* ================================================================== */
/* Signals                                                             */
/* ================================================================== */

const T = (sgt: string) => new Date(Date.parse(`${sgt}:00+08:00`)).toISOString();

type SigSpec = Partial<Signal> & Pick<Signal, "id" | "received_at" | "channel" | "headline" | "raw_text" | "type" | "state" | "confidence" | "checkpoint">;

const scope = (s: Partial<Signal>) => ({
  affected_supplier_ids: s.affected_supplier_ids ?? [],
  affected_regions: s.affected_regions ?? [],
  affected_categories: s.affected_categories ?? [],
  affected_corridors: s.affected_corridors ?? [],
});

const PRIMARY: SigSpec[] = [
  {
    id: "SIG-0007",
    received_at: T("2026-10-07T06:52"),
    channel: "credit_monitor",
    headline: "Titanium forging supplier Aerotech Precision (Tier 2, sole source for 3 HPC blade retention rings) enters receivership",
    raw_text:
      "Credit alert, severity 1. Aerotech Precision Pte Ltd (registered Singapore, plant Batu Kawan, Penang) has had receivers and managers appointed by its secured lender effective 6 Oct 2026. The receivers have suspended outbound shipments pending an inventory count. The forging line restart is not expected before late November. Trade creditors are asked to direct correspondence to the receivers. Credit score moved from 29 to 18.",
    type: "supplier_distress",
    state: "operational",
    confidence: 0.91,
    affected_supplier_ids: [ID.aerotech],
    est_delay_days: 42,
    checkpoint: "purchasing",
  },
  {
    id: "SIG-0002",
    received_at: T("2026-10-02T08:15"),
    channel: "email",
    headline: "US nickel superalloy mill cuts Q4 allocation 40% to Brightwater Castings; NGV casting deliveries to slip",
    raw_text:
      "From Brightwater Castings commercial team: our nickel superalloy mill partner has notified a 40% reduction in Q4 melt allocation. We are prioritising contractual volumes by date of order. Your open orders for stage 1 and stage 2 HPT nozzle guide vane castings are expected to move by four to five weeks. We will confirm revised dates by 9 Oct.",
    type: "supply_shortage",
    state: "operational",
    confidence: 0.88,
    affected_supplier_ids: [ID.brightwater],
    est_delay_days: 30,
    checkpoint: "purchasing",
  },
  {
    id: "SIG-0003",
    received_at: T("2026-10-01T06:00"),
    channel: "news",
    headline: "US reclassifies EU-origin nacelle acoustic panels; 25% duty from 1 Nov",
    raw_text:
      "Trade press: the US customs authority has issued a binding reclassification moving composite acoustic panels of EU origin into a tariff line carrying 25% additional duty from 1 November 2026. The change affects goods routed through US bonded facilities and US-origin content rules for re-export. Brokers expect classification holds at entry while the new line beds in.",
    type: "tariff",
    state: "strategic",
    confidence: 0.84,
    affected_supplier_ids: [ID.rhone, ID.weser],
    est_delay_days: 3,
    checkpoint: "sourcing",
  },
  {
    id: "SIG-0012",
    received_at: T("2026-10-05T14:10"),
    channel: "news",
    headline: "Typhoon closes north Taiwan fastener plants for an estimated 10 days",
    raw_text:
      "Regional news: Typhoon landfall over Hsinchu and Taoyuan has triggered flooding in two industrial parks. Hsinchu Fastener Industrial reports water ingress in its heat-treat hall; Taoyuan Aero Fasteners has suspended operations as a precaution. Local officials estimate 10 days before power and road access are fully restored.",
    type: "natural_calamity",
    state: "operational",
    confidence: 0.86,
    affected_supplier_ids: [ID.hsinchu],
    affected_regions: ["TW-north"],
    affected_categories: ["fastener"],
    est_delay_days: 10,
    checkpoint: "purchasing",
  },
  {
    id: "SIG-0015",
    received_at: T("2026-10-06T11:20"),
    channel: "forwarder_edi",
    headline: "Carrier suspends Frankfurt to Singapore freighter rotation; three in-transit shipments affected",
    raw_text:
      "IFTSTA status update from Nordvik Air Cargo: freighter rotation FRA-SIN suspended from 6 Oct for aircraft maintenance. Shipments already tendered at FRA will be rebooked on the next available capacity, current estimate six days. Shippers may request reroute via alternative gateways at additional cost.",
    type: "route_disruption",
    state: "operational",
    confidence: 0.93,
    affected_corridors: ["FRA-SIN"],
    est_delay_days: 6,
    checkpoint: "shipment",
  },
  {
    id: "SIG-0005",
    received_at: T("2026-09-30T09:00"),
    channel: "email",
    headline: "Japan adds N2 speed sensor class to dual-use export list; Hokushin Sensor Works shipments need individual licences",
    raw_text:
      "From Hokushin Sensor Works export compliance: following the revision of the dual-use control list effective 1 Oct, our N2 speed sensor family now requires an individual export licence per consignment. Licence processing is currently 4 to 6 weeks. Shipments without a licence will be held at origin.",
    type: "export_control",
    state: "operational",
    confidence: 0.87,
    affected_supplier_ids: [ID.hokushin],
    est_delay_days: 30,
    checkpoint: "sourcing",
  },
  {
    id: "SIG-0019",
    received_at: T("2026-10-06T16:45"),
    channel: "sap",
    headline: "Receiving inspection rejects batch of 400 fuel nozzle O-ring seals from Daejeon Seal Technologies",
    raw_text:
      "SAP QM inspection lot 0400012877, usage decision R (reject). Material SEA-3100-510, batch DSL-26-0918, quantity 400. Defect code D14: durometer out of tolerance on 3 of 5 samples. Batch moved to blocked stock. Vendor notified via QM notification Q2 0010043.",
    type: "supply_shortage",
    state: "operational",
    confidence: 0.95,
    affected_supplier_ids: [ID.daejeon],
    est_delay_days: 14,
    checkpoint: "warehouse",
  },
  {
    id: "SIG-0024",
    received_at: T("2026-10-03T10:00"),
    channel: "sap",
    headline: "Strategic supplier Arden Nacelle Services: invoices ageing past 60 days, dispute count rising",
    raw_text:
      "SAP FI vendor ageing (FBL1N extract): Arden Nacelle Services Ltd, 7 invoices over 60 days totalling USD 412K, 4 open price disputes (up from 1 in June). Supplier account manager has flagged cash pressure and requested a payment plan. Supplier credit score down 24 points in 12 months.",
    type: "supplier_distress",
    state: "strategic",
    confidence: 0.82,
    affected_supplier_ids: [ID.arden],
    est_delay_days: 14,
    checkpoint: "relationships",
  },
  {
    id: "SIG-0008",
    received_at: T("2026-09-29T08:00"),
    channel: "news",
    headline: "Rolling strikes at Blagnac aerostructures plants hit Garonne Aerostructures output",
    raw_text:
      "Regional press: unions at three aerostructures sites near Blagnac have called rolling 48 hour strikes through October over wage indexation. Garonne Aerostructures confirms reduced output on machined nacelle brackets and hinge fittings and is rescheduling customer deliveries.",
    type: "conflict_unrest",
    state: "operational",
    confidence: 0.8,
    affected_supplier_ids: [ID.garonne],
    est_delay_days: 12,
    checkpoint: "purchasing",
  },
  {
    id: "SIG-0009",
    received_at: T("2026-09-27T10:30"),
    channel: "credit_monitor",
    headline: "Kemuning Machining credit rating cut two notches; covenant breach reported",
    raw_text:
      "Credit alert, severity 2. Kemuning Machining Sdn Bhd (Johor Bahru) rating moved from BB to B. Lender reports covenant breach on its working capital facility; waiver under negotiation. Days payable outstanding to its own suppliers rose from 48 to 81.",
    type: "supplier_distress",
    state: "strategic",
    confidence: 0.78,
    affected_supplier_ids: [ID.kemuning],
    est_delay_days: 21,
    checkpoint: "sourcing",
  },
  {
    id: "SIG-0010",
    received_at: T("2026-09-25T11:00"),
    channel: "sphera",
    headline: "Titanium sponge shortage: Sendai Titanium Bar moves Ti-6Al-4V bar to allocation",
    raw_text:
      "Sphera supplier risk event: Sendai Titanium Bar Co has placed Ti-6Al-4V bar on customer allocation through Q1 2027 citing sponge supply constraints. Lead times quoted at 155 days, up from 120.",
    type: "supply_shortage",
    state: "strategic",
    confidence: 0.83,
    affected_supplier_ids: [ID.sendai],
    affected_regions: ["JP-tohoku"],
    affected_categories: ["raw_alloy"],
    est_delay_days: 35,
    checkpoint: "sourcing",
  },
  {
    id: "SIG-0011",
    received_at: T("2026-09-26T03:20"),
    channel: "news",
    headline: "M6.1 earthquake near Sakai; Kansai industrial suppliers pause for inspections",
    raw_text:
      "A magnitude 6.1 earthquake struck near Sakai early this morning. Several industrial suppliers in the Kansai region have paused operations for structural inspections, expected to take up to five days.",
    type: "natural_calamity",
    state: "operational",
    confidence: 0.76,
    affected_regions: ["JP-kansai"],
    est_delay_days: 5,
    checkpoint: "purchasing",
  },
  {
    id: "SIG-0013",
    received_at: T("2026-10-02T09:40"),
    channel: "forwarder_edi",
    headline: "Port Klang berth congestion adds 9 days to feeder sailings to Singapore",
    raw_text:
      "IFTSTA status update from Selat Feeder Lines: berth congestion at Port Klang Westport. Vessel waiting time currently 7 to 9 days. Feeder sailings to Singapore delayed accordingly.",
    type: "route_disruption",
    state: "operational",
    confidence: 0.9,
    affected_corridors: ["PKG"],
    est_delay_days: 9,
    checkpoint: "shipment",
  },
  {
    id: "SIG-0014",
    received_at: T("2026-09-24T13:00"),
    channel: "news",
    headline: "China tightens export licensing on samarium-cobalt magnets",
    raw_text:
      "Trade press: new export licensing requirements apply to samarium-cobalt permanent magnets from 1 Oct. Exporters report licence lead times of 30 to 45 days for aerospace end users.",
    type: "export_control",
    state: "strategic",
    confidence: 0.81,
    affected_supplier_ids: [ID.suzhou],
    est_delay_days: 30,
    checkpoint: "sourcing",
  },
  {
    id: "SIG-0016",
    received_at: T("2026-09-28T07:45"),
    channel: "news",
    headline: "Respiratory outbreak prompts 3 week closure order for Haiphong industrial zone",
    raw_text:
      "Local health authority orders a three week closure of an industrial zone in Haiphong after a cluster of respiratory infections. Manufacturers in the zone, including wire harness producers, have suspended production.",
    type: "pandemic_health",
    state: "operational",
    confidence: 0.79,
    affected_regions: ["VN-north"],
    est_delay_days: 18,
    checkpoint: "purchasing",
  },
  {
    id: "SIG-0017",
    received_at: T("2026-09-30T11:00"),
    channel: "email",
    headline: "Lindqvist Rotating Parts announces 6 week vacuum furnace rebuild; LPT seal ring output cut",
    raw_text:
      "From Lindqvist Rotating Parts: an unplanned rebuild of vacuum furnace 3 will take approximately six weeks. LPT seal ring segment output will run at 40% until completion. Open orders will be re-confirmed this week.",
    type: "supply_shortage",
    state: "operational",
    confidence: 0.89,
    affected_supplier_ids: [ID.lindqvist],
    est_delay_days: 42,
    checkpoint: "purchasing",
  },
];

const DISCARDED: SigSpec[] = [
  { id: "SIG-0021", received_at: T("2026-10-05T09:00"), channel: "forwarder_edi", headline: "Red Sea routing notice: carriers extend Cape of Good Hope diversions for Asia to Europe sailings", raw_text: "Ocean carrier advisory: Red Sea transits remain suspended. Asia to Europe services continue to route via the Cape of Good Hope, adding 10 to 14 days.", type: "route_disruption", state: "operational", confidence: 0.92, affected_corridors: ["RED-SEA"], checkpoint: "shipment" },
  { id: "SIG-0022", received_at: T("2026-10-06T07:30"), channel: "news", headline: "Dockworkers strike halts container handling at Santos, Brazil", raw_text: "Port workers at Santos have begun an indefinite strike. Container handling is suspended.", type: "conflict_unrest", state: "operational", confidence: 0.88, affected_regions: ["BR-sp"], affected_corridors: ["SANTOS"], checkpoint: "shipment" },
  { id: "SIG-0023", received_at: T("2026-10-04T21:00"), channel: "news", headline: "Armed clashes reported near border crossings in the Sahel", raw_text: "Reports of armed clashes near several border crossings in the Sahel region. Road freight is suspended locally.", type: "conflict_unrest", state: "strategic", confidence: 0.7, affected_regions: ["SAHEL"], checkpoint: "sourcing" },
  { id: "SIG-0025", received_at: T("2026-09-27T16:00"), channel: "news", headline: "Bushfire closes industrial estate south of Perth", raw_text: "Emergency services have closed an industrial estate south of Perth as a bushfire approaches.", type: "natural_calamity", state: "operational", confidence: 0.74, affected_regions: ["AU-wa"], checkpoint: "purchasing" },
  { id: "SIG-0026", received_at: T("2026-09-29T12:00"), channel: "news", headline: "Duty increase announced on Canadian softwood lumber imports", raw_text: "Trade press: additional duties on Canadian softwood lumber take effect next month.", type: "tariff", state: "strategic", confidence: 0.9, affected_regions: ["CA-bc"], checkpoint: "sourcing" },
  { id: "SIG-0027", received_at: T("2026-09-30T20:00"), channel: "news", headline: "Protests in Lima disrupt road access to the airport", raw_text: "Protesters have blocked several roads leading to Lima airport.", type: "conflict_unrest", state: "operational", confidence: 0.72, affected_regions: ["PE-lima"], checkpoint: "shipment" },
  { id: "SIG-0028", received_at: T("2026-10-01T15:30"), channel: "forwarder_edi", headline: "Panama Canal draft restrictions extended for neopanamax vessels", raw_text: "Canal authority extends draft restrictions. Some transpacific to US east coast services may reroute.", type: "route_disruption", state: "strategic", confidence: 0.85, affected_corridors: ["PANAMA"], checkpoint: "shipment" },
  { id: "SIG-0029", received_at: T("2026-10-02T13:10"), channel: "sphera", headline: "Measles outbreak advisory issued for Lagos state", raw_text: "Health advisory for Lagos state following a measles outbreak. No movement restrictions announced.", type: "pandemic_health", state: "strategic", confidence: 0.68, affected_regions: ["NG-lagos"], checkpoint: "sourcing" },
];

const MERGED: (Pick<Signal, "id" | "received_at" | "channel" | "headline"> & { parent: string; snippet: string })[] = [
  { id: "SIG-0031", parent: "SIG-0007", received_at: T("2026-10-07T07:40"), channel: "news", headline: "Penang forging shop placed under receivership; 140 jobs at risk", snippet: "Receivers appointed for Aerotech Precision; outbound shipments suspended pending inventory count." },
  { id: "SIG-0032", parent: "SIG-0007", received_at: T("2026-10-07T08:05"), channel: "email", headline: "Notice to trade creditors: Aerotech Precision Pte Ltd (in receivership)", snippet: "Receivers ask customers to confirm open orders and in-process WIP by 10 Oct; release of finished goods subject to settlement of outstanding invoices." },
  { id: "SIG-0033", parent: "SIG-0007", received_at: T("2026-10-07T08:21"), channel: "sap", headline: "Vendor master 100118: central posting block set", snippet: "LFA1 change log: SPERR set by FI master data at 08:21. Open items: 3 POs, USD 1.40M." },
  { id: "SIG-0034", parent: "SIG-0012", received_at: T("2026-10-05T18:30"), channel: "forwarder_edi", headline: "TPE departures cancelled for 48 hours", snippet: "Formosa Air Cargo cancels TPE departures for 48 hours; cargo acceptance closed." },
  { id: "SIG-0035", parent: "SIG-0012", received_at: T("2026-10-06T09:15"), channel: "email", headline: "Hsinchu Fastener: force majeure notice", snippet: "Hsinchu Fastener declares force majeure on deliveries due 6 Oct to 20 Oct; heat-treat hall restart under assessment." },
  { id: "SIG-0036", parent: "SIG-0015", received_at: T("2026-10-06T13:05"), channel: "email", headline: "Nordvik Air Cargo: rebooking options for FRA tendered cargo", snippet: "Options offered: wait for next rotation (about 6 days), truck to AMS and fly AMS-SIN (+USD 4.8K, 2 days), or split via DOH." },
  { id: "SIG-0037", parent: "SIG-0019", received_at: T("2026-10-06T17:30"), channel: "email", headline: "Receiving inspection: seal batch DSL-26-0918 rejected", snippet: "Durometer out of tolerance on 3 of 5 samples. WO-2608 kit short 400 seals; induction 10 Oct." },
  { id: "SIG-0038", parent: "SIG-0002", received_at: T("2026-10-02T12:00"), channel: "sphera", headline: "Supplier risk event: nickel melt allocation cut at US mill", snippet: "Sphera event: Q4 melt allocation reduced 40% for downstream casting customers." },
  { id: "SIG-0039", parent: "SIG-0002", received_at: T("2026-10-03T07:30"), channel: "news", headline: "Superalloy mill outage tightens nickel casting supply", snippet: "Trade press: vacuum melt outage at a US mill tightens Q4 superalloy supply." },
  { id: "SIG-0040", parent: "SIG-0003", received_at: T("2026-10-01T14:00"), channel: "email", headline: "Customs broker advisory: EU acoustic panel reclassification", snippet: "Broker expects classification holds of 2 to 4 days at entry while the new tariff line beds in." },
  { id: "SIG-0001", parent: "SIG-0003", received_at: T("2026-10-02T10:00"), channel: "sphera", headline: "Trade compliance event: tariff line change for composite panels", snippet: "Sphera trade event: 25% additional duty on EU-origin composite acoustic panels from 1 Nov." },
  { id: "SIG-0004", parent: "SIG-0005", received_at: T("2026-09-30T17:00"), channel: "news", headline: "Japan revises dual-use control list", snippet: "Revised list adds certain speed sensor classes; individual licences required." },
  { id: "SIG-0006", parent: "SIG-0008", received_at: T("2026-09-29T15:00"), channel: "email", headline: "Garonne Aerostructures: delivery reschedule notice", snippet: "Garonne reschedules October deliveries of TR brackets and hinge fittings by up to two weeks." },
  { id: "SIG-0018", parent: "SIG-0013", received_at: T("2026-10-02T16:00"), channel: "news", headline: "Port Klang congestion worsens as transshipment volumes surge", snippet: "Westport berth waiting times reach 9 days." },
  { id: "SIG-0020", parent: "SIG-0024", received_at: T("2026-10-03T15:20"), channel: "email", headline: "Arden Nacelle Services: request for payment plan", snippet: "Arden account manager requests a payment plan for invoices over 60 days and flags possible shipment holds." },
  { id: "SIG-0030", parent: "SIG-0009", received_at: T("2026-09-28T09:00"), channel: "sphera", headline: "Supplier risk event: Kemuning Machining financial score drop", snippet: "Sphera financial health score down 21 points in 90 days." },
];

const LIBRARY: SigSpec[] = [
  { id: "LIB-01", received_at: CLOCK, channel: "email", headline: "Fire at Shah Alam Fasteners heat-treat line; deliveries suspended 2 weeks", raw_text: "From Shah Alam Fasteners: a fire in our heat-treat line overnight has suspended production. We expect two weeks before deliveries resume.", type: "supply_shortage", state: "operational", confidence: 0.9, affected_supplier_ids: [ID.shahalam], est_delay_days: 14, checkpoint: "purchasing" },
  { id: "LIB-02", received_at: CLOCK, channel: "news", headline: "Cyclone warning for Cebu; Mactan economic zone to close for 7 days", raw_text: "Weather authority raises cyclone warning signal 3 for Cebu. Mactan economic zone operators to close for an estimated 7 days.", type: "natural_calamity", state: "operational", confidence: 0.85, affected_regions: ["PH-visayas"], est_delay_days: 7, checkpoint: "purchasing" },
  { id: "LIB-03", received_at: CLOCK, channel: "forwarder_edi", headline: "Strike at Rotterdam container terminals delays outbound sailings 8 days", raw_text: "Lowlands Ocean Freight: terminal strike at Rotterdam. Outbound sailings delayed by an estimated 8 days.", type: "route_disruption", state: "operational", confidence: 0.88, affected_corridors: ["RTM"], est_delay_days: 8, checkpoint: "shipment" },
  { id: "LIB-04", received_at: CLOCK, channel: "news", headline: "Flooding in Piedmont industrial zone halts production", raw_text: "Flooding has halted production across an industrial zone in Piedmont.", type: "natural_calamity", state: "operational", confidence: 0.8, affected_regions: ["IT-piedmont"], checkpoint: "purchasing" },
  { id: "LIB-05", received_at: CLOCK, channel: "news", headline: "Hamburg port workers announce 24 hour warning strike", raw_text: "Port workers in Hamburg announce a 24 hour warning strike.", type: "conflict_unrest", state: "operational", confidence: 0.83, affected_corridors: ["HAM"], checkpoint: "shipment" },
  { id: "LIB-06", received_at: CLOCK, channel: "sphera", headline: "Indonesia bans export of unprocessed nickel ore from Sulawesi", raw_text: "Trade event: Indonesia extends its ban on exports of unprocessed nickel ore from Sulawesi.", type: "export_control", state: "strategic", confidence: 0.86, affected_regions: ["ID-sulawesi"], checkpoint: "sourcing" },
];

const world = { suppliers, parts, poLines, workOrders, shipments, customers };

// Background work orders: 36 total, linked only to lines outside every material exposure so scenario numbers stay designed.
const exposedAnywhere = new Set<string>();
for (const s of [...PRIMARY, ...LIBRARY]) for (const id of computeExposure(scope(s), world).poLineIds) exposedAnywhere.add(id);
const linkable = shuffle(
  r,
  poLines.filter((l) => l.status !== "delivered" && !exposedAnywhere.has(l.id) && !scenarioLineIds.has(l.id)),
);
let woSeq = 2630;
while (workOrders.length < 36) {
  const kind = pick(r, ["engine", "engine", "airframe", "component", "nacelle"] as const);
  const induction = addDays(TODAY, randInt(r, -20, 80));
  const links = linkable.splice(0, randInt(r, 1, 3));
  addWo({
    id: `WO-${woSeq}`,
    kind,
    customer: pick(r, customers).id,
    induction,
    tat: kind === "engine" ? randInt(r, 55, 80) : randInt(r, 18, 40),
    float: randInt(r, 4, 30),
    ld: pick(r, [0, 1_500, 2_500, 4_000, 6_000]),
    bom: [...links.map((l) => ({ part: l.part_id, qty: l.qty, line: l })), ...filler(kind === "engine" ? "engine_lru" : "consumable", randInt(r, 1, 3))],
  });
  woSeq += randInt(r, 1, 6);
}

function finishSignal(s: SigSpec, disposition: Signal["disposition"]): Signal {
  const sc = scope(s);
  const exp = computeExposure(sc, world);
  if (disposition === "material" && !exp.material) throw new Error(`${s.id} expected material`);
  if (disposition === "discarded" && exp.material) throw new Error(`${s.id} expected no exposure`);
  return Signal.parse({
    ...sc,
    parent_id: null,
    est_delay_days: 0,
    evidence: [],
    library: false,
    ...s,
    disposition,
    material: exp.material,
    affected_po_line_ids: exp.poLineIds,
    affected_part_ids: exp.partIds,
    discard_reason: exp.discardReason,
  });
}

const signals: Signal[] = [
  ...PRIMARY.map((s) => finishSignal(s, "material")),
  ...DISCARDED.map((s) => finishSignal(s, "discarded")),
];
for (const m of MERGED) {
  const parent = signals.find((s) => s.id === m.parent)!;
  parent.evidence.push({ channel: m.channel, received_at: m.received_at, snippet: m.snippet });
  signals.push(
    Signal.parse({
      ...parent,
      id: m.id,
      received_at: m.received_at,
      channel: m.channel,
      headline: m.headline,
      raw_text: m.snippet,
      disposition: "merged",
      material: false,
      parent_id: m.parent,
      evidence: [],
      confidence: Math.max(0.6, parent.confidence - 0.05),
    }),
  );
}
for (const s of signals.filter((x) => x.disposition === "material")) {
  s.evidence.unshift({ channel: s.channel, received_at: s.received_at, snippet: s.raw_text.split(". ").slice(0, 2).join(". ").replace(/\.?$/, ".") });
  s.evidence.sort((a, b) => a.received_at.localeCompare(b.received_at));
}
signals.sort((a, b) => b.received_at.localeCompare(a.received_at));
const library: Signal[] = LIBRARY.map((s) => finishSignal({ ...s, library: true }, computeExposure(scope(s), world).material ? "material" : "discarded"));

/* ================================================================== */
/* Inventory (WMS)                                                     */
/* ================================================================== */

const inventory: InventoryRow[] = [];
let invSeq = 1;
const LOCS = ["SG01-A-03", "SG01-B-11", "SG02-C-07", "SG01-K-02", "SG02-A-14", "SG01-D-09"];
const skip = new Set(shuffle(r, parts.filter((p) => p.criticality === "C" && p.id !== "SEA-3100-510")).slice(0, 1).map((p) => p.id));
for (const p of parts) {
  if (skip.has(p.id)) continue;
  if (p.id === "SEA-3100-510") {
    inventory.push({ id: `INV-${String(invSeq++).padStart(4, "0")}`, part_id: p.id, location: "SG01-QM-BLK", on_hand: 400, allocated: 0, free: 0, batch: "DSL-26-0918", inspection_status: "rejected", allocated_to_wo: null });
    inventory.push({ id: `INV-${String(invSeq++).padStart(4, "0")}`, part_id: p.id, location: "SG01-K-02", on_hand: 160, allocated: 120, free: 40, batch: "DSL-26-0811", inspection_status: "released", allocated_to_wo: "WO-2615" });
    continue;
  }
  const [q0, q1] = QTY[p.category];
  const onHand = chance(r, 0.15) ? 0 : randInt(r, 0, Math.max(2, Math.round(q1 / 3)));
  const allocated = Math.min(onHand, randInt(r, 0, onHand));
  inventory.push({
    id: `INV-${String(invSeq++).padStart(4, "0")}`,
    part_id: p.id,
    location: pick(r, LOCS),
    on_hand: onHand,
    allocated,
    free: onHand - allocated,
    batch: `${p.approved_sources[0].supplier_id.slice(-3)}-${randInt(r, 24, 26)}-${String(randInt(r, 1, 999)).padStart(4, "0")}`,
    inspection_status: chance(r, 0.04) ? "quarantine" : "released",
    allocated_to_wo: allocated > 0 && chance(r, 0.4) ? pick(r, workOrders).id : null,
  });
  void q0;
}
// Broker stock and dormant second-source context for the Aerotech rings
for (const id of ["ENG-4471-120", "ENG-4471-130", "ENG-4471-140"]) {
  const row = inventory.find((x) => x.part_id === id)!;
  Object.assign(row, { on_hand: 0, allocated: 0, free: 0, inspection_status: "released" });
}
// The extra seal row replaces one skipped C part, so total rows equal the part count.

/* ================================================================== */
/* Precedents                                                          */
/* ================================================================== */

const precedents: Precedent[] = [
  { id: "PRE-01", year: 2022, title: "Frankfurt hub capacity crunch", signal_type: "route_disruption", supplier_ids: [ID.weser, ID.rheinland], summary: "Freighter capacity out of FRA collapsed for three weeks during a peak season crunch. Six nacelle and chemical shipments were stuck at the gateway.", options_considered: ["Wait for capacity", "Truck to AMS and fly", "Charter part ULD"], option_taken: "Truck to AMS and fly", cost_usd: 21_400, delay_days: 2, outcome: "All six shipments landed within 2 days of plan; no induction moved.", lesson: "Pre-agree an AMS gateway fallback rate with the forwarder so the reroute is a one-click booking." },
  { id: "PRE-02", year: 2023, title: "Johor machine shop administration", signal_type: "supplier_distress", supplier_ids: [ID.kemuning], summary: "A Tier 2 machine shop in Johor entered administration with 22 open lines of brackets and housings.", options_considered: ["Pay administrator for WIP", "Resource to India", "Resource to Czechia"], option_taken: "Resource to India", cost_usd: 64_000, delay_days: 9, outcome: "Lines resourced to Bengaluru within 6 weeks; two inductions absorbed the slip in float.", lesson: "Machined brackets requalify in 6 weeks; start the first-article inspection the day the credit alert lands." },
  { id: "PRE-03", year: 2023, title: "Sole-source forging shop insolvency", signal_type: "supplier_distress", supplier_ids: [ID.meridian, ID.pacific], summary: "A sole-source ring forging supplier went into liquidation with three open POs. The approved but dormant second source was reactivated and broker stock covered the first induction.", options_considered: ["Reactivate dormant second source with air expedite", "Broker buy", "PMA alternate", "Re-sequence inductions"], option_taken: "Reactivate dormant second source with air expedite, broker stock for the first induction", cost_usd: 296_000, delay_days: 4, outcome: "First induction held; second moved 4 days inside float. No LDs paid.", lesson: "Split the first wave 70/30 between the second source and broker stock; the second source cannot ramp to 100% inside four weeks." },
  { id: "PRE-04", year: 2024, title: "Paid receiver for in-process WIP", signal_type: "supplier_distress", supplier_ids: [], summary: "A receiver held finished and in-process forgings until outstanding invoices were settled.", options_considered: ["Pay receiver for WIP", "Litigate for title", "Resource"], option_taken: "Pay receiver for WIP", cost_usd: 410_000, delay_days: 18, outcome: "Parts released after 18 days, of which 11 went to conformity re-inspection. Two lots failed paperwork review.", lesson: "WIP from a receiver needs full airworthiness traceability review; budget 10 days and expect partial loss." },
  { id: "PRE-05", year: 2024, title: "Nickel alloy allocation", signal_type: "supply_shortage", supplier_ids: [ID.brightwater, ID.takamori], summary: "A US mill cut nickel superalloy allocation by 35% for Q3. Casting houses re-sequenced orders by contractual priority.", options_considered: ["Accept slip", "Split to second casting source", "Pull forward from Q4 allocation"], option_taken: "Split 60/40 to Takamori Precision Castings with a price premium", cost_usd: 118_000, delay_days: 6, outcome: "Engine inductions held; premium of 8% on the split share. Brightwater restored volume in Q4.", lesson: "Lock second-source casting slots in the same week the allocation notice lands; slots sell out within 10 days." },
  { id: "PRE-06", year: 2024, title: "Typhoon closes north Taiwan fastener plants", signal_type: "natural_calamity", supplier_ids: [ID.hsinchu, ID.kingsbury], summary: "A typhoon closed two fastener plants for 8 days. Airframe checks needed pins and collars within a week.", options_considered: ["Wait for restart", "Pull forward from US distributor stock", "Reallocate from later checks"], option_taken: "Pull forward from US distributor stock", cost_usd: 38_500, delay_days: 1, outcome: "Two heavy checks held their slots; premium of 35% on 6,000 fasteners.", lesson: "Keep a standing price agreement with the US fastener source for emergency volume." },
  { id: "PRE-07", year: 2025, title: "Tariff on EU aerostructures", signal_type: "tariff", supplier_ids: [ID.rhone, ID.prairie], summary: "A tariff change on EU aerostructures routed via US facilities raised landed cost on panels.", options_considered: ["Absorb duty", "Route direct EU to SIN", "Shift to US source", "Pull forward shipments before effective date"], option_taken: "Pull forward shipments before effective date and route direct EU to SIN", cost_usd: 46_000, delay_days: 0, outcome: "Duty avoided on 80% of affected volume; the rest moved to direct routing.", lesson: "Check routing first: most exposure came from US bonded transit, not origin." },
  { id: "PRE-08", year: 2025, title: "Licence delay on dual-use sensors", signal_type: "export_control", supplier_ids: [ID.hokushin, ID.seletar], summary: "Export licence processing for a sensor family stretched to five weeks.", options_considered: ["Wait for licence", "Buy from Singapore distributor stock", "Borrow from customer pool"], option_taken: "Buy from Singapore distributor stock", cost_usd: 52_000, delay_days: 3, outcome: "Distributor stock covered two engines; licences arrived in week five.", lesson: "File licences per quarter in bulk rather than per consignment." },
  { id: "PRE-09", year: 2024, title: "Seal batch rejected at receiving", signal_type: "supply_shortage", supplier_ids: [ID.daejeon, ID.ohio], summary: "A batch of O-ring seals failed durometer checks at receiving, short-shipping an engine kit.", options_considered: ["Wait for replacement batch", "Reallocate from later work order", "Air freight from US source"], option_taken: "Reallocate from later work order and backfill from US source", cost_usd: 9_800, delay_days: 0, outcome: "Induction held. Later work order backfilled two weeks before need.", lesson: "Reallocation is the fastest lever when a later work order holds released stock of the same batch family." },
  { id: "PRE-10", year: 2025, title: "Port Klang congestion", signal_type: "route_disruption", supplier_ids: [ID.klang, ID.jurong], summary: "Berth waiting times at Port Klang reached 10 days for feeder sailings.", options_considered: ["Wait", "Truck via Johor causeway", "Buy locally in Singapore"], option_taken: "Truck via Johor causeway", cost_usd: 6_200, delay_days: 1, outcome: "Consumables landed in 2 days by road.", lesson: "Road via the causeway beats feeder sailings whenever berth waits pass 4 days." },
  { id: "PRE-11", year: 2022, title: "Harness plant closure", signal_type: "pandemic_health", supplier_ids: [ID.haiphong, ID.seletar], summary: "A health closure order shut a harness plant for four weeks.", options_considered: ["Wait", "Distributor buy", "Repair and reuse serviceable leads"], option_taken: "Distributor buy for the first two engines, repair for the rest", cost_usd: 31_000, delay_days: 2, outcome: "Engines redelivered on time; repair yield 70%.", lesson: "Repair and reuse is viable for ignition leads within the CMM limits; ask the shop early." },
  { id: "PRE-12", year: 2025, title: "Early payment for discount with a strategic repair vendor", signal_type: "supplier_distress", supplier_ids: [ID.arden], summary: "A strategic nacelle repair vendor under cash pressure threatened to hold shipments over disputed invoices.", options_considered: ["Hold position on disputes", "Pay undisputed items early for discount", "Supply chain finance"], option_taken: "Pay undisputed items early for a 2% discount and settle disputes within 30 days", cost_usd: -8_200, delay_days: 0, outcome: "Shipments continued; discount offset part of the dispute concessions.", lesson: "Separate undisputed from disputed items; paying the clean ones fast buys goodwill at a profit." },
];

/* ================================================================== */
/* Diversification recommendations and sourcing calls (prebuilt)       */
/* ================================================================== */

const diversification: DiversificationRec[] = [
  { id: "DIV-01", category: "engine_lru", part_id: "ENG-4471-120", current_supplier_id: ID.aerotech, candidate_supplier_ids: [ID.meridian, ID.valcourt], qualification_effort: "medium", qualification_weeks: 10, cost_delta_pct: 8, rationale: "All three HPC retention rings sit with one Tier 2 shop now in receivership. Meridian is already approved and only needs a contract; Valcourt PMA needs customer acceptance on two fleets." },
  { id: "DIV-02", category: "engine_lru", part_id: "ENG-4902-410", current_supplier_id: ID.kemuning, candidate_supplier_ids: [ID.bengaluru, ID.ostrava], qualification_effort: "low", qualification_weeks: 6, cost_delta_pct: 4, rationale: "Kemuning financial health fell 24 points in a year and its lender reports a covenant breach. Both candidates already hold approvals on this bracket family." },
  { id: "DIV-03", category: "engine_lru", part_id: "ENG-6120-210", current_supplier_id: ID.hokushin, candidate_supplier_ids: [ID.seletar], qualification_effort: "high", qualification_weeks: 26, cost_delta_pct: 15, rationale: "The N2 speed sensor is sole source and now under individual export licensing. A Singapore distributor holds licensed stock as a bridge while an alternate part number is qualified." },
  { id: "DIV-04", category: "engine_lru", part_id: "ENG-4810-310", current_supplier_id: ID.lindqvist, candidate_supplier_ids: [ID.takamori, ID.cascadia], qualification_effort: "medium", qualification_weeks: 12, cost_delta_pct: 6, rationale: "LPT seal ring output is at 40% for six weeks. Takamori is approved but carries no open volume; a standing 20% share would have absorbed this outage." },
  { id: "DIV-05", category: "nacelle", part_id: "NAC-7100-110", current_supplier_id: ID.rhone, candidate_supplier_ids: [ID.prairie], qualification_effort: "medium", qualification_weeks: 14, cost_delta_pct: 9.5, rationale: "EU-origin acoustic panels face a 25% duty on US-routed flows from 1 Nov. A US source removes the exposure for US-bound work." },
  { id: "DIV-06", category: "nacelle", part_id: "NAC-7500-310", current_supplier_id: ID.arden, candidate_supplier_ids: [ID.prairie], qualification_effort: "high", qualification_weeks: 20, cost_delta_pct: 11, rationale: "Translating sleeve repair is sole source with a strategic supplier under cash pressure. A second repair station protects the nacelle line." },
  { id: "DIV-07", category: "fastener", part_id: "FST-2110-010", current_supplier_id: ID.hsinchu, candidate_supplier_ids: [ID.kingsbury, ID.chita], qualification_effort: "low", qualification_weeks: 4, cost_delta_pct: 22, rationale: "Both north Taiwan fastener plants share one flood plain. A standing 25% share outside the region removes the single point of failure." },
  { id: "DIV-08", category: "raw_alloy", part_id: "RAW-9300-610", current_supplier_id: ID.suzhou, candidate_supplier_ids: [ID.plzen], qualification_effort: "high", qualification_weeks: 24, cost_delta_pct: 18, rationale: "SmCo magnets are sole source and now under export licensing. A European distributor holds licensed stock as a bridge." },
  { id: "DIV-09", category: "seal", part_id: "SEA-3100-510", current_supplier_id: ID.daejeon, candidate_supplier_ids: [ID.ohio], qualification_effort: "low", qualification_weeks: 3, cost_delta_pct: 32, rationale: "Daejeon NCRs are up to 7 in 12 months and a 400 piece batch failed receiving. Ohio Valley is approved and can hold a 20% share." },
];

const openLines = poLines.filter((l) => l.status !== "delivered");
const lateLines = [...openLines].filter((l) => l.backlog_days > 0 && !scenarioLineIds.has(l.id)).sort((a, b) => b.backlog_days * b.unit_price * b.qty - a.backlog_days * a.unit_price * a.qty);
const callFor = (l: POLine, action: SourcingCall["action"], why: string): SourcingCall => ({
  id: `SC-${String(sourcingCalls.length + 1).padStart(2, "0")}`,
  po_line_id: l.id,
  risk: `${supById.get(l.supplier_id)!.name} confirms ${l.backlog_days}d after need date`,
  action,
  rationale: why,
  lead_time_risk_days: l.backlog_days,
});
const sourcingCalls: SourcingCall[] = [];
sourcingCalls.push({ id: "SC-01", po_line_id: L.aero2.id, risk: "Supplier in receivership; shipments suspended", action: "split", rationale: "Split 70/30 between Meridian (approved second source) and Pacific Aero Spares broker stock to protect the 28 Oct induction.", lead_time_risk_days: 34 });
sourcingCalls.push({ id: "SC-02", po_line_id: L.lpt1.id, risk: "Furnace rebuild cuts output to 40% for six weeks", action: "split", rationale: "Move 40% to Takamori, which is approved and quotes 84 days; the remaining 60% fits Lindqvist's reduced output.", lead_time_risk_days: 28 });
sourcingCalls.push({ id: "SC-03", po_line_id: L.typhoon1.id, risk: "Force majeure on deliveries to 20 Oct", action: "pull_forward", rationale: "Pull 2,400 pins forward from Kingsbury distributor stock; the premium is small against a heavy check slot.", lead_time_risk_days: 4 });
sourcingCalls.push({ id: "SC-04", po_line_id: L.fra1.id, risk: "FRA-SIN freighter rotation suspended", action: "expedite", rationale: "Reroute by truck to AMS and fly AMS-SIN; lands 4 days earlier than waiting for the rotation.", lead_time_risk_days: 3 });
const actions: SourcingCall["action"][] = ["split", "expedite", "split", "pull_forward", "hold", "expedite"];
for (const l of lateLines.slice(0, 6)) {
  const a = actions[sourcingCalls.length % actions.length];
  const s = supById.get(l.supplier_id)!;
  const alt = partById.get(l.part_id)!.approved_sources.find((x) => x.supplier_id !== l.supplier_id);
  const why =
    a === "split" && alt
      ? `Backlog at ${s.name} is chronic. Split 30% to ${supById.get(alt.supplier_id)!.name}, which quotes ${alt.lead_time_days} days.`
      : a === "hold"
        ? `Need date has float in the work plan; hold and re-confirm in 7 days rather than pay expedite.`
        : a === "pull_forward"
          ? `Pull forward from free stock and reorder; the line is a recurring short.`
          : `Ask ${s.name} for a partial air shipment of the first 50% to cover the nearest requirement.`;
  sourcingCalls.push(callFor(l, alt || a !== "split" ? a : "expedite", why));
}

/* ================================================================== */
/* Validation and checks                                               */
/* ================================================================== */

z.array(Supplier).parse(suppliers);
z.array(Part).parse(parts);
z.array(PurchaseOrder).parse(pos);
z.array(WorkOrder).parse(workOrders);
z.array(Shipment).parse(shipments);
z.array(InventoryRow).parse(inventory);
z.array(Precedent).parse(precedents);
z.array(Customer).parse(customers);
z.array(DiversificationRec).parse(diversification);
z.array(SourcingCall).parse(sourcingCalls);

const check = (cond: boolean, msg: string) => {
  if (!cond) throw new Error(`Seed check failed: ${msg}`);
};
check(suppliers.length === 42, `42 suppliers (${suppliers.length})`);
check(parts.length === 180, `180 parts (${parts.length})`);
check(pos.length === 95, `95 POs (${pos.length})`);
check(poLines.length === 310, `310 PO lines (${poLines.length})`);
check(workOrders.length === 36, `36 work orders (${workOrders.length})`);
check(shipments.length === 58, `58 shipments`);
check(inventory.length === 180, `180 inventory rows (${inventory.length})`);
check(signals.length === 40, `40 signals (${signals.length})`);
check(signals.filter((s) => s.disposition === "material").length === 16, "16 material");
check(signals.filter((s) => s.disposition === "discarded").length === 8, "8 discarded");
check(precedents.length === 12, "12 precedents");
check(suppliers.filter((s) => s.financial_health < 40).length === 3, "3 suppliers under 40 financial health");
const aParts = parts.filter((p) => p.criticality === "A");
check(Math.abs(aParts.filter((p) => p.sole_source).length / aParts.length - 0.2) < 0.02, "20% of A parts sole-source");

const engine = suppliers.filter((s) => s.categories.includes("engine_lru"));
const rags = engine.map((s) => [s.name, rag(supplierFactors(s)), composite(supplierFactors(s))] as const);
check(rags.filter((x) => x[1] === "red").map((x) => x[0]).join() === "Aerotech Precision Pte Ltd", `engine red = Aerotech only: ${JSON.stringify(rags)}`);
check(rags.filter((x) => x[1] === "amber").length === 2, `engine amber = 2: ${JSON.stringify(rags.filter((x) => x[1] !== "green"))}`);

const window72 = Date.parse(CLOCK) - 72 * 3_600_000;
const recent = signals.filter((s) => Date.parse(s.received_at) >= window72);
check(recent.length === 14, `14 signals in 72h (${recent.length})`);
check(recent.filter((s) => s.disposition === "material").length === 4, "4 material in 72h");

for (const s of [...signals.filter((x) => x.disposition === "material"), ...library.filter((x) => x.material)]) {
  const exp = computeExposure(s, world);
  const chain = buildImpactChain(s, exp, world);
  const near = chain.workOrders.some((w) => diffDays(TODAY, w.wo.induction_date) <= 45);
  check(near, `${s.id} touches a work order inducting within 45 days`);
}

const aero = signals.find((s) => s.id === "SIG-0007")!;
const aeroScore = scoreImpact(buildImpactChain(aero, computeExposure(aero, world), world), world);
check(
  aeroScore.cost.severity === 78 && aeroScore.delay.severity === 64 && aeroScore.ops.severity === 55 && aeroScore.reputation.severity === 70,
  `Aerotech scores 78/64/55/70, got ${aeroScore.cost.severity}/${aeroScore.delay.severity}/${aeroScore.ops.severity}/${aeroScore.reputation.severity}`,
);

// Blocklist: no real aerospace supplier, customer or OEM names.
const names = [...suppliers.map((s) => s.name), ...customers.map((c) => c.name), ...shipments.map((s) => s.carrier)];
for (const n of names) {
  const hit = BLOCKLIST.find((b) => n.toLowerCase().includes(b));
  check(!hit, `blocklisted name "${hit}" in "${n}"`);
}

/* ================================================================== */
/* Write                                                               */
/* ================================================================== */

fs.mkdirSync(OUT, { recursive: true });
const write = (name: string, data: unknown) => fs.writeFileSync(path.join(OUT, `${name}.json`), JSON.stringify(data, null, 1) + "\n");
write("suppliers", suppliers);
write("parts", parts);
write("purchase-orders", pos);
write("work-orders", workOrders);
write("shipments", shipments);
write("inventory", inventory);
write("customers", customers);
write("signals", signals);
write("signal-library", library);
write("precedents", precedents);
write("diversification", diversification);
write("sourcing-calls", sourcingCalls);

console.log(
  `Seeded: ${suppliers.length} suppliers, ${parts.length} parts, ${pos.length} POs / ${poLines.length} lines, ${workOrders.length} WOs, ${shipments.length} shipments, ${inventory.length} inventory rows, ${signals.length} signals (+${library.length} library), ${precedents.length} precedents`,
);
