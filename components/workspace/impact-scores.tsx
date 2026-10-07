"use client";

import { SeverityBar, SeverityNumber } from "@/components/ui/severity";
import { cn } from "@/lib/cn";
import { sgd, usd } from "@/lib/format";
import type { Reasoning } from "@/lib/schema";
import { DIMENSION_LABELS, type Dimension, type ImpactScores } from "@/lib/scoring";

export function ImpactScoresPanel({ scores, reasoning }: { scores: ImpactScores; reasoning: Reasoning | null }) {
  const rows: { dim: Dimension; value: React.ReactNode; title?: string; severity: number; rationale: string; detail: string }[] = [
    {
      dim: "cost",
      value: usd(scores.cost.usd, { compact: true }),
      title: `${usd(scores.cost.usd)} (${sgd(scores.cost.usd)})`,
      severity: scores.cost.severity,
      rationale: reasoning?.impact.cost.rationale ?? scores.cost.rationale,
      detail: `PO ${usd(scores.cost.po_value_usd, { compact: true })} + expedite ${usd(scores.cost.expedite_usd, { compact: true })} + LD ${usd(scores.cost.ld_usd, { compact: true })}`,
    },
    {
      dim: "delay",
      value: `${scores.delay.days}d`,
      severity: scores.delay.severity,
      rationale: reasoning?.impact.delay.rationale ?? scores.delay.rationale,
      detail: "max slip beyond total float",
    },
    {
      dim: "ops",
      value: `${scores.ops.lines}L · ${scores.ops.slots}S`,
      severity: scores.ops.severity,
      rationale: reasoning?.impact.ops.rationale ?? scores.ops.rationale,
      detail: "lines (L) and induction slots (S) at risk",
    },
    {
      dim: "reputation",
      value: usd(scores.reputation.weighted_usd, { compact: true }),
      title: `${usd(scores.reputation.weighted_usd)} weighted (${sgd(scores.reputation.weighted_usd)})`,
      severity: scores.reputation.severity,
      rationale: reasoning?.impact.reputation.rationale ?? scores.reputation.rationale,
      detail: "customer tier weight × LD exposure",
    },
  ];
  return (
    <div data-testid="impact-scores">
      <div className="mb-3 flex items-baseline justify-between">
        <div className="flex items-baseline gap-3">
          <span className="label">Overall severity</span>
          <SeverityNumber value={scores.overall.severity} className="text-[28px] leading-none" />
          <span className="text-[12.5px] text-ink-2">driven by {DIMENSION_LABELS[scores.overall.driver].toLowerCase()}</span>
        </div>
        <span className="text-[11.5px] text-ink-3">Overall is the max, not the mean</span>
      </div>
      <div className="border-t border-rule">
        {rows.map((r) => (
          <div key={r.dim} className={cn("grid grid-cols-[84px_1fr] gap-x-4 border-b border-rule py-3", r.dim === scores.overall.driver && "bg-paper-2/60")}>
            <div>
              <div className="label">{DIMENSION_LABELS[r.dim]}</div>
              <SeverityNumber value={r.severity} className="text-[20px] leading-tight" />
            </div>
            <div className="min-w-0">
              <div className="flex items-baseline justify-between gap-3">
                <span className="tnum whitespace-nowrap text-[14px]" title={r.title}>
                  {r.value}
                </span>
                <span className="truncate text-[11px] text-ink-3">{r.detail}</span>
              </div>
              <SeverityBar value={r.severity} className="my-1.5" />
              <div className="text-[12.5px] leading-snug text-ink-2">{r.rationale}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
