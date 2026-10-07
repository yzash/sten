import type { Customer, Part, POLine, Shipment, Supplier, WorkOrder, InventoryRow } from "./schema";

/** The slice of master and transactional data the deterministic layer reads. */
export interface World {
  suppliers: Supplier[];
  parts: Part[];
  poLines: POLine[];
  workOrders: WorkOrder[];
  shipments: Shipment[];
  customers: Customer[];
  inventory?: InventoryRow[];
}

export function indexBy<T, K extends keyof T>(xs: T[], key: K): Map<T[K], T> {
  return new Map(xs.map((x) => [x[key], x]));
}
