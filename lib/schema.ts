import { z } from "zod";

/* ------------------------------------------------------------------ */
/* Shared enums                                                        */
/* ------------------------------------------------------------------ */

export const DISRUPTION_TYPES = [
  "conflict_unrest",
  "route_disruption",
  "supply_shortage",
  "tariff",
  "natural_calamity",
  "export_control",
  "supplier_distress",
  "pandemic_health",
] as const;
export const DisruptionType = z.enum(DISRUPTION_TYPES);
export type DisruptionType = z.infer<typeof DisruptionType>;

export const DISRUPTION_LABELS: Record<DisruptionType, string> = {
  conflict_unrest: "Conflict or unrest",
  route_disruption: "Route disruption",
  supply_shortage: "Supply shortage",
  tariff: "Tariff",
  natural_calamity: "Natural calamity",
  export_control: "Localisation or export control",
  supplier_distress: "Supplier bankruptcy or distress",
  pandemic_health: "Pandemic or health",
};

export const CHANNELS = ["email", "news", "credit_monitor", "sap", "forwarder_edi", "sphera"] as const;
export const Channel = z.enum(CHANNELS);
export type Channel = z.infer<typeof Channel>;
export const CHANNEL_LABELS: Record<Channel, string> = {
  email: "EMAIL",
  news: "NEWS",
  credit_monitor: "CREDIT",
  sap: "SAP",
  forwarder_edi: "EDI",
  sphera: "SPHERA",
};

export const SignalState = z.enum(["strategic", "operational"]);
export type SignalState = z.infer<typeof SignalState>;

export const Disposition = z.enum(["material", "discarded", "merged"]);
export type Disposition = z.infer<typeof Disposition>;

export const PART_CATEGORIES = ["engine_lru", "nacelle", "fastener", "seal", "consumable", "raw_alloy"] as const;
export const PartCategory = z.enum(PART_CATEGORIES);
export type PartCategory = z.infer<typeof PartCategory>;
export const PART_CATEGORY_LABELS: Record<PartCategory, string> = {
  engine_lru: "Engine components",
  nacelle: "Nacelle",
  fastener: "Fasteners",
  seal: "Seals",
  consumable: "Consumables",
  raw_alloy: "Raw alloy",
};

export const Risk = z.enum(["low", "medium", "high"]);
export type Risk = z.infer<typeof Risk>;

export const SYSTEMS = ["SAP MM", "SAP FI", "Forwarder", "Planning", "Email"] as const;
export const System = z.enum(SYSTEMS);
export type System = z.infer<typeof System>;

/* ------------------------------------------------------------------ */
/* Master data                                                         */
/* ------------------------------------------------------------------ */

export const Cert = z.object({
  name: z.string(),
  number: z.string(),
  expiry: z.string(), // ISO date
});
export type Cert = z.infer<typeof Cert>;

export const FactorHistoryPoint = z.object({
  month: z.string(), // YYYY-MM
  financial: z.number(),
  capacity: z.number(),
  geo_esg: z.number(),
  sourcing: z.number(),
  network: z.number(),
});
export type FactorHistoryPoint = z.infer<typeof FactorHistoryPoint>;

/** Mimics SAP vendor master (LFA1) joined with Sphera supplier risk. */
export const Supplier = z.object({
  id: z.string(), // LIFNR
  name: z.string(),
  tier: z.union([z.literal(1), z.literal(2)]),
  country: z.string(),
  country_code: z.string(),
  city: z.string(),
  region: z.string(), // used for regional exposure matching
  categories: z.array(PartCategory),
  sole_source_parts: z.array(z.string()),
  financial_health: z.number().min(0).max(100),
  capacity: z.number().min(0).max(100),
  esg: z.number().min(0).max(100),
  geo_risk: z.number().min(0).max(100),
  sourcing_depth: z.number().min(0).max(100),
  network_depth: z.number().min(0).max(100),
  otd_pct: z.number(),
  ncr_12m: z.number().int(),
  certs: z.array(Cert),
  payment_terms: z.string(),
  strategic: z.boolean(),
  history: z.array(FactorHistoryPoint),
  status: z.enum(["active", "payment_block", "receivership"]),
});
export type Supplier = z.infer<typeof Supplier>;

export const ApprovedSource = z.object({
  supplier_id: z.string(),
  price_usd: z.number(),
  lead_time_days: z.number().int(),
  kind: z.enum(["oem", "pma", "der_repair", "distributor"]),
});
export type ApprovedSource = z.infer<typeof ApprovedSource>;

