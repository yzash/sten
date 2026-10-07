import type { POLine, Shipment, Signal } from "./schema";
import { indexBy, type World } from "./world";

export type SignalScope = Pick<
  Signal,
  "affected_supplier_ids" | "affected_regions" | "affected_categories" | "affected_corridors"
>;

export interface Exposure {
  material: boolean;
  /** Union of exposed PO line ids, in data order. */
  poLineIds: string[];
  /** Which rule exposed each line. */
  viaSupplier: string[]; // rule (a)
  viaRegion: string[]; // rule (b)
  viaRoute: string[]; // rule (c), PO lines on exposed shipments
  shipmentIds: string[];
  supplierIds: string[];
  partIds: string[];
  discardReason: string | null;
}

const OPEN: POLine["status"][] = ["open", "partially_delivered"];
const IN_TRANSIT: Shipment["status"][] = ["booked", "in_transit", "held"];

/**
 * Materiality rule (PRD 7.1). A signal is material when its exposure set is non-empty:
 *  (a) open or partially delivered PO lines whose supplier is in the affected supplier set,
 *  (b) open PO lines whose part category matches and whose supplier plant sits in the affected region,
 *  (c) in-transit shipments with a route leg through the affected corridor.
 */
export function computeExposure(signal: SignalScope, world: World): Exposure {
  const suppliers = indexBy(world.suppliers, "id");
  const parts = indexBy(world.parts, "id");
  const affectedSup = new Set(signal.affected_supplier_ids);
  const regions = new Set(signal.affected_regions);
  const cats = new Set(signal.affected_categories);
  const corridors = new Set(signal.affected_corridors);

  const open = world.poLines.filter((l) => OPEN.includes(l.status));

  const viaSupplier = open.filter((l) => affectedSup.has(l.supplier_id)).map((l) => l.id);

  const viaRegion =
    regions.size === 0
      ? []
      : open
          .filter((l) => {
            const s = suppliers.get(l.supplier_id);
            const p = parts.get(l.part_id);
            if (!s || !p) return false;
            const catOk = cats.size === 0 || cats.has(p.category);
            return catOk && regions.has(s.region);
          })
          .map((l) => l.id);

  const shipments =
    corridors.size === 0
      ? []
      : world.shipments.filter(
          (sh) => IN_TRANSIT.includes(sh.status) && sh.route_legs.some((leg) => corridors.has(leg.corridor)),
        );
  const openIds = new Set(open.map((l) => l.id));
  const viaRoute = shipments.flatMap((sh) => sh.po_line_ids).filter((id) => openIds.has(id));

  const union = new Set([...viaSupplier, ...viaRegion, ...viaRoute]);
  const poLineIds = world.poLines.filter((l) => union.has(l.id)).map((l) => l.id);
  const lines = world.poLines.filter((l) => union.has(l.id));

  const material = poLineIds.length > 0 || shipments.length > 0;

  let discardReason: string | null = null;
  if (!material) {
    const parts: string[] = [];
    if (affectedSup.size > 0) parts.push("no open PO lines with the named suppliers");
    if (regions.size > 0) parts.push("no open POs with suppliers in the affected region");
    if (corridors.size > 0) parts.push("no in-transit shipments through the affected corridor");
    if (parts.length === 0) parts.push("no supplier, region or route in the signal maps to our supply base");
    discardReason = `No exposure: ${parts.join("; ")}`;
  }

  return {
    material,
    poLineIds,
    viaSupplier,
    viaRegion,
    viaRoute,
    shipmentIds: shipments.map((s) => s.id),
    supplierIds: [...new Set(lines.map((l) => l.supplier_id))],
    partIds: [...new Set(lines.map((l) => l.part_id))].filter((id) => parts.has(id)),
    discardReason,
  };
}
