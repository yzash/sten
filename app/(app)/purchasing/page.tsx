import type { Metadata } from "next";
import { Purchasing } from "@/components/purchasing/purchasing";
import { getWorkOrder } from "@/lib/api";
import { purchasingData } from "@/lib/purchasing-data";

export const metadata: Metadata = { title: "Purchasing" };

export default async function PurchasingPage({ searchParams }: { searchParams: Promise<{ po?: string; part?: string; wo?: string; line?: string }> }) {
  const q = await searchParams;
  const d = purchasingData();
  let line = q.line ? d.lines.find((l) => l.id === q.line) : undefined;
  if (!line && q.po) line = d.lines.find((l) => l.ebeln === q.po);
  if (!line && q.part) line = d.lines.find((l) => l.part_id === q.part);
  if (!line && q.wo) {
    const wo = getWorkOrder(q.wo);
    const linked = wo?.bom_lines.map((b) => b.po_line_id).filter(Boolean) ?? [];
    line = d.lines.find((l) => linked.includes(l.id));
  }
  const filter = q.po ? `PO ${q.po}` : q.part ? q.part : q.wo ? q.wo : undefined;
  return (
    <Purchasing
      rows={d.rows}
      lines={d.lines}
      calls={d.calls}
      initial={{ supplierId: line?.supplier_id, lineId: line?.id, filter: filter && !line ? `${filter} (no open line)` : filter }}
    />
  );
}