/** Mimics SAP material master (MARA/MARC). */
export const Part = z.object({
  id: z.string(), // MATNR
  description: z.string(),
  category: PartCategory,
  lead_time_days: z.number().int(),
  unit_cost_usd: z.number(),
  approved_sources: z.array(ApprovedSource),
  airworthiness_doc: z.enum(["FAA 8130-3", "EASA Form 1", "Dual release", "CoC"]),
  criticality: z.enum(["A", "B", "C"]),
  sole_source: z.boolean(),
  origin_region: z.string(),
});
export type Part = z.infer<typeof Part>;

/** Mimics SAP EKPO joined with EKKO header fields. */
export const POLine = z.object({
  id: z.string(), // `${ebeln}-${ebelp}`
  ebeln: z.string(),
  ebelp: z.string(),
  supplier_id: z.string(),
  part_id: z.string(),
  qty: z.number().int(),
  unit_price: z.number(),
  confirmed_date: z.string(),
  needed_date: z.string(),
  status: z.enum(["open", "partially_delivered", "delivered"]),
  backlog_days: z.number().int(),
  incoterm: z.string(),
  plant: z.string(),
});
export type POLine = z.infer<typeof POLine>;

export const PurchaseOrder = z.object({
  ebeln: z.string(),
  supplier_id: z.string(),
  created: z.string(),
  buyer: z.string(),
  currency: z.literal("USD"),
  lines: z.array(POLine),
});
export type PurchaseOrder = z.infer<typeof PurchaseOrder>;

export const BomLine = z.object({
  line: z.string(),
  part_id: z.string(),
  qty: z.number().int(),
  po_line_id: z.string().nullable(),
});
export type BomLine = z.infer<typeof BomLine>;

export const Customer = z.object({
  id: z.string(),
  name: z.string(),
  tier: z.enum(["strategic", "key", "standard"]),
});
export type Customer = z.infer<typeof Customer>;

/** Mimics MES work order + planning induction schedule. */
export const WorkOrder = z.object({
  id: z.string(),
  kind: z.enum(["engine", "airframe", "component", "nacelle"]),
  asset_ref: z.string(), // synthetic ESN or tail
  customer_id: z.string(),
  induction_date: z.string(),
  target_redelivery: z.string(),
  slot: z.string(),
  float_days: z.number().int(),
  ld_per_day_usd: z.number(),
  bom_lines: z.array(BomLine),
});
export type WorkOrder = z.infer<typeof WorkOrder>;

export const RouteLeg = z.object({
  from: z.string(),
  to: z.string(),
  corridor: z.string(),
  mode: z.enum(["air", "sea", "road"]),
});
export type RouteLeg = z.infer<typeof RouteLeg>;

/** Mimics forwarder EDI (IFTSTA) + WMS inbound. */
export const Shipment = z.object({
  id: z.string(),
  po_line_ids: z.array(z.string()),
  carrier: z.string(),
  mode: z.enum(["air", "sea", "road"]),
  origin: z.string(),
  route_legs: z.array(RouteLeg),
  eta: z.string(),
  status: z.enum(["booked", "in_transit", "held", "delivered"]),
  risk_flags: z.array(z.string()),
});
export type Shipment = z.infer<typeof Shipment>;

/** Mimics WMS stock (LQUA-like). */
export const InventoryRow = z.object({
  id: z.string(),
  part_id: z.string(),
  location: z.string(),
  on_hand: z.number().int(),
  allocated: z.number().int(),
  free: z.number().int(),
  batch: z.string(),
  inspection_status: z.enum(["released", "quarantine", "rejected"]),
  allocated_to_wo: z.string().nullable(),
});
export type InventoryRow = z.infer<typeof InventoryRow>;

/* ------------------------------------------------------------------ */
/* Signals                                                             */
/* ------------------------------------------------------------------ */

export const Evidence = z.object({
  channel: Channel,
  received_at: z.string(),
  snippet: z.string(),
});
export type Evidence = z.infer<typeof Evidence>;

export const Signal = z.object({
  id: z.string(),
  received_at: z.string(), // ISO with offset
  channel: Channel,
  headline: z.string(),
  raw_text: z.string(),
  type: DisruptionType,
  state: SignalState,
  confidence: z.number().min(0).max(1),
  disposition: Disposition,
  material: z.boolean(),
  parent_id: z.string().nullable(), // set for merged (corroborating) signals
  affected_supplier_ids: z.array(z.string()),
  affected_part_ids: z.array(z.string()),
  affected_po_line_ids: z.array(z.string()),
  affected_regions: z.array(z.string()),
  affected_categories: z.array(PartCategory),
  affected_corridors: z.array(z.string()),
  est_delay_days: z.number().int(), // estimated slip added to confirmed dates on exposed lines
  discard_reason: z.string().nullable(),
  evidence: z.array(Evidence),
  checkpoint: z.enum(["sourcing", "purchasing", "shipment", "warehouse", "relationships"]),
  library: z.boolean().default(false),
});
export type Signal = z.infer<typeof Signal>;

