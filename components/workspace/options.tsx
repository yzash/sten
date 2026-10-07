"use client";

import { ChevronDown, ChevronRight } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/field";
import { Modal } from "@/components/ui/modal";
import { RiskDot } from "@/components/ui/severity";
import { Tag } from "@/components/ui/tag";
import { cn } from "@/lib/cn";
import { addDays, sgtDate } from "@/lib/dates";
import { usd } from "@/lib/format";
import { PERSONAS } from "@/lib/personas";
import type { Precedent, Reasoning, ReasoningOption } from "@/lib/schema";
import { useStore } from "@/lib/store";

export function costLabel(n: number) {
  return n < 0 ? `saves ${usd(-n, { compact: true }).replace("USD ", "USD ")}` : usd(n, { compact: true });
}

export function OptionsList({
  context,
  reasoning,
  precedents,
  locked,
  onOpenPrecedent,
}: {
  context: string;
  reasoning: Reasoning;
  precedents: Precedent[];
  locked: boolean;
  onOpenPrecedent: (id: string) => void;
}) {
  const [compare, setCompare] = useState<string[]>([]);
  const [compareOpen, setCompareOpen] = useState(false);
  const [approving, setApproving] = useState<ReasoningOption | null>(null);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [deferOpen, setDeferOpen] = useState(false);
  const toggle = (id: string) => setCompare((c) => (c.includes(id) ? c.filter((x) => x !== id) : c.length >= 3 ? c : [...c, id]));
  const precTitle = (id: string | null) => (id ? precedents.find((p) => p.id === id) : undefined);

  return (
    <div data-testid="options">
      <div className="mb-2 flex items-center justify-between">
        <span className="label">Options · {reasoning.options.length}</span>
        <Button size="sm" variant="ghost" disabled={compare.length < 2} onClick={() => setCompareOpen(true)} data-testid="compare-open">
          Compare {compare.length ? `(${compare.length})` : ""}
        </Button>
      </div>
      <div className="border-t border-rule">
        {reasoning.options.map((o, i) => (
          <OptionCard
            key={o.id}
            o={o}
            rank={i + 1}
            recommended={o.id === reasoning.recommended_id}
            rationale={o.id === reasoning.recommended_id ? reasoning.rationale : undefined}
            checked={compare.includes(o.id)}
            onCheck={() => toggle(o.id)}
            compareFull={compare.length >= 3 && !compare.includes(o.id)}
            onChoose={() => setApproving(o)}
            locked={locked}
            precedent={precTitle(o.precedent_id)}
            onOpenPrecedent={onOpenPrecedent}
          />
        ))}
      </div>
      {!locked && (
        <div className="mt-3 flex gap-2">
          <Button size="sm" variant="ghost" onClick={() => setRejectOpen(true)} data-testid="reject-open">
            Reject all
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setDeferOpen(true)} data-testid="defer-open">
            Defer
          </Button>
        </div>
      )}

      <CompareModal open={compareOpen} onClose={() => setCompareOpen(false)} options={reasoning.options.filter((o) => compare.includes(o.id))} recommendedId={reasoning.recommended_id} />
      <ApproveModal context={context} option={approving} onClose={() => setApproving(null)} />
      <RejectModal context={context} open={rejectOpen} onClose={() => setRejectOpen(false)} />
      <DeferModal context={context} open={deferOpen} onClose={() => setDeferOpen(false)} />
    </div>
  );
}

