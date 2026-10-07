/**
 * Bundled mock JSON. In the pilot each import becomes a fetch against the system of record
 * (SAP OData, Sphera, WMS, forwarder EDI). Only lib/api reads this file.
 */
import suppliersJson from "@/data/suppliers.json";
import partsJson from "@/data/parts.json";
import posJson from "@/data/purchase-orders.json";
import workOrdersJson from "@/data/work-orders.json";
import shipmentsJson from "@/data/shipments.json";
import inventoryJson from "@/data/inventory.json";
import customersJson from "@/data/customers.json";
import signalsJson from "@/data/signals.json";
import libraryJson from "@/data/signal-library.json";
import precedentsJson from "@/data/precedents.json";
import diversificationJson from "@/data/diversification.json";
import sourcingCallsJson from "@/data/sourcing-calls.json";
import type {
  Customer,
  DiversificationRec,
  InventoryRow,
  Part,
  Precedent,
  PurchaseOrder,
  Shipment,
  Signal,
  SourcingCall,
  Supplier,
  WorkOrder,
} from "@/lib/schema";
import type { World } from "@/lib/world";

export const db = {
  suppliers: suppliersJson as Supplier[],
  parts: partsJson as Part[],
  purchaseOrders: posJson as PurchaseOrder[],
  workOrders: workOrdersJson as WorkOrder[],
  shipments: shipmentsJson as Shipment[],
  inventory: inventoryJson as InventoryRow[],
  customers: customersJson as Customer[],
  signals: signalsJson as Signal[],
  library: libraryJson as Signal[],
  precedents: precedentsJson as Precedent[],
  diversification: diversificationJson as DiversificationRec[],
  sourcingCalls: sourcingCallsJson as SourcingCall[],
};

export const poLines = db.purchaseOrders.flatMap((p) => p.lines);

export const world: World = {
  suppliers: db.suppliers,
  parts: db.parts,
  poLines,
  workOrders: db.workOrders,
  shipments: db.shipments,
  customers: db.customers,
  inventory: db.inventory,
};
