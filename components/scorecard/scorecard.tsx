"use client";

import { ArrowDownRight, ArrowRight, ArrowUpRight, Settings2 } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/field";
import { Modal } from "@/components/ui/modal";
import { PageHeader, SectionHead } from "@/components/ui/section";
import { Tag } from "@/components/ui/tag";
import { cn } from "@/lib/cn";
import { fmtDate } from "@/lib/dates";
import { usd } from "@/lib/format";
import { PERSONAS } from "@/lib/personas";
import { PART_CATEGORIES, PART_CATEGORY_LABELS, type PartCategory } from "@/lib/schema";
import { composite, DEFAULT_WEIGHTS, FACTOR_LABELS, FACTORS, rag, supplierFactors, type Factor, type Rag, type Weights } from "@/lib/scoring";
import type { ScorecardData } from "@/lib/scorecard-data";
import { useStore } from "@/lib/store";

const CELL: (v: number) => string = (v) => (v >= 70 ? "bg-sev-low/80" : v >= 50 ? "bg-sev-medium/75" : v >= 30 ? "bg-sev-high/80" : "bg-sev-critical");
const RAG_STYLE: Record<Rag, string> = { green: "text-sev-low", amber: "text-sev-medium", red: "text-sev-critical" };
const RAG_DOT: Record<Rag, string> = { green: "bg-sev-low", amber: "bg-sev-medium", red: "bg-sev-critical" };