function OptionCard({
  o,
  rank,
  recommended,
  rationale,
  checked,
  onCheck,
  compareFull,
  onChoose,
  locked,
  precedent,
  onOpenPrecedent,
}: {
  o: ReasoningOption;
  rank: number;
  recommended: boolean;
  rationale?: string;
  checked: boolean;
  onCheck: () => void;
  compareFull: boolean;
  onChoose: () => void;
  locked: boolean;
  precedent?: Precedent;
  onOpenPrecedent: (id: string) => void;
}) {
  const [showActions, setShowActions] = useState(recommended);
  return (
    <div className={cn("relative border-b border-rule py-3.5", recommended && "pl-3")} data-testid={`option-${o.id}`}>
      {recommended && <span className="absolute inset-y-3 left-0 w-[2px] bg-accent" />}
      <div className="flex items-start gap-2.5">
        <input
          type="checkbox"
          className="mt-1 accent-[var(--ink)]"
          checked={checked}
          disabled={compareFull}
          onChange={onCheck}
          aria-label={`Compare ${o.name}`}
          title={compareFull ? "Compare up to three" : "Add to compare"}
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            <span className="mono text-[11px] text-ink-3">{rank}</span>
            <span className={cn("text-[14px] font-medium leading-snug", recommended && "text-ink")}>{o.name}</span>
          </div>
          {recommended && (
            <div className="mono mt-1 text-[10px] uppercase tracking-[0.06em] text-accent" data-testid="recommended-marker">
              Recommended
            </div>
          )}
          <p className="mt-1 text-[12.5px] leading-snug text-ink-2">{o.mechanism}</p>
          <div className="mt-2.5 grid grid-cols-4 gap-2 text-[12px]">
            <Metric label="Cost" value={costLabel(o.cost_usd)} title={usd(o.cost_usd)} />
            <Metric label="Residual" value={`${o.residual_delay_days}d`} />
            <Metric label="Risk" value={<RiskDot risk={o.risk} />} />
            <Metric label="Speed" value={`${o.speed_days}d`} />
          </div>
          {rationale && <p className="accent-line mt-3 text-[14px] leading-snug text-ink">{rationale}</p>}
          <div className="mt-2.5 flex items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-3">
              <button onClick={() => setShowActions(!showActions)} className="flex items-center gap-1 text-[12px] text-ink-2 hover:text-ink">
                {showActions ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                {o.actions.length} agent action{o.actions.length === 1 ? "" : "s"}
              </button>
              {precedent && (
                <button onClick={() => onOpenPrecedent(precedent.id)} className="truncate text-[12px] text-ink-2 underline decoration-rule-2 underline-offset-2 hover:text-ink" title={precedent.title}>
                  {precedent.id} · {precedent.year}
                </button>
              )}
            </div>
            {!locked && (
              <Button size="sm" variant={recommended ? "primary" : "secondary"} onClick={onChoose} data-testid={`choose-${o.id}`}>
                Choose
              </Button>
            )}
          </div>
          {showActions && (
            <ul className="mt-2 space-y-1 border-l border-rule pl-3">
              {o.actions.map((a, i) => (
                <li key={i} className="flex gap-2 text-[12px]">
                  <Tag tone="muted" className="w-[68px] justify-center">
                    {a.system}
                  </Tag>
                  <span className="text-ink-2">{a.label}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

function Metric({ label, value, title }: { label: string; value: React.ReactNode; title?: string }) {
  return (
    <div title={title}>
      <div className="label text-[9.5px]">{label}</div>
      <div className="tnum mt-0.5">{value}</div>
    </div>
  );
}

function CompareModal({ open, onClose, options, recommendedId }: { open: boolean; onClose: () => void; options: ReasoningOption[]; recommendedId: string }) {
  const rows: [string, (o: ReasoningOption) => React.ReactNode][] = [
    ["Mechanism", (o) => <span className="text-ink-2">{o.mechanism}</span>],
    ["Total cost", (o) => <span className="tnum">{usd(o.cost_usd)}</span>],
    ["Residual delay", (o) => <span className="tnum">{o.residual_delay_days}d</span>],
    ["Risk", (o) => <RiskDot risk={o.risk} />],
    ["Speed to effect", (o) => <span className="tnum">{o.speed_days}d</span>],
    ["Precedent", (o) => <span className="mono">{o.precedent_id ?? "none"}</span>],
    ["Systems touched", (o) => [...new Set(o.actions.map((a) => a.system))].join(", ")],
    ["Agent actions", (o) => <ul className="space-y-1">{o.actions.map((a, i) => <li key={i} className="text-ink-2">{a.label}</li>)}</ul>],
  ];
  return (
    <Modal open={open} onClose={onClose} kicker="Option compare" title="Side by side" width={Math.min(1100, 260 + options.length * 280)}>
      <table className="w-full text-[12.5px]" data-testid="compare-table">
        <thead>
          <tr className="border-b border-rule">
            <th className="w-[140px]" />
            {options.map((o) => (
              <th key={o.id} className="px-3 pb-2 text-left align-bottom font-medium">
                {o.id === recommendedId && <div className="mono mb-0.5 text-[10px] uppercase tracking-[0.06em] text-accent">Recommended</div>}
                <span className="text-[13.5px]">{o.name}</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map(([label, f]) => (
            <tr key={label} className="border-b border-rule align-top">
              <td className="label py-2.5 pr-2">{label}</td>
              {options.map((o) => (
                <td key={o.id} className="px-3 py-2.5">
                  {f(o)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </Modal>
  );
}

function ApproveModal({ context, option, onClose }: { context: string; option: ReasoningOption | null; onClose: () => void }) {
  const approve = useStore((s) => s.approve);
  const persona = useStore((s) => s.persona);
  const [note, setNote] = useState("");
  if (!option) return null;
  const systems = [...new Set(option.actions.map((a) => a.system))];
  return (
    <Modal
      open
      onClose={onClose}
      kicker={`Approve ${option.id}`}
      title={option.name}
      width={640}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            data-testid="approve-confirm"
            onClick={() => {
              approve(context, { id: option.id, name: option.name, actions: option.actions }, note || undefined);
              setNote("");
              onClose();
            }}
          >
            Approve and execute {option.actions.length} action{option.actions.length === 1 ? "" : "s"}
          </Button>
        </>
      }
    >
      <p className="mb-4 text-[13px] text-ink-2">
        On approval the agent writes these actions to the systems below, in order. In this prototype every write lands in a mock adapter and the execution log, never in a live system.
      </p>
      <div className="mb-4 grid grid-cols-3 gap-4 border-y border-rule py-3 text-[12.5px]">
        <div>
          <div className="label mb-0.5">Approver</div>
          {PERSONAS[persona].name}
          <div className="text-[11.5px] text-ink-3">{PERSONAS[persona].role}</div>
        </div>
        <div>
          <div className="label mb-0.5">Systems touched</div>
          {systems.join(", ")}
        </div>
        <div>
          <div className="label mb-0.5">Cost</div>
          <span className="tnum">{usd(option.cost_usd)}</span>
        </div>
      </div>
      <ol className="space-y-3">
        {option.actions.map((a, i) => (
          <li key={i} className="grid grid-cols-[24px_80px_1fr] gap-2 text-[12.5px]">
            <span className="mono text-ink-3">{i + 1}</span>
            <Tag className="justify-center">{a.system}</Tag>
            <div>
              <div>{a.label}</div>
              <pre className="mono mt-1 max-h-[120px] overflow-auto bg-paper-2 px-2 py-1.5 text-[10.5px] leading-relaxed text-ink-2">{JSON.stringify({ action: a.action, ...a.payload }, null, 1)}</pre>
            </div>
          </li>
        ))}
      </ol>
      <div className="mt-4">
        <Field label="Note for the log (optional)">
          <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. confirmed Meridian capacity by phone" />
        </Field>
      </div>
    </Modal>
  );
}

function RejectModal({ context, open, onClose }: { context: string; open: boolean; onClose: () => void }) {
  const reject = useStore((s) => s.reject);
  const [reason, setReason] = useState("");
  return (
    <Modal
      open={open}
      onClose={onClose}
      kicker="Reject all options"
      title="Why do none of these work?"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="danger"
            disabled={reason.trim().length < 3}
            onClick={() => {
              reject(context, reason.trim());
              setReason("");
              onClose();
            }}
          >
            Reject and log
          </Button>
        </>
      }
    >
      <Field label="Reason" hint="Goes to the execution log and the feedback export.">
        <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Meridian cannot ramp; customer will not accept PMA" />
      </Field>
    </Modal>
  );
}

function DeferModal({ context, open, onClose }: { context: string; open: boolean; onClose: () => void }) {
  const defer = useStore((s) => s.defer);
  const clock = useStore((s) => s.clock);
  const [date, setDate] = useState(addDays(sgtDate(clock), 2));
  const [reason, setReason] = useState("");
  return (
    <Modal
      open={open}
      onClose={onClose}
      kicker="Defer decision"
      title="When should this come back?"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="secondary"
            onClick={() => {
              defer(context, date, reason.trim());
              setReason("");
              onClose();
            }}
          >
            Defer and log
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <Field label="Follow-up date">
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
        <Field label="Reason">
          <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. waiting for receiver's WIP count on 10 Oct" />
        </Field>
      </div>
    </Modal>
  );
}
