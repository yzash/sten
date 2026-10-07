"use client";

import Link from "next/link";
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { PageHeader, SectionHead, Stat } from "@/components/ui/section";
import { SeverityNumber } from "@/components/ui/severity";
import { Tag } from "@/components/ui/tag";
import { cn } from "@/lib/cn";
import { diffDays, fmtDate, fmtSgt } from "@/lib/dates";
import { usd } from "@/lib/format";
import { PART_CATEGORY_LABELS } from "@/lib/schema";
import { composite, FACTOR_LABELS, FACTORS, rag, supplierFactors, type Factor } from "@/lib/scoring";
import type { SupplierPageData } from "@/lib/scorecard-data";
import { useStore } from "@/lib/store";

const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function SupplierProfile({ data }: { data: SupplierPageData }) {
  const { supplier: s } = data;
  const weights = useStore((st) => st.weights);
  const f = supplierFactors(s);
  const c = composite(f, weights);
  const band = rag(f, weights);
  const hist = s.history.map((h) => ({ ...h, label: MON[Number(h.month.slice(5)) - 1] }));
  const drops = FACTORS.map((k) => ({ k, d: hist[hist.length - 1][k] - hist[0][k] }));
  const worst = drops.reduce((a, b) => (b.d < a.d ? b : a));
  const openValue = data.openLines.reduce((a, l) => a + l.qty * l.unit_price, 0);

  return (
    <div>
      <PageHeader
        kicker={`Supplier · LIFNR ${s.id}`}
        title={s.name}
        sub={
          <>
            Tier {s.tier} · {s.city}, {s.country} · {s.categories.map((x) => PART_CATEGORY_LABELS[x]).join(", ")} · {s.payment_terms}
            {s.strategic && " · strategic supplier"}
          </>
        }
        right={
          <Link href="/scorecard" className="text-[13px] text-ink-2 hover:text-ink">
            Back to scorecard
          </Link>
        }
      />
      <div className="flex items-end gap-10 border-b border-rule px-8 py-5">
        <div className="min-w-[120px]">
          <div className="label mb-1">Composite</div>
          <div className={cn("tnum text-[20px] leading-none", band === "red" ? "text-sev-critical" : band === "amber" ? "text-sev-medium" : "text-sev-low")}>{c}</div>
          <div className="mt-1 text-[12px] capitalize text-ink-3">{band}</div>
        </div>
        <Stat label="Status" value={<span className="text-[15px] capitalize">{s.status.replace("_", " ")}</span>} />
        <Stat label="On-time delivery" value={`${s.otd_pct}%`} sub="last 12 months" />
        <Stat label="NCRs" value={s.ncr_12m} sub="last 12 months" />
        <Stat label="Open POs" value={usd(openValue, { compact: true })} sub={`${data.openLines.length} lines`} />
        <Stat label="Sole-source parts" value={s.sole_source_parts.length} />
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)_380px]">
        <div className="min-w-0 border-r border-rule px-8 py-5">
          <SectionHead label="Scorecard history · 12 months" right={<span className="text-[11.5px] text-ink-3">largest move highlighted</span>} />
          <div className="grid grid-cols-5 gap-4 pt-4">
            {FACTORS.map((k: Factor) => {
              const hot = k === worst.k && worst.d <= -8;
              return (
                <div key={k} data-testid={`trend-${k}`}>
                  <div className="mb-1 flex items-baseline justify-between">
                    <span className="label">{FACTOR_LABELS[k].split(" ")[0]}</span>
                    <span className={cn("tnum text-[13px]", hot && "text-accent")}>{f[k]}</span>
                  </div>
                  <div className="h-[92px] border-b border-rule">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={hist} margin={{ top: 6, right: 2, bottom: 0, left: 2 }}>
                        <YAxis domain={[0, 100]} hide />
                        <XAxis dataKey="label" hide />
                        <Tooltip
                          contentStyle={{ border: "1px solid var(--rule-2)", borderRadius: 0, fontSize: 11, padding: "4px 8px" }}
                          labelStyle={{ fontFamily: "var(--font-mono)" }}
                          formatter={(v) => [v as number, FACTOR_LABELS[k]]}
                        />
                        <Line type="linear" dataKey={k} stroke={hot ? "var(--accent)" : "var(--ink)"} strokeWidth={hot ? 1.6 : 1.1} dot={false} isAnimationActive={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="mono mt-1 flex justify-between text-[9.5px] text-ink-3">
                    <span>{hist[0].label}</span>
                    <span>{hist[hist.length - 1].label}</span>
                  </div>
                </div>
              );
            })}
          </div>

          <SectionHead label={`Open POs · ${data.openLines.length}`} className="mt-8" />
          {data.openLines.length === 0 ? (
            <p className="py-4 text-[13px] text-ink-3">No open PO lines.</p>
          ) : (
            <table className="w-full text-[12.5px]">
              <thead>
                <tr className="border-b border-rule">
                  {["PO / item", "Part", "Qty", "Value", "Confirmed", "Needed", "Backlog"].map((h, i) => (
                    <th key={h} className={cn("label py-2 font-normal", i >= 2 ? "text-right" : "text-left")}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.openLines.map((l) => (
                  <tr key={l.id} className="h-9 border-b border-rule">
                    <td className="mono">
                      {l.ebeln} / {l.ebelp}
                    </td>
                    <td className="pr-2">
                      <span className="mono mr-1.5 text-[11.5px]">{l.part_id}</span>
                      <span className="text-ink-2">{l.part_desc}</span>
                    </td>
                    <td className="tnum text-right">{l.qty.toLocaleString("en-US")}</td>
                    <td className="tnum text-right">{usd(l.qty * l.unit_price)}</td>
                    <td className="tnum text-right">{fmtDate(l.confirmed_date)}</td>
                    <td className="tnum text-right">{fmtDate(l.needed_date)}</td>
                    <td className={cn("tnum text-right", l.backlog_days > 0 && "text-sev-high")}>{l.backlog_days ? `${l.backlog_days}d` : "0d"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        <aside className="space-y-7 px-5 py-5">
          <div>
            <SectionHead label="Recent signals · 90 days" />
            {data.signals.length === 0 ? (
              <p className="py-3 text-[13px] text-ink-3">No material signals in 90 days.</p>
            ) : (
              data.signals.map((x) => (
                <Link key={x.id} href={`/signals/${x.id}`} className="block border-b border-rule py-2.5 hover:bg-paper-2">
                  <div className="flex items-center justify-between text-[11.5px] text-ink-3">
                    <span className="mono">
                      {x.id} · {fmtSgt(x.received_at)}
                    </span>
                    {x.severity != null && <SeverityNumber value={x.severity} />}
                  </div>
                  <div className="text-[12.5px] leading-snug">{x.headline}</div>
                </Link>
              ))
            )}
          </div>
          <div>
            <SectionHead label="Certificates" />
            {s.certs.map((ct) => {
              const left = diffDays("2026-10-07", ct.expiry);
              return (
                <div key={ct.number} className="flex items-center justify-between border-b border-rule py-2 text-[12.5px]">
                  <span>
                    {ct.name} <span className="mono text-[11px] text-ink-3">{ct.number}</span>
                  </span>
                  <span className={cn("tnum", left <= 60 ? "text-sev-high" : "text-ink-2")}>{fmtDate(ct.expiry, true)}</span>
                </div>
              );
            })}
          </div>
          <div>
            <SectionHead label={`Parts supplied · ${data.parts.length}`} />
            <div className="max-h-[220px] overflow-y-auto">
              {data.parts.map((p) => (
                <div key={p.id} className="flex items-center justify-between border-b border-rule py-1.5 text-[12px]">
                  <span className="min-w-0 truncate">
                    <span className="mono mr-1.5 text-[11px]">{p.id}</span>
                    <span className="text-ink-2">{p.description}</span>
                  </span>
                  {p.sole && <Tag tone="muted">sole</Tag>}
                </div>
              ))}
            </div>
          </div>
          <div>
            <SectionHead label="Precedents involving this supplier" />
            {data.precedents.length === 0 ? (
              <p className="py-3 text-[13px] text-ink-3">No recorded cases.</p>
            ) : (
              data.precedents.map((p) => (
                <div key={p.id} className="border-b border-rule py-2.5 text-[12.5px]">
                  <div className="mono text-[11px] text-ink-3">
                    {p.id} · {p.year}
                  </div>
                  <div>{p.title}</div>
                  <div className="text-ink-2">{p.option_taken}</div>
                </div>
              ))
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
