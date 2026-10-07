"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useState } from "react";
import { Tag } from "@/components/ui/tag";
import { cn } from "@/lib/cn";
import { fmtSgt } from "@/lib/dates";
import type { ExecStatus, ExecutionAction } from "@/lib/schema";

export const STATUS_STYLE: Record<ExecStatus, string> = {
  queued: "text-st-queued border-st-queued/50",
  writing: "text-st-writing border-st-writing",
  written: "text-st-writing border-st-writing/60",
  confirmed: "text-st-confirmed border-st-confirmed/60",
  failed: "text-st-failed border-st-failed/60",
};

export function StatusPill({ status }: { status: ExecStatus }) {
  return (
    <motion.span
      key={status}
      initial={{ opacity: 0.3 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.2, ease: "easeOut" }}
      className={cn("mono inline-flex h-[18px] items-center border px-1.5 text-[10px] uppercase tracking-[0.04em]", STATUS_STYLE[status])}
      data-status={status}
    >
      {status === "writing" && <span className="mr-1 inline-block h-1.5 w-1.5 animate-pulse bg-st-writing" />}
      {status}
    </motion.span>
  );
}

export function ExecutionPanel({ entries, title }: { entries: ExecutionAction[]; title: string }) {
  const ordered = [...entries].sort((a, b) => a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id));
  const agent = ordered.filter((e) => e.actor === "agent");
  const done = agent.filter((e) => e.status === "confirmed").length;
  return (
    <div className="border border-rule-2" data-testid="execution-panel">
      <div className="flex items-center justify-between border-b border-rule px-3 py-2.5">
        <div>
          <div className="label">Agent execution</div>
          <div className="text-[13px]">{title}</div>
        </div>
        <span className="tnum text-[12px] text-ink-2">
          {done}/{agent.length} confirmed
        </span>
      </div>
      <ul>
        <AnimatePresence initial={false}>
          {agent.map((e) => (
            <ExecRow key={e.id} e={e} />
          ))}
        </AnimatePresence>
      </ul>
      <div className="border-t border-rule px-3 py-2 text-[11.5px] text-ink-3">Writes land in the SAP write log. Mock adapters only; nothing reaches a live system.</div>
    </div>
  );
}

function ExecRow({ e }: { e: ExecutionAction }) {
  const [open, setOpen] = useState(false);
  return (
    <motion.li layout initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }} className="border-b border-rule px-3 py-2.5 last:border-b-0">
      <div className="flex items-start gap-2">
        <Tag tone="muted" className="mt-px w-[68px] justify-center">
          {e.system}
        </Tag>
        <button onClick={() => setOpen(!open)} className="min-w-0 flex-1 text-left text-[12.5px] leading-snug">
          {e.label}
        </button>
        <StatusPill status={e.status} />
      </div>
      <div className="mt-1 flex gap-3 pl-[76px] text-[11px] text-ink-3">
        <span className="mono">{e.doc_number ?? "doc pending"}</span>
        <span className="tnum">{fmtSgt(e.updated_at, { seconds: true })}</span>
        <span className="mono">{e.action}</span>
      </div>
      {open && <pre className="mono ml-[76px] mt-1.5 max-h-[160px] overflow-auto bg-paper-2 px-2 py-1.5 text-[10.5px] text-ink-2">{JSON.stringify(e.payload, null, 1)}</pre>}
    </motion.li>
  );
}
