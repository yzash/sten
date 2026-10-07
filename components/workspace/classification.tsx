"use client";

import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/field";
import { Tag } from "@/components/ui/tag";
import { fmtDate, fmtSgt } from "@/lib/dates";
import { usd } from "@/lib/format";
import { CHANNEL_LABELS, DISRUPTION_LABELS, DISRUPTION_TYPES, type DisruptionType } from "@/lib/schema";
import { useStore } from "@/lib/store";
import type { WorkspaceData } from "@/lib/workspace-data";

export function ClassificationCard({ data, draft }: { data: WorkspaceData; draft?: boolean }) {
  const { signal, exposure, chain, names } = data;
  const override = useStore((s) => s.overrides[signal.id]);
  const doOverride = useStore((s) => s.override);
  const persona = useStore((s) => s.persona);
  const [editing, setEditing] = useState(false);
  const [type, setType] = useState<DisruptionType>(override?.type ?? signal.type);
  const [material, setMaterial] = useState<boolean>(override?.material ?? signal.disposition === "material");

  const effType = override?.type ?? signal.type;
  const effMaterial = override?.material ?? signal.disposition === "material";
  const evidence = signal.evidence.length ? signal.evidence : [{ channel: signal.channel, received_at: signal.received_at, snippet: signal.raw_text }];
  const firstSap = evidence.findIndex((e) => e.channel === "sap");

  return (
    <div className="space-y-5" data-testid="classification">
      <div>
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <Tag>{CHANNEL_LABELS[signal.channel]}</Tag>
          <span className="tnum text-[12px] text-ink-3">{fmtSgt(signal.received_at)} SGT</span>
          {draft && <Tag tone="draft">Draft</Tag>}
        </div>
        <h1 className="text-[18px] font-medium leading-snug tracking-[-0.01em]">{signal.headline}</h1>
        <p className="mt-2 text-[12.5px] leading-relaxed text-ink-2">{signal.raw_text}</p>
      </div>

      <div className="border-t border-rule pt-4">
        <div className="mb-2 flex items-center justify-between">
          <span className="label">Classification</span>
          {!editing && (
            <button onClick={() => setEditing(true)} className="text-[12px] text-ink-2 underline decoration-rule-2 underline-offset-2 hover:text-ink" data-testid="override-open">
              Override
            </button>
          )}
        </div>
        {editing ? (
          <div className="space-y-2.5 border border-rule-2 p-3">
            <label className="block">
              <span className="label mb-1 block">Type</span>
              <Select value={type} onChange={(e) => setType(e.target.value as DisruptionType)} className="w-full">
                {DISRUPTION_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {DISRUPTION_LABELS[t]}
                  </option>
                ))}
              </Select>
            </label>
            <label className="flex items-center gap-2 text-[13px]">
              <input type="checkbox" checked={material} onChange={(e) => setMaterial(e.target.checked)} />
              Material
            </label>
            <p className="text-[11.5px] text-ink-3">Overrides are logged with your persona ({persona}) and time. The deterministic exposure set does not change.</p>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="primary"
                onClick={() => {
                  const o: { type?: DisruptionType; material?: boolean } = {};
                  if (type !== effType) o.type = type;
                  if (material !== effMaterial) o.material = material;
                  if (Object.keys(o).length) doOverride(signal.id, o);
                  setEditing(false);
                }}
              >
                Save override
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <dl className="grid grid-cols-[96px_1fr] gap-y-1.5 text-[13px]">
            <dt className="label pt-0.5">Type</dt>
            <dd>
              {DISRUPTION_LABELS[effType]}
              {override?.type && <span className="ml-2 text-[11.5px] text-ink-3">overridden</span>}
            </dd>
            <dt className="label pt-0.5">State</dt>
            <dd className="capitalize">
              {signal.state} <span className="text-[12px] normal-case text-ink-3">{signal.state === "operational" ? "already impacting" : "before it hits"}</span>
            </dd>
            <dt className="label pt-0.5">Confidence</dt>
            <dd className="tnum">{signal.confidence.toFixed(2)}</dd>
            <dt className="label pt-0.5">Material</dt>
            <dd>
              {effMaterial ? "Yes" : "No"}
              {override?.material !== undefined && <span className="ml-2 text-[11.5px] text-ink-3">overridden</span>}
              {!effMaterial && signal.discard_reason && <div className="text-[12px] text-ink-2">{signal.discard_reason}</div>}
            </dd>
          </dl>
        )}
      </div>

      <div className="border-t border-rule pt-4">
        <div className="label mb-2">Evidence · {evidence.length} source{evidence.length === 1 ? "" : "s"}</div>
        <ol className="space-y-2.5">
          {evidence.map((e, i) => (
            <li key={i} className="grid grid-cols-[58px_1fr] gap-2 text-[12.5px]">
              <div>
                <Tag tone="muted">{CHANNEL_LABELS[e.channel]}</Tag>
                <div className="tnum mt-1 text-[11px] text-ink-3">{fmtSgt(e.received_at, { date: false })}</div>
              </div>
              <div className="leading-snug text-ink-2">
                {i === 0 && evidence.length > 1 && <span className="label mr-1 text-ink-2">First seen</span>}
                {e.snippet}
              </div>
            </li>
          ))}
        </ol>
        {firstSap > 0 && (
          <p className="accent-line mt-3 text-[13.5px] text-ink-2">
            The {CHANNEL_LABELS[evidence[0].channel].toLowerCase()} signal arrived {Math.round((Date.parse(evidence[firstSap].received_at) - Date.parse(evidence[0].received_at)) / 60000)} minutes before SAP was updated.
          </p>
        )}
      </div>

      {exposure.material && (
        <div className="border-t border-rule pt-4">
          <div className="label mb-2">Exposure set</div>
          <div className="mb-3 grid grid-cols-3 border border-rule text-center">
            {[
              ["(a) supplier", exposure.viaSupplier.length],
              ["(b) region", exposure.viaRegion.length],
              ["(c) route", exposure.shipmentIds.length],
            ].map(([l, n], i) => (
              <div key={i} className="border-r border-rule px-2 py-2 last:border-r-0">
                <div className="tnum text-[15px]">{n}</div>
                <div className="text-[10.5px] text-ink-3">{l}</div>
              </div>
            ))}
          </div>
          <div className="space-y-3 text-[12.5px]">
            <div>
              <div className="label mb-1">Suppliers</div>
              {exposure.supplierIds.map((id) => (
                <Link key={id} href={`/suppliers/${id}`} className="block hover:underline">
                  {names.suppliers[id]} <span className="mono text-[11px] text-ink-3">{id}</span>
                </Link>
              ))}
            </div>
            <div>
              <div className="label mb-1">Parts</div>
              {Object.entries(names.parts)
                .slice(0, 6)
                .map(([id, d]) => (
                  <div key={id}>
                    <span className="mono text-[11.5px]">{id}</span> <span className="text-ink-2">{d}</span>
                  </div>
                ))}
              {Object.keys(names.parts).length > 6 && <div className="text-ink-3">+{Object.keys(names.parts).length - 6} more parts</div>}
            </div>
            <div>
              <div className="label mb-1">PO lines · {chain.lines.length}</div>
              <table className="w-full">
                <tbody>
                  {chain.lines.slice(0, 6).map((l) => (
                    <tr key={l.line.id} className="border-b border-rule last:border-b-0">
                      <td className="mono py-1 text-[11.5px]">
                        {l.line.ebeln}/{l.line.ebelp.slice(-2)}
                      </td>
                      <td className="tnum py-1 text-right text-[11.5px]">{usd(l.value_usd, { compact: true })}</td>
                      <td className="tnum py-1 text-right text-[11.5px] text-ink-3">need {fmtDate(l.line.needed_date)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {chain.lines.length > 6 && <div className="mt-1 text-ink-3">+{chain.lines.length - 6} more lines</div>}
            </div>
            {exposure.shipmentIds.length > 0 && (
              <div>
                <div className="label mb-1">In-transit shipments</div>
                <div className="mono text-[11.5px]">{exposure.shipmentIds.join(", ")}</div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
