import { cn } from "@/lib/cn";
import type { ReactNode } from "react";

export function SectionHead({ label, right, className }: { label: string; right?: ReactNode; className?: string }) {
  return (
    <div className={cn("flex h-9 items-center justify-between border-b border-rule", className)}>
      <span className="label">{label}</span>
      {right}
    </div>
  );
}

export function PageHeader({ kicker, title, sub, right }: { kicker: string; title: string; sub?: ReactNode; right?: ReactNode }) {
  return (
    <div className="flex items-end justify-between gap-6 border-b border-rule px-8 pb-5 pt-7">
      <div>
        <div className="label mb-2">{kicker}</div>
        <h1 className="text-[26px] font-medium leading-tight tracking-[-0.02em]">{title}</h1>
        {sub && <div className="mt-1.5 max-w-[760px] text-[13.5px] text-ink-2">{sub}</div>}
      </div>
      {right && <div className="flex shrink-0 items-center gap-2">{right}</div>}
    </div>
  );
}

export function Stat({ label, value, sub }: { label: string; value: ReactNode; sub?: ReactNode }) {
  return (
    <div className="min-w-[120px]">
      <div className="label mb-1">{label}</div>
      <div className="tnum text-[20px] leading-none">{value}</div>
      {sub && <div className="mt-1 text-[12px] text-ink-3">{sub}</div>}
    </div>
  );
}

export function PhaseBanner({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-center gap-3 border-b border-rule bg-paper-2 px-8 py-2.5">
      <span className="mono border border-ink-2 px-1.5 py-px text-[10px] uppercase tracking-[0.06em] text-ink-2">Phase 2</span>
      <span className="accent-line text-[14.5px] text-ink-2">{children}</span>
    </div>
  );
}
