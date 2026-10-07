"use client";

import { useMemo, useState } from "react";
import { ExecutionPanel } from "@/components/workspace/execution-panel";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/field";
import { Modal } from "@/components/ui/modal";
import { PageHeader, SectionHead } from "@/components/ui/section";
import { Tag } from "@/components/ui/tag";
import { cn } from "@/lib/cn";
import { addDays, fmtDate } from "@/lib/dates";
import { sgd, usd } from "@/lib/format";
import { PERSONAS } from "@/lib/personas";
import type { BoardRow, LineView } from "@/lib/purchasing-data";
import { SPLIT_THRESHOLD_DAYS } from "@/lib/purchasing-data";
import type { AgentActionSpec, SourcingCall } from "@/lib/schema";
import { splitPo } from "@/lib/split-po";
import { useStore } from "@/lib/store";

type Call = SourcingCall & { supplier_name: string; part_id: string; part_desc: string; value: number };

const ACTION_LABEL: Record<SourcingCall["action"], string> = { split: "Split", expedite: "Expedite", pull_forward: "Pull forward", hold: "Hold" };
const BAND_DOT = { green: "bg-sev-low", amber: "bg-sev-medium", red: "bg-sev-critical" } as const;
const TODAY = "2026-10-07";

export function Purchasing({
  rows,
  lines,
  calls,
  initial,
}: {
  rows: BoardRow[];
  lines: LineView[];
  calls: Call[];
  initial: { supplierId?: string; lineId?: string; filter?: string };
}) {
  const firstCall = lines.find((l) => l.id === calls[0]?.po_line_id);
  const [supplierId, setSupplierId] = useState<string | undefined>(initial.supplierId ?? firstCall?.supplier_id ?? rows.find((r) => r.split_candidate)?.supplier.id);
  const [lineId, setLineId] = useState<string | undefined>(initial.lineId ?? (initial.supplierId ? undefined : firstCall?.id));
  const supplierLines = lines.filter((l) => l.supplier_id === supplierId).sort((a, b) => a.needed_date.localeCompare(b.needed_date));
  const line = lines.find((l) => l.id === lineId) ?? supplierLines[0];

  return (
    <div>
      <PageHeader
        kicker="Checkpoint 2 · Purchasing"
        title="Sourcing call and split PO"
        sub={`Open PO backlog by supplier. A supplier with value-weighted backlog over ${SPLIT_THRESHOLD_DAYS} days, or not active, is a split candidate. Splits route through the same approval and execution flow as a signal response.`}
      />
      {initial.filter && (
        <div className="border-b border-rule bg-paper-2 px-8 py-2 text-[12.5px] text-ink-2">
          Opened from search: <span className="mono">{initial.filter}</span>
        </div>
      )}
      <div className="grid grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
        <div className="min-w-0 border-r border-rule px-8 py-5">
          <SectionHead label={`Open PO board · ${rows.length} suppliers`} right={<span className="text-[11.5px] text-ink-3">{rows.filter((r) => r.split_candidate).length} split candidates</span>} />
          <table className="w-full text-[12.5px]" data-testid="po-board">
            <thead>
              <tr className="border-b border-rule">
                {["Supplier", "POs", "Lines", "Open value", "Backlog", "OTD", ""].map((h, i) => (
                  <th key={i} className={cn("label py-2 font-normal", i >= 1 && i <= 5 ? "text-right" : "text-left")}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr
                  key={r.supplier.id}
                  onClick={() => {
                    setSupplierId(r.supplier.id);
                    setLineId(undefined);
                  }}
                  className={cn("h-9 cursor-pointer border-b border-rule hover:bg-paper-2", supplierId === r.supplier.id && "bg-paper-2")}
                  data-testid={`board-${r.supplier.id}`}
                >
                  <td className="pr-2">
                    <span className="flex items-center gap-2">
                      <span className={cn("inline-block h-2 w-2 shrink-0", BAND_DOT[r.band])} title={`Health: ${r.band}`} />
                      <span className="truncate">{r.supplier.name}</span>
                    </span>
                  </td>
                  <td className="tnum text-right">{r.po_count}</td>
                  <td className="tnum text-right">{r.open_count}</td>
                  <td className="tnum text-right" title={sgd(r.open_value)}>
                    {usd(r.open_value, { compact: true })}
                  </td>
                  <td className={cn("tnum text-right", r.backlog_days > SPLIT_THRESHOLD_DAYS && "text-sev-high")}>{r.backlog_days}d</td>
                  <td className="tnum text-right">{r.supplier.otd_pct}%</td>
                  <td className="pl-3 text-right">{r.split_candidate && <Tag tone="default">{r.supplier.status !== "active" ? r.supplier.status : "split candidate"}</Tag>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="min-w-0 px-8 py-5">
          <SectionHead label="Split PO builder" />
          {supplierLines.length === 0 ? (
            <p className="py-4 text-[13px] text-ink-3">Pick a supplier on the board to load its open lines.</p>
          ) : (
            <>
              <div className="py-3">
                <span className="label mb-1.5 block">PO line</span>
                <Select value={line?.id} onChange={(e) => setLineId(e.target.value)} className="w-full" aria-label="PO line" data-testid="split-line">
                  {supplierLines.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.ebeln}/{l.ebelp} · {l.part_id} · {l.qty} pcs · need {fmtDate(l.needed_date)}
                    </option>
                  ))}
                </Select>
              </div>
              {line && <SplitBuilder key={line.id} line={line} />}
            </>
          )}
        </div>
      </div>
      <div className="border-t border-rule px-8 py-5">
        <SectionHead label={`Sourcing call recommendations · ${calls.length}`} right={<span className="text-[11.5px] text-ink-3">short-term lead-time risks, prebuilt</span>} />
        <table className="w-full text-[12.5px]" data-testid="sourcing-calls">
          <thead>
            <tr className="border-b border-rule">
              {["Action", "PO line", "Supplier", "Risk", "Why", "At risk", ""].map((h, i) => (
                <th key={i} className={cn("label py-2 font-normal", i === 5 ? "text-right" : "text-left")}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {calls.map((c) => {
              const l = lines.find((x) => x.id === c.po_line_id);
              return (
                <tr key={c.id} className="border-b border-rule align-top">
                  <td className="py-2.5 pr-3">
                    <Tag>{ACTION_LABEL[c.action]}</Tag>
                  </td>
                  <td className="mono py-2.5 pr-3 text-[11.5px]">
                    {c.po_line_id.replace("-", " / ")}
                    <div className="text-ink-3">{c.part_id}</div>
                  </td>
                  <td className="py-2.5 pr-3">{c.supplier_name}</td>
                  <td className="py-2.5 pr-3 text-ink-2">{c.risk}</td>
                  <td className="max-w-[420px] py-2.5 pr-3 text-ink-2">{c.rationale}</td>
                  <td className="tnum py-2.5 text-right">{c.lead_time_risk_days}d</td>
                  <td className="py-2.5 pl-3 text-right">
                    {l && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setSupplierId(l.supplier_id);
                          setLineId(l.id);
                          window.scrollTo({ top: 0, behavior: "smooth" });
                        }}
                      >
                        Open in builder
                      </Button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SplitBuilder({ line }: { line: LineView }) {
  const currentActive = line.sources.find((s) => s.supplier_id === line.supplier_id && s.status === "active");
  const usable = line.sources.filter((s) => s.status === "active");
  const [aId, setAId] = useState(currentActive?.supplier_id ?? usable[0]?.supplier_id);
  const [bId, setBId] = useState(
    [...usable].filter((s) => s.supplier_id !== (currentActive?.supplier_id ?? usable[0]?.supplier_id)).sort((x, y) => x.lead - y.lead)[0]?.supplier_id,
  );
  const [ratio, setRatio] = useState(70);
  const [confirm, setConfirm] = useState(false);
  const approve = useStore((s) => s.approve);
  const persona = useStore((s) => s.persona);
  const decisions = useStore((s) => s.decisions);
  const log = useStore((s) => s.log);
  const context = `PO ${line.id}`;
  const decision = decisions.find((d) => d.context === context && d.kind === "approve");

  const srcA = line.sources.find((s) => s.supplier_id === aId);
  const srcB = line.sources.find((s) => s.supplier_id === bId);
  const leadOf = (s: LineView["sources"][number]) => (s.supplier_id === line.supplier_id ? line.remaining_days : s.lead);
  const res = useMemo(
    () =>
      srcA && srcB
        ? splitPo(line.qty, { supplier_id: srcA.supplier_id, unit_price: srcA.price, lead_time_days: leadOf(srcA) }, { supplier_id: srcB.supplier_id, unit_price: srcB.price, lead_time_days: leadOf(srcB) }, ratio / 100)
        : null,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [srcA, srcB, ratio, line],
  );
  const baselineCost = line.qty * line.unit_price;
  const baselineEta = line.confirmed_date;

  if (usable.length < 2) {
    return (
      <div className="border border-dashed border-rule-2 p-4 text-[13px] text-ink-2">
        {line.part_id} has {usable.length} active approved source{usable.length === 1 ? "" : "s"}, so there is nothing to split across. Qualifying a second source is a sourcing task on the Risk Scorecard.
      </div>
    );
  }

  const actions: AgentActionSpec[] = res && srcA && srcB
    ? [
        {
          system: "SAP MM",
          action: "create_split_po",
          label: `Create split PO ${ratio}/${100 - ratio}: ${srcA.name} ${res.qtyPrimary} pcs, ${srcB.name} ${res.qtyAlternate} pcs`,
          payload: { doc_type: "NB", source_line: line.id, matnr: line.part_id, split: [{ lifnr: srcA.supplier_id, qty: res.qtyPrimary }, { lifnr: srcB.supplier_id, qty: res.qtyAlternate }], net_value_usd: Math.round(res.costUsd) },
        },
        ...(line.work_orders.length
          ? [{ system: "Planning" as const, action: "notify_planning", label: `Notify planning: ${line.work_orders.join(", ")} first parts in ${res.firstArrivalDays}d, full cover in ${res.fullCoverDays}d`, payload: { work_orders: line.work_orders, first_arrival: addDays(TODAY, res.firstArrivalDays), full_cover: addDays(TODAY, res.fullCoverDays) } }]
          : []),
      ]
    : [];

  return (
    <div data-testid="split-builder">
      <div className="mb-3 grid grid-cols-4 gap-3 border-y border-rule py-2.5 text-[12px]">
        <div>
          <div className="label text-[9.5px]">Part</div>
          <div className="mono">{line.part_id}</div>
          <div className="truncate text-ink-3">{line.part_desc}</div>
        </div>
        <div>
          <div className="label text-[9.5px]">Qty · value</div>
          <div className="tnum">
            {line.qty.toLocaleString("en-US")} · {usd(baselineCost, { compact: true })}
          </div>
        </div>
        <div>
          <div className="label text-[9.5px]">Confirmed · needed</div>
          <div className="tnum">
            {fmtDate(line.confirmed_date)} · {fmtDate(line.needed_date)}
          </div>
        </div>
        <div>
          <div className="label text-[9.5px]">Work orders</div>
          <div className="mono">{line.work_orders.join(", ") || "stock"}</div>
        </div>
      </div>
      <div className="label mb-1">Approved sources</div>
      <table className="mb-3 w-full text-[12px]">
        <thead>
          <tr className="border-b border-rule">
            {["Source", "Kind", "Price", "Lead", "OTD", "NCR", "A", "B"].map((h, i) => (
              <th key={h} className={cn("label py-1.5 font-normal", i >= 2 ? "text-right" : "text-left")}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {line.sources.map((s) => {
            const off = s.status !== "active";
            return (
              <tr key={s.supplier_id} className={cn("h-8 border-b border-rule", off && "text-ink-3")}>
                <td className="pr-2">
                  {s.name} {s.supplier_id === line.supplier_id && <span className="text-[11px] text-ink-3">current</span>} {off && <Tag tone="muted">{s.status}</Tag>}
                </td>
                <td className="uppercase text-ink-3">{s.kind}</td>
                <td className="tnum text-right">{usd(s.price)}</td>
                <td className="tnum text-right">{leadOf(s)}d</td>
                <td className="tnum text-right">{s.otd}%</td>
                <td className="tnum text-right">{s.ncr}</td>
                <td className="text-right">
                  <input type="radio" name="srcA" disabled={off || s.supplier_id === bId} checked={aId === s.supplier_id} onChange={() => setAId(s.supplier_id)} aria-label={`Source A ${s.name}`} />
                </td>
                <td className="text-right">
                  <input type="radio" name="srcB" disabled={off || s.supplier_id === aId} checked={bId === s.supplier_id} onChange={() => setBId(s.supplier_id)} aria-label={`Source B ${s.name}`} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <div className="mb-3">
        <div className="mb-1 flex items-baseline justify-between">
          <span className="label">Split ratio A / B</span>
          <span className="tnum text-[15px]" data-testid="split-ratio">
            {ratio}/{100 - ratio}
          </span>
        </div>
        <input type="range" min={0} max={100} step={5} value={ratio} onChange={(e) => setRatio(Number(e.target.value))} className="w-full accent-[var(--ink)]" aria-label="Split ratio" data-testid="split-slider" />
      </div>
      {res && (
        <div className="grid grid-cols-4 gap-3 border-y border-rule py-3" data-testid="split-result">
          <ResultCell label="Split cost" value={usd(res.costUsd, { compact: true })} sub={`${res.costUsd - baselineCost >= 0 ? "+" : "-"}${usd(Math.abs(res.costUsd - baselineCost), { compact: true }).replace("USD ", "USD ")} vs PO`} />
          <ResultCell label="Blended unit" value={usd(res.blendedUnitPrice)} sub={`PO ${usd(line.unit_price)}`} />
          <ResultCell label="First parts" value={fmtDate(addDays(TODAY, res.firstArrivalDays))} sub={`${res.firstArrivalDays}d`} />
          <ResultCell label="Full cover" value={fmtDate(addDays(TODAY, res.fullCoverDays))} sub={`PO ETA ${fmtDate(baselineEta)}`} />
        </div>
      )}
      <div className="mt-3 flex items-center justify-between">
        {decision ? (
          <span className="text-[12.5px] text-ink-2">Split approved by {PERSONAS[decision.persona].name}</span>
        ) : (
          <span className="text-[12px] text-ink-3">Routes through human approval, then the agent writes to SAP MM.</span>
        )}
        <Button variant="primary" disabled={!res || ratio === 0 || ratio === 100 || !!decision} onClick={() => setConfirm(true)} data-testid="split-submit">
          Submit split for approval
        </Button>
      </div>
      {decision && (
        <div className="mt-4">
          <ExecutionPanel entries={log.filter((l) => l.decision_id === decision.id)} title={`Split ${line.ebeln}/${line.ebelp}`} />
        </div>
      )}
      <Modal
        open={confirm}
        onClose={() => setConfirm(false)}
        kicker="Approve split PO"
        title={`${line.ebeln} / ${line.ebelp} · ${ratio}/${100 - ratio}`}
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirm(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              data-testid="split-approve"
              onClick={() => {
                approve(context, { id: "SPLIT", name: `Split ${ratio}/${100 - ratio}`, actions });
                setConfirm(false);
              }}
            >
              Approve and execute
            </Button>
          </>
        }
      >
        <div className="mb-3 text-[12.5px]">
          <span className="label mr-2">Approver</span>
          {PERSONAS[persona].name}
        </div>
        <ol className="space-y-2">
          {actions.map((a, i) => (
            <li key={i} className="grid grid-cols-[80px_1fr] gap-2 text-[12.5px]">
              <Tag className="justify-center">{a.system}</Tag>
              <span>{a.label}</span>
            </li>
          ))}
        </ol>
      </Modal>
    </div>
  );
}

function ResultCell({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div>
      <div className="label text-[9.5px]">{label}</div>
      <div className="tnum text-[15px]">{value}</div>
      <div className="tnum text-[11px] text-ink-3">{sub}</div>
    </div>
  );
}
