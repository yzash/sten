"use client";

import { Download } from "lucide-react";
import Link from "next/link";
import { Fragment, useState } from "react";
import { StatusPill } from "@/components/workspace/execution-panel";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/field";
import { PageHeader } from "@/components/ui/section";
import { Tag } from "@/components/ui/tag";
import { cn } from "@/lib/cn";
import { downloadCsv } from "@/lib/csv";
import { fmtSgt } from "@/lib/dates";
import { useStore } from "@/lib/store";

export function ExecutionLog() {
  const log = useStore((s) => s.log);
  const hydrated = useStore((s) => s.hydrated);
  const [system, setSystem] = useState("");
  const [actor, setActor] = useState("");
  const [status, setStatus] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  const rows = log.filter((l) => (!system || l.system === system) && (!actor || l.actor === actor) && (!status || l.status === status));
  const systems = [...new Set(log.map((l) => l.system))];
  const sapWrites = log.filter((l) => l.actor === "agent" && l.system.startsWith("SAP") && l.doc_number).length;

  return (
    <div>
      <PageHeader
        kicker="Audit · SAP write log"
        title="Execution Log"
        sub="Every human decision and every agent action, with the system it touched, the document number returned and the payload written. Writes go to mock adapters with the production interface."
        right={
          <Button
            onClick={() =>
              downloadCsv(
                "execution-log.csv",
                rows.map((l) => ({ time_sgt: fmtSgt(l.updated_at, { seconds: true }), actor: l.actor, actor_name: l.actor_name, system: l.system, action: l.action, label: l.label, document_number: l.doc_number ?? "", status: l.status, context: l.context, decision_id: l.decision_id, payload: l.payload })),
              )
            }
            disabled={rows.length === 0}
            data-testid="log-export"
          >
            <Download size={14} /> Export CSV
          </Button>
        }
      />
      <div className="flex items-center gap-2 border-b border-rule px-8 py-3">
        <Select value={actor} onChange={(e) => setActor(e.target.value)} aria-label="Actor" className="w-[140px]">
          <option value="">Human and agent</option>
          <option value="human">Human</option>
          <option value="agent">Agent</option>
        </Select>
        <Select value={system} onChange={(e) => setSystem(e.target.value)} aria-label="System" className="w-[150px]">
          <option value="">All systems</option>
          {systems.map((s) => (
            <option key={s}>{s}</option>
          ))}
        </Select>
        <Select value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Status" className="w-[140px]">
          <option value="">Any status</option>
          {["queued", "writing", "written", "confirmed", "failed"].map((s) => (
            <option key={s}>{s}</option>
          ))}
        </Select>
        <span className="tnum ml-auto text-[12.5px] text-ink-3">
          {rows.length} entries · {sapWrites} SAP writes
        </span>
      </div>
      <div className="px-8 pb-12">
        {!hydrated ? null : log.length === 0 ? (
          <div className="py-12">
            <div className="label mb-2">Nothing executed yet</div>
            <p className="max-w-[520px] text-[13.5px] text-ink-2">
              Approve an option on a signal, a split PO or a diversification recommendation, and every agent action lands here with its status, document number and payload.{" "}
              <Link href="/signals/SIG-0007" className="underline">
                Open the Aerotech case
              </Link>
              .
            </p>
          </div>
        ) : (
          <table className="w-full text-[12.5px]" data-testid="log-table">
            <thead>
              <tr className="border-b border-rule">
                {["Time (SGT)", "Actor", "System", "Action", "Document", "Status", "Context"].map((h) => (
                  <th key={h} className="label py-2 text-left font-normal">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((l) => (
                <Fragment key={l.id}>
                  <tr className={cn("h-9 cursor-pointer border-b border-rule hover:bg-paper-2", open === l.id && "bg-paper-2")} onClick={() => setOpen(open === l.id ? null : l.id)}>
                    <td className="tnum whitespace-nowrap pr-3">{fmtSgt(l.updated_at, { seconds: true })}</td>
                    <td className="pr-3">
                      <span className="capitalize">{l.actor}</span> <span className="text-ink-3">{l.actor_name}</span>
                    </td>
                    <td className="pr-3">
                      <Tag tone="muted">{l.system}</Tag>
                    </td>
                    <td className="max-w-[420px] pr-3">{l.label}</td>
                    <td className="mono pr-3 text-[11.5px]">{l.doc_number ?? <span className="text-ink-3">none</span>}</td>
                    <td className="pr-3">
                      <StatusPill status={l.status} />
                    </td>
                    <td className="mono text-[11.5px]">
                      {l.context.startsWith("SIG") || l.context.startsWith("LIB") || l.context.startsWith("DRAFT") ? (
                        <Link href={`/signals/${l.context}`} className="hover:underline" onClick={(e) => e.stopPropagation()}>
                          {l.context}
                        </Link>
                      ) : (
                        l.context
                      )}
                    </td>
                  </tr>
                  {open === l.id && (
                    <tr className="border-b border-rule bg-paper-2">
                      <td colSpan={7} className="px-3 pb-3">
                        <div className="mono mb-1 text-[11px] text-ink-3">
                          {l.action} · decision {l.decision_id}
                        </div>
                        <pre className="mono overflow-auto text-[11px] text-ink-2">{JSON.stringify(l.payload, null, 2)}</pre>
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
