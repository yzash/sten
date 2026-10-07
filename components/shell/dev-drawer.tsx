"use client";

import { X } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { fmtSgt } from "@/lib/dates";
import { DEFAULT_CLOCK } from "@/lib/personas";
import { useStore } from "@/lib/store";

export function DevDrawer() {
  const open = useStore((s) => s.devOpen);
  const setOpen = useStore((s) => s.setDevOpen);
  const clock = useStore((s) => s.clock);
  const setClock = useStore((s) => s.setClock);
  const advance = useStore((s) => s.advanceClock);
  const reset = useStore((s) => s.resetDemo);
  const [confirm, setConfirm] = useState(false);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50" onMouseDown={() => setOpen(false)}>
      <aside
        className="absolute right-0 top-0 h-full w-[360px] border-l border-rule-2 bg-paper"
        onMouseDown={(e) => e.stopPropagation()}
        aria-label="Demo controls"
      >
        <div className="flex items-center justify-between border-b border-rule px-5 py-4">
          <div>
            <div className="label">Dev drawer</div>
            <div className="text-[16px] font-medium">Demo controls</div>
          </div>
          <button onClick={() => setOpen(false)} aria-label="Close" className="text-ink-3 hover:text-ink">
            <X size={16} />
          </button>
        </div>
        <div className="space-y-6 px-5 py-5">
          <section>
            <div className="label mb-2">Simulated clock</div>
            <div className="tnum mb-3 text-[22px]">{fmtSgt(clock)} SGT</div>
            <p className="mb-3 text-[12.5px] text-ink-2">Signals received after the clock stay hidden. Rewind, then step forward to replay the last 72 hours as they arrived.</p>
            <div className="grid grid-cols-3 gap-2">
              <Button size="sm" onClick={() => setClock(new Date(Date.parse(DEFAULT_CLOCK) - 72 * 3_600_000).toISOString())}>
                Rewind 72h
              </Button>
              <Button size="sm" onClick={() => advance(1)}>
                +1h
              </Button>
              <Button size="sm" onClick={() => advance(6)}>
                +6h
              </Button>
              <Button size="sm" onClick={() => advance(24)}>
                +24h
              </Button>
              <Button size="sm" className="col-span-2" onClick={() => setClock(DEFAULT_CLOCK)}>
                Back to 7 Oct 08:30
              </Button>
            </div>
          </section>
          <section className="border-t border-rule pt-5">
            <div className="label mb-2">Reset demo</div>
            <p className="mb-3 text-[12.5px] text-ink-2">Clears decisions, the execution log, injected signals, overrides and feedback notes in this browser. Export feedback first.</p>
            {confirm ? (
              <div className="flex gap-2">
                <Button
                  variant="danger"
                  size="sm"
                  onClick={() => {
                    reset();
                    setConfirm(false);
                    setOpen(false);
                  }}
                  data-testid="reset-confirm"
                >
                  Clear everything
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setConfirm(false)}>
                  Keep
                </Button>
              </div>
            ) : (
              <Button size="sm" onClick={() => setConfirm(true)} data-testid="reset-demo">
                Reset demo
              </Button>
            )}
          </section>
          <section className="border-t border-rule pt-5 text-[12px] text-ink-3">
            Reasoning is prebuilt at build time; this prototype makes no live model calls. State lives in localStorage under a versioned key.
          </section>
        </div>
      </aside>
    </div>
  );
}
