"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Gauge, Handshake, MessageSquareText, Plane, Radio, ScrollText, ShoppingCart, Telescope, Warehouse } from "lucide-react";
import { cn } from "@/lib/cn";
import { useStore } from "@/lib/store";

const MAIN = [
  { href: "/signals", label: "Signals", icon: Radio },
  { href: "/scorecard", label: "Risk Scorecard", icon: Gauge },
  { href: "/purchasing", label: "Purchasing", icon: ShoppingCart },
  { href: "/shipment", label: "Shipment", icon: Plane, stub: true },
  { href: "/warehouse", label: "Warehouse", icon: Warehouse, stub: true },
  { href: "/relationships", label: "Relationships", icon: Handshake, stub: true },
];
const LOWER = [
  { href: "/predict", label: "Predict", icon: Telescope },
  { href: "/log", label: "Execution Log", icon: ScrollText },
];

export function Rail() {
  const path = usePathname();
  const logCount = useStore((s) => s.log.length);
  const fbCount = useStore((s) => s.feedback.length);
  const active = (href: string) => path === href || path.startsWith(`${href}/`) || (href === "/scorecard" && path.startsWith("/suppliers"));
  const item = (it: { href: string; label: string; icon: typeof Radio; stub?: boolean }, count?: number) => (
    <Link
      key={it.href}
      href={it.href}
      className={cn(
        "group relative flex h-9 items-center gap-3 px-5 text-[13.5px] transition-colors",
        active(it.href) ? "text-ink" : "text-ink-2 hover:text-ink",
      )}
    >
      {active(it.href) && <span className="absolute inset-y-1.5 left-0 w-[2px] bg-ink" />}
      <it.icon size={15} strokeWidth={1.5} className={active(it.href) ? "text-ink" : "text-ink-3 group-hover:text-ink-2"} />
      <span className="flex-1">{it.label}</span>
      {it.stub && <span className="mono text-[9.5px] uppercase tracking-[0.06em] text-ink-3">Stub</span>}
      {count ? <span className="tnum text-[11px] text-ink-3">{count}</span> : null}
    </Link>
  );
  return (
    <nav aria-label="Primary" className="fixed inset-y-0 left-0 z-30 flex w-[240px] flex-col border-r border-rule bg-paper">
      <Link href="/signals" className="flex h-14 items-center gap-2.5 border-b border-rule px-5">
        <span className="grid h-6 w-6 place-items-center bg-ink text-[11px] font-semibold text-paper">SR</span>
        <span className="text-[14px] font-medium tracking-[-0.01em]">Supplier Resilience</span>
      </Link>
      <div className="label px-5 pb-2 pt-5">Checkpoints</div>
      <div className="flex flex-col">{MAIN.map((m) => item(m))}</div>
      <div className="mx-5 my-4 border-t border-rule" />
      <div className="flex flex-col">{LOWER.map((m) => item(m, m.href === "/log" ? logCount : undefined))}</div>
      <div className="mt-auto border-t border-rule">
        {item({ href: "/feedback", label: "Feedback", icon: MessageSquareText }, fbCount)}
        <div className="px-5 pb-4 pt-1 text-[11.5px] leading-snug text-ink-3">
          Built by DevX for the 13 Oct walkthrough. No live system connections.
        </div>
      </div>
    </nav>
  );
}
