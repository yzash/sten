/** Reads that mimic forwarder EDI (shipments) and WMS (inventory). */
import { db } from "./data";
import type { InventoryRow, Shipment } from "@/lib/schema";

export function getShipments(filter: { poLineIds?: string[] } = {}): Shipment[] {
  if (!filter.poLineIds) return db.shipments;
  const ids = new Set(filter.poLineIds);
  return db.shipments.filter((s) => s.po_line_ids.some((id) => ids.has(id)));
}
export function getInventory(filter: { partId?: string } = {}): InventoryRow[] {
  return db.inventory.filter((r) => !filter.partId || r.part_id === filter.partId);
}
