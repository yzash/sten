/** Reads that mimic SAP MM (vendor master, material master, purchasing documents). */
import { db, poLines } from "./data";
import type { Part, POLine, PurchaseOrder, Supplier } from "@/lib/schema";

const supplierIdx = new Map(db.suppliers.map((s) => [s.id, s]));
const partIdx = new Map(db.parts.map((p) => [p.id, p]));
const lineIdx = new Map(poLines.map((l) => [l.id, l]));

export function listSuppliers(): Supplier[] {
  return db.suppliers;
}
export function getSupplier(lifnr: string): Supplier | undefined {
  return supplierIdx.get(lifnr);
}
export function listParts(): Part[] {
  return db.parts;
}
export function getPart(matnr: string): Part | undefined {
  return partIdx.get(matnr);
}
export function listPurchaseOrders(): PurchaseOrder[] {
  return db.purchaseOrders;
}
export function getPOLine(id: string): POLine | undefined {
  return lineIdx.get(id);
}
export function getOpenPOLines(filter: { supplierId?: string; partId?: string } = {}): POLine[] {
  return poLines.filter(
    (l) =>
      l.status !== "delivered" &&
      (!filter.supplierId || l.supplier_id === filter.supplierId) &&
      (!filter.partId || l.part_id === filter.partId),
  );
}
export function getAllPOLines(): POLine[] {
  return poLines;
}
