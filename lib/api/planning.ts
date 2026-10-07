/** Reads that mimic MES and planning (work orders, induction schedule, customers). */
import { db } from "./data";
import type { Customer, WorkOrder } from "@/lib/schema";

const woIdx = new Map(db.workOrders.map((w) => [w.id, w]));
const custIdx = new Map(db.customers.map((c) => [c.id, c]));

export function listWorkOrders(): WorkOrder[] {
  return db.workOrders;
}
export function getWorkOrder(id: string): WorkOrder | undefined {
  return woIdx.get(id);
}
export function getWorkOrdersForPOLines(poLineIds: string[]): WorkOrder[] {
  const ids = new Set(poLineIds);
  return db.workOrders.filter((w) => w.bom_lines.some((b) => b.po_line_id && ids.has(b.po_line_id)));
}
export function getCustomer(id: string): Customer | undefined {
  return custIdx.get(id);
}
export function listCustomers(): Customer[] {
  return db.customers;
}