/* ------------------------------------------------------------------ */
/* Precedents                                                          */
/* ------------------------------------------------------------------ */

export const Precedent = z.object({
  id: z.string(),
  year: z.number().int(),
  title: z.string(),
  signal_type: DisruptionType,
  supplier_ids: z.array(z.string()),
  summary: z.string(),
  options_considered: z.array(z.string()),
  option_taken: z.string(),
  cost_usd: z.number(),
  delay_days: z.number().int(),
  outcome: z.string(),
  lesson: z.string(),
});
export type Precedent = z.infer<typeof Precedent>;

/* ------------------------------------------------------------------ */
/* Prebuilt reasoning (Claude output store)                            */
/* ------------------------------------------------------------------ */

export const AgentActionSpec = z.object({
  system: System,
  action: z.string(),
  label: z.string(),
  payload: z.record(z.string(), z.unknown()),
});
export type AgentActionSpec = z.infer<typeof AgentActionSpec>;

export const ReasoningOption = z.object({
  id: z.string(),
  name: z.string(),
  mechanism: z.string(),
  cost_usd: z.number(),
  residual_delay_days: z.number().int().min(0),
  risk: Risk,
  speed_days: z.number().int().min(0),
  precedent_id: z.string().nullable(),
  actions: z.array(AgentActionSpec).min(1, "every option must name at least one agent action"),
});
export type ReasoningOption = z.infer<typeof ReasoningOption>;

const ImpactDim = z.object({ severity: z.number().min(0).max(100), rationale: z.string() });

export const ReasoningImpact = z.object({
  cost: ImpactDim.extend({ usd: z.number() }),
  delay: ImpactDim.extend({ days: z.number().int() }),
  ops: ImpactDim.extend({ slots: z.number().int(), lines: z.number().int() }),
  reputation: ImpactDim.extend({ weighted_usd: z.number() }),
});
export type ReasoningImpact = z.infer<typeof ReasoningImpact>;

export const QA_PROMPT_IDS = ["options", "cheapest", "last_time", "why_move"] as const;
export const QaPromptId = z.enum(QA_PROMPT_IDS);
export type QaPromptId = z.infer<typeof QaPromptId>;

export const Reasoning = z.object({
  signal_id: z.string(),
  summary: z.string(),
  impact: ReasoningImpact,
  options: z.array(ReasoningOption).min(3).max(6),
  recommended_id: z.string(),
  rationale: z.string(),
  qa: z.array(z.object({ prompt_id: QaPromptId, answer: z.string() })).length(4),
  generated: z.object({ by: z.string(), at: z.string(), prompt_version: z.string() }),
});
export type Reasoning = z.infer<typeof Reasoning>;

/* ------------------------------------------------------------------ */
/* Scorecard diversification recommendations and sourcing calls        */
/* ------------------------------------------------------------------ */

export const DiversificationRec = z.object({
  id: z.string(),
  category: PartCategory,
  part_id: z.string(),
  current_supplier_id: z.string(),
  candidate_supplier_ids: z.array(z.string()),
  qualification_effort: z.enum(["low", "medium", "high"]),
  qualification_weeks: z.number().int(),
  cost_delta_pct: z.number(),
  rationale: z.string(),
});
export type DiversificationRec = z.infer<typeof DiversificationRec>;

export const SourcingCall = z.object({
  id: z.string(),
  po_line_id: z.string(),
  risk: z.string(),
  action: z.enum(["split", "expedite", "pull_forward", "hold"]),
  rationale: z.string(),
  lead_time_risk_days: z.number().int(),
});
export type SourcingCall = z.infer<typeof SourcingCall>;

/* ------------------------------------------------------------------ */
/* Runtime (client) records                                            */
/* ------------------------------------------------------------------ */

export const ExecStatus = z.enum(["queued", "writing", "written", "confirmed", "failed"]);
export type ExecStatus = z.infer<typeof ExecStatus>;

export const ExecutionAction = z.object({
  id: z.string(),
  decision_id: z.string(),
  actor: z.enum(["human", "agent"]),
  actor_name: z.string(),
  system: z.union([System, z.literal("Prototype")]),
  action: z.string(),
  label: z.string(),
  doc_number: z.string().nullable(),
  status: ExecStatus,
  payload: z.record(z.string(), z.unknown()),
  context: z.string(), // signal id or screen
  created_at: z.string(),
  updated_at: z.string(),
});
export type ExecutionAction = z.infer<typeof ExecutionAction>;