export function Scorecard({ data }: { data: ScorecardData }) {
  const weights = useStore((s) => s.weights);
  const [cat, setCat] = useState<PartCategory>("engine_lru");
  const [weightsOpen, setWeightsOpen] = useState(false);

  const rows = useMemo(
    () =>
      data.suppliers
        .filter((s) => s.categories.includes(cat))
        .map((s) => {
          const f = supplierFactors(s);
          const prev = s.history[s.history.length - 2];
          const prevF: Record<Factor, number> = { financial: prev.financial, capacity: prev.capacity, geo_esg: prev.geo_esg, sourcing: prev.sourcing, network: prev.network };
          const c = composite(f, weights);
          return { s, f, c, band: rag(f, weights), delta: c - composite(prevF, weights) };
        })
        .sort((a, b) => a.c - b.c),
    [data.suppliers, cat, weights],
  );
  const counts = { red: rows.filter((r) => r.band === "red").length, amber: rows.filter((r) => r.band === "amber").length, green: rows.filter((r) => r.band === "green").length };
  const critical = data.critical.filter((c) => c.part.category === cat);
  const recs = data.recs.filter((r) => r.category === cat);
  const custom = FACTORS.some((f) => weights[f] !== DEFAULT_WEIGHTS[f]);

  return (
    <div>
      <PageHeader
        kicker="Checkpoint 1 · Sourcing"
        title="Risk Scorecard"
        sub="Every active supplier in the category scored on five factors. Factor cells are colour only; the composite carries the number. A factor under 30 forces at least amber."
        right={
          <>
            <Select value={cat} onChange={(e) => setCat(e.target.value as PartCategory)} aria-label="Category" className="w-[190px]">
              {PART_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {PART_CATEGORY_LABELS[c]}
                </option>
              ))}
            </Select>
            <Button variant="secondary" onClick={() => setWeightsOpen(true)} data-testid="weights-open">
              <Settings2 size={14} /> Weights{custom ? " (custom)" : ""}
            </Button>
          </>
        }
      />
      <div className="grid grid-cols-[minmax(0,1fr)_380px]">
        <div className="min-w-0 border-r border-rule px-8 py-5">
          <div className="mb-4 flex items-center gap-6 text-[13px]">
            <span className="tnum">{rows.length} suppliers</span>
            {(["red", "amber", "green"] as Rag[]).map((b) => (
              <span key={b} className="flex items-center gap-1.5">
                <span className={cn("inline-block h-2 w-2", RAG_DOT[b])} />
                <span className="tnum">{counts[b]}</span>
                <span className="text-ink-3">{b}</span>
              </span>
            ))}
            <span className="ml-auto flex items-center gap-3 text-[11px] text-ink-3">
              {[
                ["70+", "bg-sev-low/80"],
                ["50 to 69", "bg-sev-medium/75"],
                ["30 to 49", "bg-sev-high/80"],
                ["under 30", "bg-sev-critical"],
              ].map(([l, c]) => (
                <span key={l} className="flex items-center gap-1">
                  <span className={cn("inline-block h-2.5 w-4", c)} /> {l}
                </span>
              ))}
            </span>
          </div>
          <table className="w-full text-[13px]" data-testid="scorecard-table">
            <thead>
              <tr className="border-b border-rule">
                <th className="label py-2 text-left font-normal">Supplier</th>
                {FACTORS.map((f) => (
                  <th key={f} className="label w-[74px] px-0.5 py-2 text-center font-normal" title={FACTOR_LABELS[f]}>
                    {FACTOR_LABELS[f].split(" ")[0]}
                    <span className="block text-[9px] normal-case tracking-normal text-ink-3">{weights[f]}%</span>
                  </th>
                ))}
                <th className="label w-[80px] py-2 text-right font-normal">Composite</th>
                <th className="label w-[64px] py-2 text-right font-normal">30d</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.s.id} className="h-10 border-b border-rule hover:bg-paper-2" data-testid={`sc-row-${r.s.id}`} data-band={r.band}>
                  <td className="pr-3">
                    <Link href={`/suppliers/${r.s.id}`} className="flex items-center gap-2 hover:underline">
                      <span className={cn("inline-block h-2 w-2 shrink-0", RAG_DOT[r.band])} />
                      <span className="truncate">{r.s.name}</span>
                      <span className="mono shrink-0 text-[11px] text-ink-3">T{r.s.tier} · {r.s.country_code}</span>
                      {r.s.status !== "active" && <Tag tone="default">{r.s.status}</Tag>}
                    </Link>
                  </td>
                  {FACTORS.map((f) => (
                    <td key={f} className="px-0.5 py-1">
                      <div className={cn("h-6", CELL(r.f[f]))} title={`${FACTOR_LABELS[f]}: ${r.f[f]}`} aria-label={`${FACTOR_LABELS[f]} ${r.f[f]}`} />
                    </td>
                  ))}
                  <td className={cn("tnum text-right text-[14px]", RAG_STYLE[r.band])}>{r.c}</td>
                  <td className="text-right">
                    <span className={cn("tnum inline-flex items-center gap-0.5 text-[12px]", r.delta <= -3 ? "text-sev-critical" : r.delta >= 3 ? "text-sev-low" : "text-ink-3")}>
                      {r.delta <= -3 ? <ArrowDownRight size={13} /> : r.delta >= 3 ? <ArrowUpRight size={13} /> : <ArrowRight size={13} />}
                      {r.delta > 0 ? `+${r.delta}` : r.delta}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <SectionHead label={`Critical parts · ${critical.length}`} className="mt-8" right={<span className="text-[11.5px] text-ink-3">sole source, long lead, or tied to a distressed supplier</span>} />
          {critical.length === 0 ? (
            <p className="py-4 text-[13px] text-ink-3">No critical parts in this category.</p>
          ) : (
            <table className="w-full text-[12.5px]" data-testid="critical-parts">
              <thead>
                <tr className="border-b border-rule">
                  {["Part", "Primary source", "Flags", "Lead", "Open PO value", "Next need"].map((h, i) => (
                    <th key={h} className={cn("label py-2 font-normal", i >= 3 ? "text-right" : "text-left")}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {critical.slice(0, 14).map((c) => (
                  <tr key={c.part.id} className="h-9 border-b border-rule">
                    <td className="pr-3">
                      <span className="mono mr-2 text-[11.5px]">{c.part.id}</span>
                      <span className="text-ink-2">{c.part.description}</span>
                    </td>
                    <td className="pr-3">
                      <Link href={`/suppliers/${c.supplier_id}`} className="hover:underline">
                        {c.supplier_name}
                      </Link>
                    </td>
                    <td className="pr-3">
                      <span className="flex flex-wrap gap-1">
                        {c.flags.map((f) => (
                          <Tag key={f} tone={f === "distressed supplier" ? "default" : "muted"}>
                            {f}
                          </Tag>
                        ))}
                      </span>
                    </td>
                    <td className="tnum text-right">{c.part.lead_time_days}d</td>
                    <td className="tnum text-right">{c.open_value_usd ? usd(c.open_value_usd) : <span className="text-ink-3">none open</span>}</td>
                    <td className="tnum text-right">{c.next_need ? fmtDate(c.next_need) : "n/a"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {critical.length > 14 && <p className="mt-2 text-[12px] text-ink-3">+{critical.length - 14} more critical parts</p>}
        </div>

        <aside className="px-5 py-5">
          <SectionHead label={`Diversification recommendations · ${recs.length}`} />
          <p className="py-3 text-[12px] text-ink-3">Prebuilt reasoning. Approving creates a sourcing task; dismissing logs a reason.</p>
          <div className="border-t border-rule">
            {recs.length === 0 && <p className="py-4 text-[13px] text-ink-3">No diversification recommendations for this category.</p>}
            {recs.map((r) => (
              <RecCard key={r.id} r={r} />
            ))}
          </div>
        </aside>
      </div>
      <WeightsModal open={weightsOpen} onClose={() => setWeightsOpen(false)} />
    </div>
  );
}

function RecCard({ r }: { r: ScorecardData["recs"][number] }) {
  const task = useStore((s) => s.sourcingTasks.find((t) => t.rec_id === r.id));
  const dismissed = useStore((s) => s.dismissedRecs[r.id]);
  const create = useStore((s) => s.createSourcingTask);
  const dismiss = useStore((s) => s.dismissRec);
  const [dismissing, setDismissing] = useState(false);
  const [reason, setReason] = useState("");
  return (
    <div className={cn("border-b border-rule py-4", (task || dismissed) && "opacity-80")} data-testid={`rec-${r.id}`}>
      <div className="mb-1 flex items-center gap-2">
        <span className="mono text-[11px] text-ink-3">{r.id}</span>
        <span className="mono text-[11px] text-ink-3">{r.part_id}</span>
      </div>
      <div className="text-[13.5px] font-medium leading-snug">Dual-source: {r.part_desc}</div>
      <div className="mt-1 text-[12.5px] text-ink-2">
        From {r.current_name} to {r.candidate_names.join(" or ")}
      </div>
      <div className="mt-2 grid grid-cols-3 gap-2 text-[12px]">
        <div>
          <div className="label text-[9.5px]">Qualification</div>
          <span className="capitalize">{r.qualification_effort}</span> <span className="tnum text-ink-3">{r.qualification_weeks}w</span>
        </div>
        <div>
          <div className="label text-[9.5px]">Cost delta</div>
          <span className="tnum">+{r.cost_delta_pct}%</span>
        </div>
        <div>
          <div className="label text-[9.5px]">Candidates</div>
          <span className="tnum">{r.candidate_supplier_ids.length}</span>
        </div>
      </div>
      <p className="accent-line mt-2.5 text-[13.5px] leading-snug text-ink-2">{r.rationale}</p>
      <div className="mt-3">
        {task ? (
          <div className="text-[12.5px]">
            <Tag>Sourcing task {task.id}</Tag> <span className="ml-1 text-ink-3">created by {PERSONAS[task.by].name}</span>
          </div>
        ) : dismissed ? (
          <div className="text-[12.5px] text-ink-3">Dismissed: {dismissed}</div>
        ) : dismissing ? (
          <div className="flex gap-2">
            <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason" className="h-7 text-[12.5px]" autoFocus />
            <Button
              size="sm"
              disabled={reason.trim().length < 3}
              onClick={() => {
                dismiss(r.id, reason.trim());
                setDismissing(false);
              }}
            >
              Log
            </Button>
          </div>
        ) : (
          <div className="flex gap-2">
            <Button size="sm" variant="primary" onClick={() => create({ rec_id: r.id, part_id: r.part_id, candidate_supplier_ids: r.candidate_supplier_ids })} data-testid={`rec-approve-${r.id}`}>
              Approve
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setDismissing(true)}>
              Dismiss
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

function WeightsModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const weights = useStore((s) => s.weights);
  const setWeights = useStore((s) => s.setWeights);
  const [w, setW] = useState<Weights>(weights);
  const total = FACTORS.reduce((s, f) => s + w[f], 0);
  return (
    <Modal
      open={open}
      onClose={onClose}
      kicker="Settings"
      title="Composite weights"
      footer={
        <>
          <Button variant="ghost" onClick={() => setW(DEFAULT_WEIGHTS)}>
            Reset to 30 / 20 / 15 / 25 / 10
          </Button>
          <Button
            variant="primary"
            onClick={() => {
              setWeights(w);
              onClose();
            }}
          >
            Apply
          </Button>
        </>
      }
    >
      <p className="mb-4 text-[13px] text-ink-2">Change the weights to show sensitivity. The composite normalises by the total, so weights need not sum to 100.</p>
      <div className="space-y-3">
        {FACTORS.map((f) => (
          <Field key={f} label={`${FACTOR_LABELS[f]} · ${w[f]}`}>
            <input type="range" min={0} max={60} value={w[f]} onChange={(e) => setW({ ...w, [f]: Number(e.target.value) })} className="w-full accent-[var(--ink)]" />
          </Field>
        ))}
      </div>
      <p className="tnum mt-3 text-[12px] text-ink-3">Total {total}</p>
    </Modal>
  );
}
