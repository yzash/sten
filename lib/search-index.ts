import { getSupplier, listParts, listPurchaseOrders, listSignals, listSuppliers, listWorkOrders, getCustomer } from "./api";
import { PART_CATEGORY_LABELS } from "./schema";
import type { SearchItem } from "./search";

/** Built on the server and shipped to the client as a compact index. */
export function buildSearchIndex(): SearchItem[] {
  const items: SearchItem[] = [];
  for (const s of listSuppliers())
    items.push({ kind: "Supplier", id: s.id, label: s.name, sub: `LIFNR ${s.id} · Tier ${s.tier} · ${s.city}, ${s.country}`, href: `/suppliers/${s.id}` });
  for (const p of listParts()) {
    const sup = getSupplier(p.approved_sources[0]?.supplier_id ?? "");
    items.push({
      kind: "Part",
      id: p.id,
      label: p.description,
      sub: `${p.id} · ${PART_CATEGORY_LABELS[p.category]} · ${sup?.name ?? ""}`,
      href: `/purchasing?part=${encodeURIComponent(p.id)}`,
    });
  }
  for (const po of listPurchaseOrders()) {
    const sup = getSupplier(po.supplier_id);
    items.push({ kind: "PO", id: po.ebeln, label: `PO ${po.ebeln}`, sub: `${sup?.name ?? po.supplier_id} · ${po.lines.length} line${po.lines.length === 1 ? "" : "s"}`, href: `/purchasing?po=${po.ebeln}` });
  }
  for (const s of listSignals().filter((x) => x.disposition !== "merged"))
    items.push({ kind: "Signal", id: s.id, label: s.headline, sub: s.id, href: `/signals/${s.id}` });
  for (const w of listWorkOrders())
    items.push({ kind: "Work order", id: w.id, label: `${w.id} · ${w.asset_ref}`, sub: getCustomer(w.customer_id)?.name ?? "", href: `/purchasing?wo=${w.id}` });
  return items;
}
