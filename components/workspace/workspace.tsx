"use client";

import { ArrowLeft, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { PhaseBanner, SectionHead } from "@/components/ui/section";
import { SeverityNumber } from "@/components/ui/severity";
import { Tag } from "@/components/ui/tag";
import { cn } from "@/lib/cn";
import { fmtDate, fmtSgt } from "@/lib/dates";
import { PERSONAS } from "@/lib/personas";
import { DISRUPTION_LABELS } from "@/lib/schema";
import { DIMENSION_LABELS } from "@/lib/scoring";
import { useStore } from "@/lib/store";
import type { WorkspaceData } from "@/lib/workspace-data";
import { AskPanel } from "./ask-panel";
import { ClassificationCard } from "./classification";
import { ExecutionPanel } from "./execution-panel";
import { ImpactGraph } from "./impact-graph";
import { ImpactScoresPanel } from "./impact-scores";
import { OptionsList } from "./options";
import { PrecedentModal } from "./precedent-modal";

const CHECKPOINT_LABEL: Record<WorkspaceData["signal"]["checkpoint"], string> = {
  sourcing: "Checkpoint 1 · Sourcing",
  purchasing: "Checkpoint 2 · Purchasing",
  shipment: "Checkpoint 3 · Shipment",
  warehouse: "Checkpoint 4 · Warehouse",
  relationships: "Checkpoint 5 · Invoice and Pay",
};

export function Workspace({ data, stub, draft }: { data: WorkspaceData; stub?: { title: string; banner: string }; draft?: boolean }) {
  const { signal, scores, reasoning, chain, precedents } = data;
  const [leftOpen, setLeftOpen] = useState(true);
  const [precedentId, setPrecedentId] = useState<string | null>(null);
  const allDecisions = useStore((s) => s.decisions);
  const decisions = useMemo(() => allDecisions.filter((d) => d.context === signal.id && ["approve", "reject", "defer"].includes(d.kind)), [allDecisions, signal.id]);
  const log = useStore((s) => s.log);
  const override = useStore((s) => s.overrides[signal.id]);
  const latest = decisions[0];
  const approved = decisions.find((d) => d.kind === "approve");
  const entries = approved ? log.filter((l) => l.decision_id === approved.id) : [];
  const material = override?.material ?? signal.disposition === "material";
  const hasImpact = data.exposure.material;

  return (
    <div className="flex min-h-[calc(100vh-56px)] flex-col">
      {stub && <PhaseBanner>{stub.banner}</PhaseBanner>}
      <div className="flex items-center gap-4 border-b border-rule px-6 py-3">
        <Link href={stub ? "/signals" : "/signals"} className="flex items-center gap-1.5 text-[12.5px] text-ink-2 hover:text-ink">
          <ArrowLeft size={13} /> Signals
        </Link>
        <span className="text-rule-2">/</span>
        <span className="mono text-[12.5px]">{signal.id}</span>
        <span className="label">{stub?.title ?? CHECKPOINT_LABEL[signal.checkpoint]}</span>
        <span className="text-[12.5px] text-ink-2">{DISRUPTION_LABELS[override?.type ?? signal.type]}</span>
        <div className="ml-auto flex items-center gap-5">
          {latest && <DecisionStatus d={latest} />}
          {hasImpact && (
            <span className="flex items-baseline gap-2">
              <span className="label">Severity</span>
              <SeverityNumber value={scores.overall.severity} className="text-[16px]" />
              <span className="text-[12px] text-ink-3">{DIMENSION_LABELS[scores.overall.driver].toLowerCase()}</span>
            </span>
          )}
        </div>
      </div>

      <div
        className={cn(
          "grid flex-1",
          leftOpen ? "grid-cols-[320px_minmax(0,1fr)] min-[1440px]:grid-cols-[360px_minmax(0,1fr)_400px]" : "grid-cols-[44px_minmax(0,1fr)] min-[1440px]:grid-cols-[44px_minmax(0,1fr)_400px]",
        )}
      >
        {/* Left: signal and classification */}
        <aside className="row-span-2 border-r border-rule min-[1440px]:row-span-1">
          <div className="sticky top-14 max-h-[calc(100vh-56px)] overflow-y-auto">
            <div className={cn("flex h-9 items-center border-b border-rule", leftOpen ? "justify-between px-5" : "justify-center")}>
              {leftOpen && <span className="label">Signal and classification</span>}
              <button onClick={() => setLeftOpen(!leftOpen)} aria-label={leftOpen ? "Collapse signal column" : "Expand signal column"} className="text-ink-3 hover:text-ink">
                {leftOpen ? <PanelLeftClose size={14} /> : <PanelLeftOpen size={14} />}
              </button>
            </div>
            {leftOpen && (
              <div className="px-5 py-5">
                <ClassificationCard data={data} draft={draft} />
                {precedents.length > 0 && (
                  <div className="mt-5 border-t border-rule pt-4">
                    <div className="label mb-2">Precedents · what did we do last time</div>
                    <ul className="space-y-1.5">
                      {precedents.slice(0, 4).map((p) => (
                        <li key={p.id}>
                          <button onClick={() => setPrecedentId(p.id)} className="text-left text-[12.5px] hover:underline" data-testid={`precedent-${p.id}`}>
                            <span className="mono mr-2 text-[11px] text-ink-3">
                              {p.id} · {p.year}
                            </span>
                            {p.title}
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>
        </aside>

        {/* Centre: impact */}
        <section className="min-w-0 px-6 py-5">
          {hasImpact ? (
            <>
              <SectionHead label="Impact assessment · step 4" right={<span className="text-[11.5px] text-ink-3">deterministic, auditable</span>} />
              <div className="pt-4">
                <ImpactScoresPanel scores={scores} reasoning={reasoning} />
              </div>
              <SectionHead label="Impact chain" className="mt-6" right={<span className="text-[11.5px] text-ink-3">{chain.lines.length} PO lines · {chain.workOrders.length} work orders</span>} />
              <div className="pt-3">
                <ImpactGraph nodes={chain.nodes} edges={chain.edges} />
              </div>
              {chain.workOrders.length > 0 && <WorkOrderTable data={data} />}
              {reasoning && (
                <>
                  <SectionHead label="Ask" className="mt-6" right={<span className="text-[11.5px] text-ink-3">answers prebuilt per signal</span>} />
                  <div className="pt-3">
                    <p className="mb-3 text-[13px] leading-relaxed text-ink-2">{reasoning.summary}</p>
                    <AskPanel reasoning={reasoning} />
                  </div>
                </>
              )}
            </>
          ) : (
            <FilteredOut data={data} />
          )}
        </section>

        {/* Right: options and execution */}
        <section className="col-start-2 border-t border-rule px-6 py-5 min-[1440px]:col-start-3 min-[1440px]:border-l min-[1440px]:border-t-0 min-[1440px]:px-5">
          <SectionHead label="Options and execution · steps 5 and 6" />
          <div className="space-y-5 pt-4">
            {approved && <ExecutionPanel entries={entries} title={`${approved.option_id} approved by ${PERSONAS[approved.persona].name}`} />}
            {hasImpact && material && reasoning ? (
              <OptionsList context={signal.id} reasoning={reasoning} precedents={precedents} locked={!!approved} onOpenPrecedent={setPrecedentId} />
            ) : hasImpact && material ? (
              <div className="border border-dashed border-rule-2 p-4 text-[13px] text-ink-2">
                <div className="label mb-1.5">Options need the reasoning service</div>
                Exposure and impact above are computed live. Options and rationale are generated at build time for library signals; for a free-text draft the production service would generate them against the same schema in a few seconds.
              </div>
            ) : (
              <div className="border border-dashed border-rule-2 p-4 text-[13px] text-ink-2">
                <div className="label mb-1.5">Nothing to act on</div>
                {hasImpact ? "An analyst marked this signal not material. Undo the override to bring the options back." : "This signal touches no open PO, approved supplier or in-transit shipment, so no response options are generated. An analyst can override materiality if the filter missed something."}
              </div>
            )}
          </div>
        </section>
      </div>
      <PrecedentModal precedent={precedents.find((p) => p.id === precedentId) ?? null} onClose={() => setPrecedentId(null)} names={data.names.suppliers} />
    </div>
  );
}

function DecisionStatus({ d }: { d: ReturnType<typeof useStore.getState>["decisions"][number] }) {
  const who = PERSONAS[d.persona].name;
  if (d.kind === "approve") return <Tag tone="default">{`Approved ${d.option_id} · ${who}`}</Tag>;
  if (d.kind === "reject") return <Tag tone="muted" title={d.reason}>{`Rejected · ${who}`}</Tag>;
  return <Tag tone="muted" title={d.reason}>{`Deferred to ${d.follow_up ? fmtDate(d.follow_up) : "later"} · ${who}`}</Tag>;
}

function WorkOrderTable({ data }: { data: WorkspaceData }) {
  return (
    <table className="mt-4 w-full text-[12.5px]">
      <thead>
        <tr className="border-b border-rule">
          {["WO", "Customer", "Induct", "Slip", "Float", "Redelivery"].map((h, i) => (
            <th key={h} className={cn("label py-1.5 pr-2 font-normal", i >= 3 ? "text-right" : "text-left")}>
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {data.chain.workOrders.map((w) => {
          const hot = w.beyond_float_days > 0;
          return (
            <tr key={w.wo.id} className="h-9 border-b border-rule">
              <td className="mono">{w.wo.id}</td>
              <td>
                {w.customer.name} <span className="text-[11px] text-ink-3">{w.customer.tier}</span>
              </td>
              <td className="tnum">{fmtDate(w.wo.induction_date)}</td>
              <td className="tnum text-right">{w.slip_days}d</td>
              <td className="tnum text-right">{w.wo.float_days}d</td>
              <td className={cn("tnum text-right", hot && "text-accent")}>{hot ? `+${w.beyond_float_days}d · ${fmtDate(w.new_redelivery)}` : "holds"}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function FilteredOut({ data }: { data: WorkspaceData }) {
  const s = data.signal;
  const checks = [
    { label: "(a) Open PO lines with named suppliers", on: s.affected_supplier_ids.length > 0 },
    { label: "(b) Open PO lines with suppliers in the affected region", on: s.affected_regions.length > 0 },
    { label: "(c) In-transit shipments through the affected corridor", on: s.affected_corridors.length > 0 },
  ];
  return (
    <div data-testid="filtered-out">
      <SectionHead label="Material-impact filter" />
      <div className="max-w-[560px] pt-5">
        <div className="label mb-1">Filtered out</div>
        <h2 className="mb-2 text-[18px] font-medium">{s.discard_reason ?? "No exposure found"}</h2>
        <p className="mb-5 text-[13px] text-ink-2">
          The signal was classified and checked against open POs, approved suppliers and in-transit shipments at {fmtSgt(s.received_at)}. Each check below came back empty, so it stays in the feed for audit and generates no work.
        </p>
        <ul className="border-t border-rule">
          {checks.map((c) => (
            <li key={c.label} className="flex items-center justify-between border-b border-rule py-2.5 text-[13px]">
              <span>{c.label}</span>
              <span className="mono text-[11px] text-ink-3">{c.on ? "checked · 0 found" : "not applicable"}</span>
            </li>
          ))}
        </ul>
        {(s.affected_regions.length > 0 || s.affected_corridors.length > 0) && (
          <p className="mt-4 text-[12.5px] text-ink-3">
            Scope read from the signal: {[...s.affected_regions.map((r) => `region ${r}`), ...s.affected_corridors.map((c) => `corridor ${c}`)].join(", ")}.
          </p>
        )}
      </div>
    </div>
  );
}
