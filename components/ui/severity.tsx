import { cn } from "@/lib/cn";
import { severityLevel, type SeverityLevel } from "@/lib/scoring";
import type { Risk } from "@/lib/schema";

export const SEV_BG: Record<SeverityLevel, string> = {
  low: "bg-sev-low",
  medium: "bg-sev-medium",
  high: "bg-sev-high",
  critical: "bg-sev-critical",
};
export const SEV_TEXT: Record<SeverityLevel, string> = {
  low: "text-sev-low",
  medium: "text-sev-medium",
  high: "text-sev-high",
  critical: "text-sev-critical",
};

export function SeverityBar({ value, className }: { value: number; className?: string }) {
  const lvl = severityLevel(value);
  return (
    <div className={cn("relative h-[3px] w-full bg-rule", className)} aria-label={`severity ${value} of 100`}>
      <div className={cn("absolute inset-y-0 left-0", SEV_BG[lvl])} style={{ width: `${Math.max(2, value)}%` }} />
      {[25, 50, 75].map((t) => (
        <div key={t} className="absolute inset-y-[-2px] w-px bg-paper" style={{ left: `${t}%` }} />
      ))}
    </div>
  );
}

export function SeverityNumber({ value, className }: { value: number; className?: string }) {
  return <span className={cn("tnum", SEV_TEXT[severityLevel(value)], className)}>{value}</span>;
}

const RISK_LEVEL: Record<Risk, SeverityLevel> = { low: "low", medium: "medium", high: "high" };
export function RiskDot({ risk, className }: { risk: Risk; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5", className)}>
      <span className={cn("inline-block h-[7px] w-[7px]", SEV_BG[RISK_LEVEL[risk]])} />
      <span className="text-ink-2 capitalize">{risk}</span>
    </span>
  );
}
